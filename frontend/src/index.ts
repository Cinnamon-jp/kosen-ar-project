// HTML要素の取得
const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const imgContainer = document.getElementById("img-container") as HTMLDivElement;
const captureButton = document.getElementById("capture-button") as HTMLButtonElement;
const onnxLogo = document.getElementById("onnx-logo") as HTMLImageElement;

// 関数のインポート
import startCamera from "./functions/startCamera.ts";
import createOnnxSession from "./functions/createOnnxSession.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";
import drawDetections from "./functions/drawDetections.ts";
import animate from "./functions/animate.ts";
import takePicture from "./functions/takePicture.ts";

// 型のインポート
import type { Detection } from "./functions/inferOnnxModel.ts";

async function main(): Promise<void> {
    // バウンディングボックス描画コンテキストの取得
    const ctx = canvas.getContext("2d", {});

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
    
    // 使用するONNXモデルURLの指定
    const modelUrl = `${import.meta.env.BASE_URL}models/yolo11n_half.onnx`;
    // ONNXセッションの作成
    onnxLogo.style.display = "block"; // ローディングアイコンを表示
    const session = await createOnnxSession(modelUrl);
    onnxLogo.style.display = "none"; // ローディングアイコンを非表示
    // 抽出したいクラスID [0, 79]の整数 (空配列なら全クラス対象)
    const targetClasses: number[] = [0];

    // カメラの起動
    try {
        await startCamera(video);
    } catch (err) {
        console.error("カメラの読み込み中にエラーが発生しました:", err);
        throw err;
    }

    // canvas を video のネイティブ解像度に合わせる (カメラの起動後じゃないとダメ)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let results: Detection[] = []; // 推論結果を格納する配列
    // 最新の推論結果を返す関数
    function getDetections(): Detection[] {
        return results;
    }

    captureButton.addEventListener("click", () => {
        try {
            takePicture(video, imgContainer);
        } catch (err) {
            console.error("写真撮影中にエラーが発生しました:", err);
            throw err;
        }
    });

    // アニメーションの開始
    animate(imgContainer, getDetections);

    // 100msごとに推論と描画を繰り返す
    while (true) {
        try {
            // ONNXモデルの推論実行
            const startTime = performance.now();
            results = await inferOnnxModel(session, video, tempCanvas, tempCtx, targetClasses);
            const endTime = performance.now();
            console.log(`Inference time: ${(endTime - startTime).toFixed(2)} ms`);
            // バウンディングボックスの描画
            drawDetections(results, ctx, canvas.width, canvas.height);
        } catch (err) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", err);
            // throw err; // エラーが発生してループが止まるためコメントアウト
        }
        await new Promise((resolve) => setTimeout(resolve, 50)); // 100ms待機
    }
}
main().catch((err) => {
    console.error(err);
    alert(`エラーが発生しました。\n${err.message}`);
    window.location.reload();
});
