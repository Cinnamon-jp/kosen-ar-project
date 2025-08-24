import * as ort from "onnxruntime-web";

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;

import startCamera from "./functions/startCamera.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import drawDetections from "./functions/drawDetections.ts";

async function main(): Promise<void> {
    // カメラの起動
    try {
        await startCamera(video);
    } catch (error) {
        console.error("カメラの読み込み中にエラーが発生しました:", error);
    }

    // onnxruntime-web が探しに行く .wasm のベースパスを指定
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/";

    // 写真撮影時
    captureButton.addEventListener("click", async () => {
        // ONNXモデル推論
        try {
            const results = await inferOnnxModel(video, canvas);
            console.log(results);
        } catch (error) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", error);
        }
    });
}
main();
