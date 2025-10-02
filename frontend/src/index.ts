import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu"; // WebGPUのサイドエフェクトインポート

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;
const onnxLogo = document.getElementById("onnx-logo") as HTMLImageElement;
const cameraToggle = document.getElementById("camera-toggle") as HTMLButtonElement;
const cameraMenu = document.getElementById("camera-menu") as HTMLDivElement;

import inferOnnxModel from "./functions/inferOnnxModel.ts";
import drawDetections from "./functions/drawDetections.ts";
import createOnnxSession from "./functions/createOnnxSession.ts";
import setupCameraControls, { initializeCamera } from "./functions/setupCameraControls.ts";

import type { Detection } from "./functions/inferOnnxModel.ts";
import type { TYPE_COCO_CLASSES } from "./functions/inferOnnxModel.ts";

// 描画コンテキストの取得
const ctx = canvas.getContext("2d", { willReadFrequently: true }); // 読み取り用に最適化

// モデル推論用に一時的なcanvasを作成
const tempCanvas = document.createElement("canvas");
tempCanvas.style.display = "none"; // 非表示
// 一時canvasを640x640に設定
const tempCanvasWidth = 640;
const tempCanvasHeight = 640;
tempCanvas.width = tempCanvasWidth;
tempCanvas.height = tempCanvasHeight;

// 一時キャンバスの描画コンテキストを取得
const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

// onnxruntime-web が探しに行く .wasm のベースパスを固定バージョンで指定（latestを避ける）
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";

// 使用するONNXモデルURLの指定
const modelUrl = `${import.meta.env.BASE_URL}models/yolo11n.onnx`;

// ONNXセッションの作成
onnxLogo.style.display = "block"; // ローディングアイコンを表示
const session = await createOnnxSession(modelUrl);
onnxLogo.style.display = "none"; // ローディングアイコンを非表示

async function main(): Promise<void> {
    onnxLogo.style.display = "block"; // ローディングアイコンを表示
    // カメラコントロールのセットアップ（利用可能なカメラを分析して動的にメニューを生成）
    const cameraControls = await setupCameraControls({
        video,
        canvas,
        cameraToggle,
        cameraMenu,
        defaultCameraType: "environment",
    });

    // カメラの起動
    const stream = await initializeCamera(video, cameraControls.getCameraType(), (stream) => {
        console.log("カメラが初期化されました:", stream);
        // 初期化時のストリームを保存
        cameraControls.setCurrentStream(stream);
    });
    onnxLogo.style.display = "none"; // ローディングアイコンを非表示


    if (!stream) {
        throw new Error("カメラの初期化に失敗しました");
    }

    // canvas を video のネイティブ解像度に合わせる
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // canvas を前面表示
    canvas.style.zIndex = "2";

    // 抽出したいクラス名 (空配列なら全クラス対象)
    const targetClassNames: TYPE_COCO_CLASSES[] = ["person"];

    async function handleCapture(): Promise<void> {
        let results: Detection[] = [];
        try {
            // ONNXモデルの推論実行
            results = await inferOnnxModel(session, video, ctx, tempCanvas, tempCtx, targetClassNames);
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
    window.location.reload();
});
