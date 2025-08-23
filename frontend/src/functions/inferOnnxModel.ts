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

interface Detection {
    classId: number;
    className: string;
    score: number;
    x1: number; y1: number;
    x2: number; y2: number;
}

export default async function inferOnnxModel(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): Promise<ort.InferenceSession.OnnxValueMapType> {
    // onnxruntime-web が探しに行く .wasm のベースパスを指定

    // ONNX モデルの読み込み
    const session = await ort.InferenceSession.create("/yolo11n.onnx");

    // テンソルの作成（<video> / <img> 両対応）
    const inputTensor = preprocess(video, canvas);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    return results;
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
    const data = (results["output0"] as ort.Tensor).data as Float32Array;
}