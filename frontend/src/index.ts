import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu"; // WebGPUのサイドエフェクトインポート

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const captureButton = document.getElementById("capture") as HTMLButtonElement;
const onnxLogo = document.getElementById("onnx-logo") as HTMLImageElement;

import startCamera from "./functions/startCamera.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import drawDetections from "./functions/drawDetections.ts";
import createOnnxSession from "./functions/createOnnxSession.ts";

import type { Detection } from "./functions/inferOnnxModel.ts";

// バウンディングボックス描画コンテキストの取得
const ctx = canvas.getContext("2d", {
    desynchronized: true // レイテンシを抑えて連続描画に最適化
});

// モデル推論用に一時的なcanvasを作成
const tempCanvas = document.createElement("canvas");
tempCanvas.style.display = "none"; // 非表示
// 一時canvasを640x640に設定
tempCanvas.width = 640;
tempCanvas.height = 640;
// 一時キャンバスの描画コンテキストを取得
const tempCtx = tempCanvas.getContext("2d", {
    willReadFrequently: true, // 読み取り用に最適化
    desynchronized: true, // レイテンシを抑えて連続描画に最適化
    alpha: false // アルファ合成処理を省略して描画コストを下げる
});

// onnxruntime-web が探しに行く .wasm のベースパスを固定バージョンで指定（latestを避ける）
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";

// 使用するONNXモデルURLの指定
const modelUrl = `${import.meta.env.BASE_URL}models/yolo11n.onnx`;
// ONNXセッションの作成
onnxLogo.style.display = "block"; // ローディングアイコンを表示
const session = await createOnnxSession(modelUrl);
onnxLogo.style.display = "none"; // ローディングアイコンを非表示
// 抽出したいクラスID [0, 79]の整数 (空配列なら全クラス対象)
const targetClasses: number[] = [0];

async function main(): Promise<void> {
    // カメラの起動
    try {
        await startCamera(video);
    } catch (err) {
        console.error("カメラの読み込み中にエラーが発生しました:", err);
        throw err;
    }

    // canvas を video のネイティブ解像度に合わせる
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    async function inferModel(): Promise<void> {
        let results: Detection[] = [];
        try {
            // ONNXモデルの推論実行
            results = await inferOnnxModel(session, video, tempCanvas, tempCtx, targetClasses);
        } catch (err) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", err);
            throw err;
        }

        // バウンディングボックスの描画
        drawDetections(results, ctx, canvas.width, canvas.height);
    }

    while (true) {
        await inferModel();
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms待機
    }

    // 写真撮影時
    captureButton.addEventListener("click", inferModel);
    document.addEventListener("keydown", async (event) => {
        if (event.key === " ") {
            await inferModel();
        }
    });
}
main().catch((err) => {
    console.error(err);
    alert("エラーが発生しました。");
    window.location.reload();
});
