import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu"; // WebGPU EP を登録 (side-effect import)

export default async function createOnnxSession(modelUrl: string): Promise<ort.InferenceSession> {
    // 最適化やメモリ設定
    // 推論セッションの共通オプション
    const commonOptions: ort.InferenceSession.SessionOptions = {
        graphOptimizationLevel: "all",    // 最適化
        enableCpuMemArena: true,          // CPUメモリアリーナ
        enableMemPattern: true,           // メモリパターン
    };

    // 簡易版
    // return ort.InferenceSession.create(modelUrl, commonOptions);

    // WebGPU 利用可能か判定
    const canUseWebGPU: boolean = typeof navigator !== "undefined" && "gpu" in navigator;

    if (canUseWebGPU) {
        try {
            const session = await ort.InferenceSession.create(modelUrl, {
                ...commonOptions,
                executionProviders: ["webgpu", "wasm"], // 先頭: 第一候補
            });
            console.log("ONNX Runtime: WebGPU EP 使用中");
            return session;
        } catch (error) {
            console.warn("WebGPU セッション作成失敗。WASM にフォールバックします:", error);
        }
    } else {
        console.log("WebGPU 未対応。WASM を使用します。");
    }

    // フォールバック (WASM)
    return ort.InferenceSession.create(modelUrl, {
        ...commonOptions,
        executionProviders: ["wasm"],
    });
}