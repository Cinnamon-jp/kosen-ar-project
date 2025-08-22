import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/";

export default async function inferOnnxModel(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): Promise<ort.InferenceSession.OnnxValueMapType> {
    // onnxruntime-web が探しに行く .wasm のベースパスを指定

    // ONNX モデルの読み込み
    const session = await ort.InferenceSession.create("/yolo11n.onnx");

    // テンソルの作成（<video> / <img> 両対応）
    const inputTensor = createTensor(video, canvas);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    return results;
}

function createTensor(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): ort.Tensor {
    // 出力のタプルを取得
    const data = resizeVideoToMultipleOf32(video, canvas);

    const dataArray: ImageDataArray = data[0];
    const targetWidth: number = dataArray[1];
    const targetHeight: number = dataArray[2];

    const size = targetWidth * targetHeight;

    const floatArray = new Float32Array(3 * size);
    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const pixelIndex = y * targetWidth + x;
            const dataIndex = pixelIndex * 4;
            floatArray[pixelIndex] = dataArray[dataIndex] / 255;                // R
            floatArray[size + pixelIndex] = dataArray[dataIndex + 1] / 255;     // G
            floatArray[2 * size + pixelIndex] = dataArray[dataIndex + 2] / 255; // B
        }
    }

    return new ort.Tensor("float32", floatArray, [1, 3, targetHeight, targetWidth]);
}

function resizeVideoToMultipleOf32(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): [ImageDataArray, number, number] {
    const ctx = canvas.getContext("2d");
    // 例外処理
    if (!ctx) {
        throw new Error("Unable to get 2D context from canvas");
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

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
        0, 0,                      // 描画先の左上
        targetWidth,               // 描画先の幅
        targetHeight               // 描画先の高さ
    );

    // ImageData を取得して返す
    return [ctx.getImageData(0, 0, targetWidth, targetHeight).data,
        targetWidth, targetHeight
    ];
}