// HTML要素の取得
const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const imgContainer = document.getElementById("img-container") as HTMLDivElement;
const captureButton = document.getElementById("capture-button") as HTMLButtonElement;
const onnxLogo = document.getElementById("onnx-logo") as HTMLImageElement;

// 関数のインポート
import startCamera from "./functions/startCamera.ts";
import animate from "./functions/animate.ts";
import takePicture from "./functions/takePicture.ts";
import createOnnxSession from "./functions/createOnnxSession.ts";
import inferOnnxModel from "./functions/inferOnnxModel.ts";

// 型のインポート
import type { Detection } from "./functions/inferOnnxModel.ts";
import type * as ort from "onnxruntime-web";

async function main(): Promise<void> {
    // ONNXモデルのセッションを初期化
    const modelUrl = `${import.meta.env.BASE_URL}models/yolo11n_half.onnx`;
    onnxLogo.style.display = "block";
    const session: ort.InferenceSession = await createOnnxSession(modelUrl);
    onnxLogo.style.display = "none";

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

    // 推論用の一時canvasを作成
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 640;
    tempCanvas.height = 640;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true, alpha: false });

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

    // 推論状態の管理
    let isInferring = false;
    let lastFrameTime = 0;
    const MIN_FRAME_INTERVAL = 33; // 約30fps（必要に応じて調整可能）

    // requestAnimationFrameを使用した推論ループ
    async function inferLoop() {
        const now = performance.now();

        // 前回のフレームから十分な時間が経過し、かつ推論中でない場合のみ実行
        if (now - lastFrameTime >= MIN_FRAME_INTERVAL && !isInferring) {
            lastFrameTime = now;
            isInferring = true;

            try {
                // メインスレッドで直接推論を実行
                const inferredResults = await inferOnnxModel(session, video, tempCanvas, tempCtx, targetClasses);
                results = inferredResults;
            } catch (err) {
                console.error("ONNXモデルの推論中にエラーが発生しました:", err);
            } finally {
                isInferring = false;
            }
        }

        requestAnimationFrame(inferLoop);
    }

    // ループ開始
    inferLoop();
}
main().catch((err) => {
    console.error(err);
    alert(`エラーが発生しました。\n${err.message}`);
    window.location.reload();
});
