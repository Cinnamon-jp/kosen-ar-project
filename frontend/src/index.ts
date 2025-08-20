const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;

import startCamera from "./functions/startCamera.ts";
import takePicture from "./functions/takePicture.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import postprocess from "./functions/postprocess.ts";

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
            const results = await inferOnnxModel(video, canvas);
            const detections = postprocess(results);

            console.log("推論結果:", detections);
        } catch (error) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", error);
        }


    });
}
main();