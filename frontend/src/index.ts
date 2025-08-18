const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;

// セッター関数
export const GET_video = (): HTMLVideoElement => video;
export const GET_canvas = (): HTMLCanvasElement => canvas;
export const GET_captureButton = (): HTMLButtonElement => captureButton;

import startCamera from "./functions/startCamera.ts";
import takePicture from "./functions/takePicture.ts";

const ONNX_MODEL_URL = "http://localhost:3000/models/yolo11n.onnx";

try {
    startCamera();
} catch (error) {
    console.error("カメラまたはモデルの読み込み中にエラーが発生しました:", error);
}

captureButton.addEventListener("click", takePicture);
