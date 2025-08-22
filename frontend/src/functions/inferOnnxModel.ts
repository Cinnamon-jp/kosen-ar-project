import * as ort from "onnxruntime-web";

export default async function inferOnnxModel(
    source: HTMLVideoElement | HTMLImageElement, // debug
    canvas: HTMLCanvasElement
): Promise<ort.InferenceSession.OnnxValueMapType> {
    // onnxruntime-web が探しに行く .wasm のベースパスを指定
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/";

    // ONNX モデルの読み込み
    const session = await ort.InferenceSession.create("/yolo11n.onnx");

    // テンソルの作成（<video> / <img> 両対応）
    const inputTensor = createTensor(source, canvas);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    return results;
}

function createTensor(
    source: HTMLVideoElement | HTMLImageElement,
    canvas: HTMLCanvasElement
): ort.Tensor {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to get 2D context from canvas");

    // 元サイズ（キャンバス未設定ならソース）
    let baseWidth: number;
    let baseHeight: number;
    if (canvas.width === 0 || canvas.height === 0) {
        if (source instanceof HTMLVideoElement) {
            baseWidth = source.videoWidth || 0;
            baseHeight = source.videoHeight || 0;
        } else {
            baseWidth = source.naturalWidth || 0;
            baseHeight = source.naturalHeight || 0;
        }
    } else {
        baseWidth = canvas.width;
        baseHeight = canvas.height;
    }

    // 最も近い 32 の倍数（YOLO 系で要求されることが多い）
    const roundTo32 = (v: number) => Math.max(32, Math.round(v / 32) * 32);
    const targetWidth = roundTo32(baseWidth);
    const targetHeight = roundTo32(baseHeight);

    // リサイズ描画
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    // ピクセルデータ取得
    const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
    const size = targetWidth * targetHeight;

    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    const floatArray = new Float32Array(3 * size);
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
