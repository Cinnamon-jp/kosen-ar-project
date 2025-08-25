import * as ort from "onnxruntime-web";

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;

import startCamera from "./functions/startCamera.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import drawDetections from "./functions/drawDetections.ts";

import type { Detection } from "./functions/inferOnnxModel.ts";

// onnxruntime-web が探しに行く .wasm のベースパスを指定
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/";

// ONNX モデルの読み込み
const session = await ort.InferenceSession.create("/yolo11n_640_static.onnx");

// 描画コンテキストの取得
const ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error("Unable to get 2D context from canvas");
}

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
            results = await inferOnnxModel(session, video, canvas);
            console.log(results);
        } catch (error) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", error);
        }

        // バウンディングボックスの描画
        drawDetections(results, canvas);
        console.log("描画完了");
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
