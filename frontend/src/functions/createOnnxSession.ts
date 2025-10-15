import type * as OrtModule from "onnxruntime-web";
import { getOrtRuntime } from "./getOrtRuntime.ts";

export default async function createOnnxSession(modelName: string): Promise<OrtModule.InferenceSession> {
    const ort = getOrtRuntime();

    // 最適化やメモリ設定
    // 推論セッションの共通オプション
    const commonOptions: OrtModule.InferenceSession.SessionOptions = {
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
