const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;
const image = document.getElementById("image") as HTMLImageElement; // debug

import startCamera from "./functions/startCamera.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import postprocess from "./functions/postprocess.ts";
import drawDetections from "./functions/drawDetections.ts";

// const ONNX_MODEL_URL = "http://localhost:3000/models/yolo11n.onnx";

async function main(): Promise<void> {

    // カメラの起動
    try {
        await startCamera(video);
    } catch (error) {
        console.error("カメラの読み込み中にエラーが発生しました:", error);
    }

    // 写真撮影時
    captureButton.addEventListener("click", async () => {
        // ONNXモデル推論
        try {
            const results = await inferOnnxModel(image, canvas); // debug: imageを使用
            console.log("ONNXモデルの推論結果:", results);

            // 推論結果の後処理
            const detections = postprocess(results);
            console.log("後処理後結果:", detections);

            // 検出結果をキャンバスに描画
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height); // キャンバスをクリア
                drawDetections(ctx, detections);
                canvas.style.zIndex = "2"; // キャンバスを最前面に
                console.log("検出結果をキャンバスに描画しました");
            }
        } catch (error) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", error);
        }


    });
}
main();