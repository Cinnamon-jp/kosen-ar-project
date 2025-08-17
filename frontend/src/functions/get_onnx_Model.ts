import * as ort from "onnxruntime-web";
import * as ortgpu from "onnxruntime-web/webgpu"

export async function loadOnnxModel(modelUrl: string): Promise<ort.InferenceSession> {
    try {
        const res = await fetch(modelUrl);
        if (!res.ok) {
            throw new Error(
                `ONNXモデルの取得に失敗しました: ${res.status} ${res.statusText}`
            );
        }
        const arrayBuffer = await res.arrayBuffer();
        const modelUint8 = new Uint8Array(arrayBuffer);
        // 必要に応じて executionProviders やオプションを渡せます
        const session = await ort.InferenceSession.create(modelUint8);
        return session;
    } catch (error) {
        console.error("loadOnnxModel error:", error);
        throw error;
    }
}
