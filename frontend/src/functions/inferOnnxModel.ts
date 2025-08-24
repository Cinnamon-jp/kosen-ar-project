import * as ort from "onnxruntime-web";

const COCO_CLASSES = [
    "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light",
    "fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow",
    "elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee",
    "skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket","bottle",
    "wine glass","cup","fork","knife","spoon","bowl","banana","apple","sandwich","orange",
    "broccoli","carrot","hot dog","pizza","donut","cake","chair","couch","potted plant","bed",
    "dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone","microwave","oven",
    "toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear","hair drier","toothbrush"
];

export interface Detection {
    className: string;
    score: number;
    x1: number; y1: number;
    width: number; height: number;
}

interface Conversion {
    magnification: number;
    originalWidth: number;
    originalHeight: number;
}


export default async function inferOnnxModel(session: ort.InferenceSession, video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Detection[]> {
    // テンソルの作成、倍率の取得
    const [inputTensor, conversion] = preprocess(video, canvas);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    // 検出結果の後処理
    const detections = postprocess(results, conversion);

    return detections;
}


// 画像前処理: <video> 要素を受け取り、640x640にリサイズしてTensorと倍率を返す
function preprocess(video: HTMLVideoElement, canvas: HTMLCanvasElement): [ort.Tensor, Conversion] {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Unable to get 2D context from canvas");
    }
    // canvas を video のネイティブ解像度に合わせる
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // 一時的なcanvasを作成
    const tempCanvas = document.createElement("canvas");
        tempCanvas.style.display = "none"; // 非表示
    const tempCtx = tempCanvas.getContext("2d");
    // 例外処理
    if (!tempCtx) {
        throw new Error("Unable to get 2D context from canvas");
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // 例外処理
    if (videoWidth === 0 || videoHeight === 0) {
        throw new Error("Video width or height is zero");
    }

    const tempCanvasWidth = 640;
    const tempCanvasHeight = 640;
    // 640pxに収まるように拡大率を計算
    const magnification = videoHeight >= videoWidth ? tempCanvasHeight / videoHeight : tempCanvasWidth / videoWidth;

    tempCanvas.width = tempCanvasWidth;
    tempCanvas.height = tempCanvasHeight;

    // canvasを灰色で塗りつぶし (パディング部分)
    const PAD_COLOR = 114; // YOLO11の学習時に使われたパディングの色
    tempCtx.fillStyle = `rgb(${PAD_COLOR}, ${PAD_COLOR}, ${PAD_COLOR})`;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // videoをcanvasの中央に縮小描画
    tempCtx.drawImage(
        video,
        0, 0, videoWidth, videoHeight, // 元画像の切り出し位置とサイズ
        (tempCanvas.width - videoWidth * magnification) / 2, // 描画先の左上X座標 (中央寄せ)
        (tempCanvas.height - videoHeight * magnification) / 2, // 描画先の左上Y座標 (中央寄せ)
        videoWidth * magnification, // 描画先の幅
        videoHeight * magnification // 描画先の高さ
    );

    // canvasに写真を描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    console.log("写真撮影完了"); // debug
    canvas.style.zIndex = "2"; // debug


    // ピクセルデータを取得
    const { data } = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const size = tempCanvas.width * tempCanvas.height;

    const floatArray = new Float32Array(3 * size);
    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    for (let y = 0; y < tempCanvasHeight; y++) {
        for (let x = 0; x < tempCanvasWidth; x++) {
            const pixelIndex = y * tempCanvasWidth + x;
            const dataIndex = pixelIndex * 4;
            floatArray[pixelIndex] = data[dataIndex] / 255;                // R
            floatArray[size + pixelIndex] = data[dataIndex + 1] / 255;     // G
            floatArray[2 * size + pixelIndex] = data[dataIndex + 2] / 255; // B
        }
    }

    const conversion: Conversion = {
        magnification,
        originalWidth: videoWidth,
        originalHeight: videoHeight
    };

    // 一時的なcanvasを削除
    tempCanvas.remove();

    return [new ort.Tensor("float32", floatArray, [1, 3, tempCanvasHeight, tempCanvasWidth]),
        conversion];
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
        const width  = data[base + 2];
        const height  = data[base + 3];
        const score = data[base + 4];
        const classId = data[base + 5];

        const className = COCO_CLASSES[classId] ?? "unknown";

        // console.log({ className, score, x1, y1, width, height });

        return { className, score, x1, y1, width, height};
    }

    // canvasのサイズ (640x640固定)
    const canvasWidth = 640; // preprocess() と同じ値
    const canvasHeight = 640; // preprocess() と同じ値

    // 元画像サイズに変換する関数
    function convertToOriginalScale(detection: Detection): Detection {
        let x1: number;
        let y1: number;
        let width: number;
        let height: number;

        if (conversion.originalHeight >= conversion.originalWidth) {
            x1 = (detection.x1 - (canvasWidth - conversion.originalWidth * conversion.magnification) / 2) / conversion.magnification;
            y1 = detection.y1 / conversion.magnification;
        } else {
            x1 = detection.x1 / conversion.magnification;
            y1 = (detection.y1 - (canvasHeight - conversion.originalHeight * conversion.magnification) / 2) / conversion.magnification;
        }

        width = detection.width// / conversion.magnification; // debug
        height = detection.height// / conversion.magnification; // debug

        // 整数に四捨五入
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        width = Math.round(width);
        height = Math.round(height);

        return {
            className: detection.className,
            score: detection.score,
            x1, y1,
            width, height
        };
    }

    // スコアが0でなくなるまで (＝有効なボックスがなくなるまで) ループ
    let detections: Detection[] = [];
    for (let i = 0; data[attrs * i + 4] !== 0; i++) {
        detections.push(convertToOriginalScale(getBox(i)));
    }

    // モデルにNMSを内蔵しているので、追加のNMS処理は不要
    return detections;
}