import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu"; // WebGPU EP を登録 (side-effect import)

// onnxruntime-web が探しに行く .wasm のベースパスを固定バージョンで指定（latestを避ける）
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/";

export default async function createOnnxSession(modelName: string): Promise<ort.InferenceSession> {
    // 最適化やメモリ設定
    // 推論セッションの共通オプション
    const commonOptions: ort.InferenceSession.SessionOptions = {
        graphOptimizationLevel: "all", // 最適化
        enableCpuMemArena: true, // CPUメモリアリーナ
        enableMemPattern: true, // メモリパターン
        intraOpNumThreads: navigator.hardwareConcurrency || 4, // WASM用の並列実行設定
        executionMode: "parallel" // 実行モード最適化
    };

    // WebGPU 利用可能か判定
    const canUseWebGPU: boolean = typeof navigator !== "undefined" && "gpu" in navigator;

    if (canUseWebGPU) {
        try {
            const session = await ort.InferenceSession.create(modelName, {
                ...commonOptions,
                executionProviders: [
                    {
                        name: "webgpu",
                        preferredLayout: "NHWC" // レイアウト最適化
                    },
                    "wasm"
                ]
            });
            console.log("ONNX Runtime: WebGPU EP 使用中");
            return session;
        } catch (error) {
            console.warn("ONNX Runtime: WebGPU セッション作成失敗。WASM にフォールバックします:", error);
        }
    } else {
        console.log("ONNX Runtime: WebGPU 未対応。WASM を使用します。");
    }

    // フォールバック (WASM)
    return ort.InferenceSession.create(modelName, {
        ...commonOptions,
        executionProviders: ["wasm"]
    });
}
