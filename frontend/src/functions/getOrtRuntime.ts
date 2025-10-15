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
