import type * as OrtModule from "onnxruntime-web";

type OrtRuntimeModule = typeof import("onnxruntime-web");

const ONNX_WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/";

let cachedRuntime: OrtRuntimeModule | null = null;
let wasmPathConfigured = false;

declare global {
    interface Window {
        ort?: OrtRuntimeModule;
    }
}

export function getOrtRuntime(): OrtRuntimeModule {
    if (cachedRuntime) {
        return cachedRuntime;
    }

    const runtime = typeof window !== "undefined" ? window.ort : undefined;
    if (!runtime) {
        throw new Error("ONNX Runtime（onnxruntime-web）がCDNから読み込まれていません。");
    }

    if (!wasmPathConfigured) {
        runtime.env.wasm.wasmPaths = ONNX_WASM_BASE_URL;
        wasmPathConfigured = true;
    }

    cachedRuntime = runtime;
    return runtime;
}

export type { OrtRuntimeModule };

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
