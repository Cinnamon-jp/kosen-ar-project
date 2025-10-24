// HTML要素の取得
const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const imgContainer = document.getElementById("img-container") as HTMLDivElement;
const captureButton = document.getElementById("capture-button") as HTMLButtonElement;
const onnxLogo = document.getElementById("onnx-logo") as HTMLImageElement;

// 関数のインポート
import startCamera from "./functions/startCamera.ts";
import calculateVideoDisplayArea from "./functions/calculateVideoDisplayArea.ts";
// 推論を実行する Web Worker
const inferWorker = new Worker(new URL("./worker/inferWorker.ts", import.meta.url), { type: "module" });
import drawDetections from "./functions/drawDetections.ts";
import animate from "./functions/animate.ts";
import takePicture from "./functions/takePicture.ts";

// 型のインポート
import type { Detection } from "./functions/inferOnnxModel.ts";

// canvas と imgContainer を video の実際の表示領域に合わせる関数
function syncElementsWithVideo(): void {
    // video の実際の表示領域を計算（黒い帯を除いた部分）
    const displayArea = calculateVideoDisplayArea(video);
    
    if (displayArea.width === 0 || displayArea.height === 0) {
        // ビデオがまだロードされていない場合は何もしない
        return;
    }
    
    // canvas のネイティブ解像度を video のネイティブ解像度に設定
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // canvas の表示サイズと位置を video の実際の表示領域に合わせる
    canvas.style.width = `${displayArea.width}px`;
    canvas.style.height = `${displayArea.height}px`;
    canvas.style.left = `${displayArea.left}px`;
    canvas.style.top = `${displayArea.top}px`;
    
    // imgContainer の表示サイズと位置も video の実際の表示領域に合わせる
    imgContainer.style.width = `${displayArea.width}px`;
    imgContainer.style.height = `${displayArea.height}px`;
    imgContainer.style.left = `${displayArea.left}px`;
    imgContainer.style.top = `${displayArea.top}px`;
}

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

    // canvas と imgContainer を video の表示サイズに合わせる（カメラ起動後に実行）
    syncElementsWithVideo();

    // ウィンドウリサイズ時にもサイズを更新
    window.addEventListener("resize", () => {
        syncElementsWithVideo();
    });

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
