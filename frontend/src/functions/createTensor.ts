import * as ort from "onnxruntime-web";

export default function createTensor(video: HTMLVideoElement, canvas: HTMLCanvasElement): ort.Tensor {
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Unable to get 2D context from canvas");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const numPixels = data.length / 4;
    const floatArray = new Float32Array(numPixels * 3);
    
    // RGBA → RGB に変換
    let j = 0;
    for (let i = 0; i < data.length; i += 4) {
        floatArray[j++] = data[i] / 255; // R
        floatArray[j++] = data[i + 1] / 255; // G
        floatArray[j++] = data[i + 2] / 255; // B
    }

    // ONNX の入力形式に合わせてテンソルを作成
    return new ort.Tensor("float32", floatArray, [1, 3, canvas.height, canvas.width]);
}
