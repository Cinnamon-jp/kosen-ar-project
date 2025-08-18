import * as ort from "onnxruntime-web";

import createTensor from "./createTensor.ts";
export default async function inferOnnxModel(): Promise<ort.InferenceSession.OnnxValueMapType> {
    const session = await ort.InferenceSession.create("yolov11n.onnx");
    const inputTensor = createTensor();

    const feeds = { [session.inputNames[0]]: inputTensor };
    const results = await session.run(feeds);

    return results;
}
