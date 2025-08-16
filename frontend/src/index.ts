const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;

// セッター関数
export const GET_video = (): HTMLVideoElement => video;
export const GET_canvas = (): HTMLCanvasElement => canvas;
export const GET_captureButton = (): HTMLButtonElement => captureButton;

// 関数インポート
import startCamera from "./functions/startCamera.ts";
import takePicture from "./functions/takePicture.ts";

document.addEventListener("DOMContentLoaded", () => {
    startCamera();
    captureButton.addEventListener("click", takePicture);
});
