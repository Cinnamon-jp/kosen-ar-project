import * as ort from "onnxruntime-web";

import createTensor from "./createTensor.ts";

export default async function inferOnnxModel(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
): Promise<ort.InferenceSession.OnnxValueMapType> {
    // ONNX モデルの読み込み
    const session = await ort.InferenceSession.create("../../yolo11n.onnx");

    // テンソルの作成
    const inputTensor = createTensor(video, canvas);

    // 入力テンソルのフィード
    const feeds = { [session.inputNames[0]]: inputTensor };

    // モデル推論実行
    const results = await session.run(feeds);

    return results;
}
