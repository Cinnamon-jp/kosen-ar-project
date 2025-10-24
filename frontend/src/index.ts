// HTML要素の取得
const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const imgContainer = document.getElementById("img-container") as HTMLDivElement;
const captureButton = document.getElementById("capture-button") as HTMLButtonElement;
const onnxLogo = document.getElementById("onnx-logo") as HTMLImageElement;

// 関数のインポート
import startCamera from "./functions/startCamera.ts";
// 推論を実行する Web Worker
const inferWorker = new Worker(new URL("./worker/inferWorker.ts", import.meta.url), { type: "module" });
import drawDetections from "./functions/drawDetections.ts";
import animate from "./functions/animate.ts";
import takePicture from "./functions/takePicture.ts";

// 型のインポート
import type { Detection } from "./functions/inferOnnxModel.ts";

async function main(): Promise<void> {
    const ctx = canvas.getContext("2d", {});

    // ONNXモデル用 Web Worker を初期化
    const modelUrl = `${import.meta.env.BASE_URL}models/yolo11n_half.onnx`;
    onnxLogo.style.display = "block";
    await new Promise<void>((resolve) => {
        inferWorker.onmessage = (e: MessageEvent) => {
            if (e.data.type === "initDone") resolve();
        };
        inferWorker.postMessage({ type: "init", modelUrl });
    });
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
            const bitmap = await createImageBitmap(video);
            results = await new Promise<Detection[]>((resolve) => {
                inferWorker.onmessage = (e: MessageEvent) => {
                    if (e.data.type === "inferResult") resolve(e.data.detections);
                };
                inferWorker.postMessage({ type: "infer", bitmap, targetClasses }, [bitmap]);
            });
            drawDetections(results, ctx, canvas.width, canvas.height);
        } catch (err) {
            console.error("ONNXモデルの推論中にエラーが発生しました:", err);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}
main().catch((err) => {
    console.error(err);
    alert(`エラーが発生しました。\n${err.message}`);
    window.location.reload();
});
