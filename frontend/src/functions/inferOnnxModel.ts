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

export default async function inferOnnxModel(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): Promise<Detection[]> {
    // ONNX モデルの読み込み
    const session = await ort.InferenceSession.create("/yolo11n.onnx");

    // テンソルの作成（<video> / <img> 両対応）
    const inputTensor = preprocess(video, canvas);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    // 検出結果の後処理
    const detections = postprocess(results);

    return detections;
}

function preprocess(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): ort.Tensor {
    const ctx = canvas.getContext("2d");
    // 例外処理
    if (!ctx) {
        throw new Error("Unable to get 2D context from canvas");
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    // 例外処理
    if (videoWidth === 0 || videoHeight === 0) {
        throw new Error("Video width or height is zero");
    }

    // 32の倍数に切り下げ
    const targetWidth = Math.floor(videoWidth / 32) * 32;
    const targetHeight = Math.floor(videoHeight / 32) * 32;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // 中央寄せ時の左上座標を計算
    const sx = (videoWidth - targetWidth) / 2;
    const sy = (videoHeight - targetHeight) / 2;

    // 中央切り出し → キャンバスいっぱいに描画
    ctx.drawImage(
        video,
        sx, sy,                    // 左上座標
        targetWidth, targetHeight, // 右下座標
        0, 0,                      // 描画先の左上座標
        targetWidth, targetHeight  // 描画先の右下座標
    );

    const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const size = targetWidth * targetHeight;

    const floatArray = new Float32Array(3 * size);
    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const pixelIndex = y * targetWidth + x;
            const dataIndex = pixelIndex * 4;
            floatArray[pixelIndex] = data[dataIndex] / 255;                // R
            floatArray[size + pixelIndex] = data[dataIndex + 1] / 255;     // G
            floatArray[2 * size + pixelIndex] = data[dataIndex + 2] / 255; // B
        }
    }

    return new ort.Tensor("float32", floatArray, [1, 3, targetHeight, targetWidth]);
}

function postprocess(results: ort.InferenceSession.OnnxValueMapType): Detection[] {
    const tensor = results["output0"] as ort.Tensor;
    const attrs = tensor.dims[2]; // 例: [1, 8400, 84], [1, 300, 6]
    console.log(tensor.dims);
    const data = tensor.data as Float32Array; // 実際のデータが格納された1次元配列

    // i 番目のボックスを取得する関数 (0スタート)
    function getBox(i: number): Detection {
        const base = attrs * i;

        const centerX = data[base + 0];
        const centerY = data[base + 1];
        const width  = data[base + 2];
        const height  = data[base + 3];
        const score = data[base + 4];
        const classId = data[base + 5];

        // バウンディングボックスの左上座標に変換
        const x1 = centerX - width / 2;
        const y1 = centerY - height / 2;

        const className = COCO_CLASSES[classId] ?? "unknown";

        // console.log({ className, score, x1, y1, width, height });

        return { className, score, x1, y1, width, height};
    }

    // スコアが0でなくなるまで (＝有効なボックスがなくなるまで) ループ
    let detections: Detection[] = [];
    for (let i = 0; data[attrs * i + 4] !== 0; i++) {
        detections.push(getBox(i));
    }

    return detections;
}