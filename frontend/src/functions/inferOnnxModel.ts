import * as ort from "onnxruntime-web";

// prettier-ignore
const COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
    "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
    "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
    "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
    "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
] as const;

export type TYPE_COCO_CLASSES = (typeof COCO_CLASSES)[number]; // COCO_CLASSESのいずれかの文字列

// 検出結果のフォーマット
export interface Detection {
    className: TYPE_COCO_CLASSES; // COCOクラス名に限定
    score: number;
    x1: number;
    y1: number;
    width: number;
    height: number;
}

interface Conversion {
    aspect: number;
    originalWidth: number;
    originalHeight: number;
    targetWidth: number;
    targetHeight: number;
}

export default async function inferOnnxModel(
    session: ort.InferenceSession,
    video: HTMLVideoElement,
    ctx: CanvasRenderingContext2D | null,
    tempCanvas: HTMLCanvasElement,
    tempCtx: CanvasRenderingContext2D | null,
    targetClassNames: TYPE_COCO_CLASSES[] // 抽出したいクラス名 (空配列なら全クラス対象)
): Promise<Detection[]> {
    // 例外処理
    if (!ctx || !tempCtx) {
        throw new Error("Unable to get 2D context from canvas");
    }
    // テンソルの作成、倍率の取得
    const [inputTensor, conversion] = preprocess(video, tempCanvas.width, tempCanvas.height, tempCtx);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    // 検出結果の後処理
    const detections = postprocess(results, conversion);

    // 特定のクラス名のみ抽出
    if (targetClassNames.length > 0) {
        return extractTargetClassName(detections, targetClassNames);
    }

    return detections;
}

// 画像前処理: <video> 要素を受け取り、640x640にリサイズしてTensorと倍率を返す
function preprocess(
    video: HTMLVideoElement,
    tempCanvasWidth: number,
    tempCanvasHeight: number,
    tempCtx: CanvasRenderingContext2D
): [ort.Tensor, Conversion] {
    // videoのサイズを設定
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    // 例外処理
    if (videoWidth === 0 || videoHeight === 0) {
        throw new Error("Video width or height is zero");
    }

    // アスペクト比の計算
    const aspect = videoWidth / videoHeight;

    // 640pxに収まるようにリサイズ後のサイズを計算 -> 整数に丸める
    // aspect >= 1 (横長) : aspect < 1 (縦長)
    const targetWidth: number = aspect >= 1 ? tempCanvasWidth : Math.round(videoWidth * (tempCanvasHeight / videoHeight));
    const targetHeight: number = aspect >= 1 ? Math.round(videoHeight * (tempCanvasWidth / videoWidth)) : tempCanvasHeight;

    // canvasを灰色で塗りつぶし (パディング部分)
    const PAD_COLOR = 114; // YOLO11の学習時に使われたパディングの色
    tempCtx.fillStyle = `rgb(${PAD_COLOR}, ${PAD_COLOR}, ${PAD_COLOR})`;
    tempCtx.fillRect(0, 0, tempCanvasWidth, tempCanvasHeight);

    // 描画先のx,y座標を計算 (中央寄せ)
    const targetX = (tempCanvasWidth - targetWidth) / 2;
    const targetY = (tempCanvasHeight - targetHeight) / 2;

    // videoをcanvasの中央に縮小描画
    // pretty-ignore
    tempCtx.drawImage(
        video,
        0,
        0, // 切り出し開始位置
        videoWidth,
        videoHeight, // 切り出しサイズ
        targetX,
        targetY, // 描画先の座標 (中央寄せ)
        targetWidth,
        targetHeight // 描画先のサイズ
    );

    // ピクセルデータを取得
    const { data }: { data: Uint8ClampedArray } = tempCtx.getImageData(0, 0, tempCanvasWidth, tempCanvasHeight);
    const size = tempCanvasWidth * tempCanvasHeight;

    const floatArray = new Float32Array(3 * size);
    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    for (let y = 0; y < tempCanvasHeight; y++) {
        for (let x = 0; x < tempCanvasWidth; x++) {
            const pixelIndex = y * tempCanvasWidth + x;
            const dataIndex = pixelIndex * 4;
            floatArray[pixelIndex] = data[dataIndex] / 255; // R
            floatArray[size + pixelIndex] = data[dataIndex + 1] / 255; // G
            floatArray[2 * size + pixelIndex] = data[dataIndex + 2] / 255; // B
        }
    }

    // 拡大・縮小情報
    const conversion: Conversion = {
        aspect: aspect,
        originalWidth: videoWidth,
        originalHeight: videoHeight,
        targetWidth: targetWidth,
        targetHeight: targetHeight
    };

    // 一時canvasをクリア
    tempCtx.clearRect(0, 0, tempCanvasWidth, tempCanvasHeight);

    return [new ort.Tensor("float32", floatArray, [1, 3, tempCanvasHeight, tempCanvasWidth]), conversion];
}

// 画像後処理: モデルの出力を受け取り、Detectionの配列を返す
function postprocess(results: ort.InferenceSession.OnnxValueMapType, conversion: Conversion): Detection[] {
    const tensor = results["output0"] as ort.Tensor;
    const attrs = tensor.dims[2]; // 例: [1, 8400, 84], [1, 300, 6]
    const data = tensor.data as Float32Array; // 実際のデータが格納された1次元配列

    // i 番目のボックスを取得する関数 (0スタート)
    function getBox(i: number): Detection {
        const base = attrs * i;

        const x1 = data[base + 0];
        const y1 = data[base + 1];
        const x2 = data[base + 2];
        const y2 = data[base + 3];
        const score = data[base + 4];
        const classId = data[base + 5];

        const width = x2 - x1;
        const height = y2 - y1;

        // IDとクラス名を紐づけ
        const className = COCO_CLASSES[classId] ?? "unknown";

        return { className, score, x1, y1, width, height };
    }

    // canvasのサイズ (640x640固定)
    const canvasWidth = 640; // preprocess() と同じ値
    const canvasHeight = 640; // preprocess() と同じ値

    // 元画像サイズに変換する関数
    function convertToOriginalScale(detection: Detection): Detection {
        // レターボックス分を考慮して、左上座標を元画像サイズに変換 -> 整数に丸める
        const x1 = Math.round(
            (detection.x1 - (canvasWidth - conversion.targetWidth) / 2) * (conversion.originalWidth / conversion.targetWidth)
        );
        const y1 = Math.round(
            (detection.y1 - (canvasHeight - conversion.targetHeight) / 2) * (conversion.originalHeight / conversion.targetHeight)
        );

        // 幅・高さを元画像サイズに変換 -> 整数に丸める
        const width = Math.round(detection.width * (conversion.originalWidth / conversion.targetWidth));
        const height = Math.round(detection.height * (conversion.originalHeight / conversion.targetHeight));

        return {
            className: detection.className,
            score: detection.score,
            x1: x1,
            y1: y1,
            width: width,
            height: height
        };
    }

    // スコアが 0でなくなるまで (＝有効なボックスがなくなるまで) ループ
    let detections: Detection[] = [];
    for (let i = 0; data[attrs * i + 4] !== 0; i++) {
        detections.push(convertToOriginalScale(getBox(i)));
    }

    // モデルにNMSを内蔵しているので、追加のNMS処理は不要
    return detections;
}

// 指定されたクラス名の検出結果のみを抽出する関数
function extractTargetClassName(
    detections: Detection[],
    targetClassNames: TYPE_COCO_CLASSES[]
): Detection[] {
    return detections.filter(detection =>
        targetClassNames.includes(detection.className)
    );
}
