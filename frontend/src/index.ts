import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu"; // WebGPUのサイドエフェクトインポート

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;

import startCamera from "./functions/startCamera.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import drawDetections from "./functions/drawDetections.ts";
import createOnnxSession from "./functions/createOnnxSession.ts";

import type { Detection } from "./functions/inferOnnxModel.ts";

// onnxruntime-web が探しに行く .wasm のベースパスを指定
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/";

// ONNX モデルの読み込み
const modelUrl = "/yolo11n_640_static.onnx";
const session = await createOnnxSession(modelUrl);

// 描画コンテキストの取得
const ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error("Unable to get 2D context from canvas");
}

// canvas を前面表示
canvas.style.zIndex = "2";

async function main(): Promise<void> {
    // カメラの起動
    try {
        await startCamera(video);
    } catch (error) {
        console.error("カメラの読み込み中にエラーが発生しました:", error);
    }

    async function handleCapture(): Promise<void> {
        let results: Detection[] = [];
        try {
            // ONNXモデルの推論実行
            results = await inferOnnxModel(session, video, canvas);
        } catch (error) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", error);
        }

        // バウンディングボックスの描画
        drawDetections(results, canvas);
    }

    while (true) {
        await handleCapture();
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms待機
    }

    // 写真撮影時
    captureButton.addEventListener("click", handleCapture);
    document.addEventListener("keydown", async (event) => {
        if (event.key === " ") {
            await handleCapture();
        }
    });
}
main().catch((err) => {
    console.error(err);
    alert("エラーが発生しました。");
});
