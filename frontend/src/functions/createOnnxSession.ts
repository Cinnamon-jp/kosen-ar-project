import type * as OrtTypes from "onnxruntime-web";
import * as ortModule from "onnxruntime-web";

type OrtRuntimeModule = typeof ortModule;

const ONNX_WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/";

function canUseWebGL(): boolean {
    if (typeof document === "undefined") {
        return false;
    }

    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
        return false;
    }
}

let cachedRuntime: OrtRuntimeModule | null = null;
let wasmPathConfigured = false;
export function getOrtRuntime(): OrtRuntimeModule {
    if (cachedRuntime) {
        return cachedRuntime;
    }

    const runtime = ortModule;

    if (!wasmPathConfigured) {
        runtime.env.wasm.wasmPaths = ONNX_WASM_BASE_URL;
        wasmPathConfigured = true;
    }

    cachedRuntime = runtime;
    return runtime;
}

export type { OrtRuntimeModule };

export default async function createOnnxSession(modelName: string): Promise<OrtTypes.InferenceSession> {
    const ort = getOrtRuntime();

    const commonOptions: OrtTypes.InferenceSession.SessionOptions = {
        graphOptimizationLevel: "all",
        enableCpuMemArena: true,
        enableMemPattern: true,
        intraOpNumThreads: navigator.hardwareConcurrency || 4,
        executionMode: "parallel"
    };

    // 試行する実行プロバイダーのリスト（優先度順）
    const providers = [
        {
            name: "webgpu",
            check: () => typeof navigator !== "undefined" && "gpu" in navigator,
            options: { preferredLayout: "NHWC" }
        },
        {
            name: "webgl",
            check: canUseWebGL,
            options: {}
        },
        {
            name: "wasm",
            check: () => true, // 常に利用可能
            options: {}
        }
    ];

    for (const provider of providers) {
        if (!provider.check()) {
            console.log(`ONNX Runtime: ${provider.name.toUpperCase()} はサポートされていません。`);
            continue;
        }

        try {
            const executionProviders = provider.name === 'wasm'
                ? ['wasm']
                : [{ name: provider.name, ...provider.options }, 'wasm'];

            const session = await ort.InferenceSession.create(modelName, {
                ...commonOptions,
                executionProviders
            });
            console.log(`ONNX Runtime: ${provider.name.toUpperCase()} EP を使用しています。`);
            return session;
        } catch (error) {
            console.warn(`ONNX Runtime: ${provider.name.toUpperCase()} セッションの作成に失敗しました。次にフォールバックします。`, error);
        }
    }

    // すべてのプロバイダーで失敗した場合
    throw new Error("ONNX Runtime: 利用可能な実行プロバイダーでセッションを作成できませんでした。");
}
