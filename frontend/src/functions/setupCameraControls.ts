import type { CameraType } from "./startCamera";
import startCamera from "./startCamera";

interface CameraControlsOptions {
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
    cameraToggle: HTMLButtonElement;
    cameraMenu: HTMLDivElement;
    cameraOptions: NodeListOf<HTMLButtonElement>;
    defaultCameraType?: CameraType;
}

export default function setupCameraControls(options: CameraControlsOptions): {
    getCurrentStream: () => MediaStream | null;
    getCameraType: () => CameraType;
} {
    const { video, canvas, cameraToggle, cameraMenu, cameraOptions, defaultCameraType = "environment" } = options;

    let cameraType: CameraType = defaultCameraType;
    let currentStream: MediaStream | null = null;

    // カメラ切り替えメニューの表示/非表示
    cameraToggle.addEventListener("click", () => {
        cameraMenu.classList.toggle("hidden");
    });

    // メニュー外をクリックしたら閉じる
    document.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!cameraToggle.contains(target) && !cameraMenu.contains(target)) {
            cameraMenu.classList.add("hidden");
        }
    });

    // カメラ選択オプションのクリックイベント
    cameraOptions.forEach((option) => {
        option.addEventListener("click", async () => {
            const selectedCamera = option.getAttribute("data-camera") as CameraType;

            // 既に選択されているカメラと同じ場合は何もしない
            if (selectedCamera === cameraType) {
                cameraMenu.classList.add("hidden");
                return;
            }

            // カメラタイプを更新
            cameraType = selectedCamera;

            // 現在のストリームを停止
            if (currentStream) {
                currentStream.getTracks().forEach((track) => track.stop());
            }

            // 新しいカメラで再起動
            try {
                await startCamera(video, cameraType);
                currentStream = video.srcObject as MediaStream;

                // canvasのサイズを更新
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // アクティブなオプションを更新
                cameraOptions.forEach((opt) => opt.classList.remove("active"));
                option.classList.add("active");

                console.log(`カメラを切り替えました: ${selectedCamera}`);
            } catch (error) {
                console.error("カメラの切り替え中にエラーが発生しました:", error);
                alert("カメラの切り替えに失敗しました。");
            }

            // メニューを閉じる
            cameraMenu.classList.add("hidden");
        });
    });

    // デフォルトのカメラオプションをアクティブに設定
    const defaultOption = document.querySelector(`[data-camera="${cameraType}"]`) as HTMLButtonElement;
    if (defaultOption) {
        defaultOption.classList.add("active");
    }

    // 現在のストリームとカメラタイプを取得する関数を返す
    return {
        getCurrentStream: () => currentStream,
        getCameraType: () => cameraType,
    };
}

// カメラストリームを初期化する関数
export async function initializeCamera(
    video: HTMLVideoElement,
    cameraType: CameraType,
    onStreamReady?: (stream: MediaStream) => void
): Promise<MediaStream | null> {
    try {
        await startCamera(video, cameraType);
        const stream = video.srcObject as MediaStream;
        
        if (onStreamReady) {
            onStreamReady(stream);
        }
        
        return stream;
    } catch (error) {
        console.error("カメラの読み込み中にエラーが発生しました:", error);
        return null;
    }
}
