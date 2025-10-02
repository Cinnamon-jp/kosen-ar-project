import type { CameraType } from "./startCamera";
import startCamera, { analyzeAvailableCameras, startCameraByDeviceId } from "./startCamera";

interface CameraControlsOptions {
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
    cameraToggle: HTMLButtonElement;
    cameraMenu: HTMLDivElement;
    defaultCameraType?: CameraType;
}

// カメラメニューを動的に生成する関数（ラベルベース）
async function buildCameraMenu(cameraMenu: HTMLDivElement): Promise<Map<string, string>> {
    console.log('利用可能なカメラを分析中...');
    const availableCameras = await analyzeAvailableCameras();
    
    console.log('利用可能なカメラ:', availableCameras);
    
    // メニューをクリア
    cameraMenu.innerHTML = '';
    
    // deviceIdとラベルのマップ
    const deviceIdMap = new Map<string, string>();
    
    // 前面カメラを追加
    availableCameras.frontCameras.forEach((camera, index) => {
        const button = document.createElement('button');
        button.className = 'camera-option';
        const deviceKey = `front-${camera.deviceId}`;
        button.setAttribute('data-device-id', camera.deviceId);
        button.setAttribute('data-camera-type', 'user');
        
        // ラベルを表示（インデックス付き）
        const displayLabel = availableCameras.frontCameras.length > 1 
            ? `${camera.label || `前面カメラ ${index + 1}`}`
            : camera.label || '前面カメラ';
        
        button.textContent = displayLabel;
        cameraMenu.appendChild(button);
        deviceIdMap.set(deviceKey, camera.deviceId);
    });
    
    // 背面カメラを追加
    availableCameras.backCameras.forEach((camera, index) => {
        const button = document.createElement('button');
        button.className = 'camera-option';
        const deviceKey = `back-${camera.deviceId}`;
        button.setAttribute('data-device-id', camera.deviceId);
        button.setAttribute('data-camera-type', 'environment');
        
        // ラベルを表示（インデックス付き）
        const displayLabel = availableCameras.backCameras.length > 1 
            ? `${camera.label || `背面カメラ ${index + 1}`}`
            : camera.label || '背面カメラ';
        
        button.textContent = displayLabel;
        cameraMenu.appendChild(button);
        deviceIdMap.set(deviceKey, camera.deviceId);
    });
    
    const totalCameras = availableCameras.frontCameras.length + availableCameras.backCameras.length;
    console.log(`${totalCameras}個のカメラオプションを生成しました`);
    
    return deviceIdMap;
}

export default async function setupCameraControls(options: CameraControlsOptions): Promise<{
    getCurrentStream: () => MediaStream | null;
    getCurrentDeviceId: () => string | null;
    setCurrentStream: (stream: MediaStream | null) => void;
    setCurrentDeviceId: (deviceId: string | null) => void;
}> {
    const { video, canvas, cameraToggle, cameraMenu } = options;

    let currentDeviceId: string | null = null;
    let currentStream: MediaStream | null = null;

    // カメラメニューを動的に生成
    await buildCameraMenu(cameraMenu);

    // カメラオプションを再取得（動的に生成されたため）
    const cameraOptions = cameraMenu.querySelectorAll('.camera-option') as NodeListOf<HTMLButtonElement>;

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
            const selectedDeviceId = option.getAttribute("data-device-id");

            if (!selectedDeviceId) {
                console.error("デバイスIDが取得できませんでした");
                return;
            }

            // 既に選択されているカメラと同じ場合は何もしない
            if (selectedDeviceId === currentDeviceId) {
                cameraMenu.classList.add("hidden");
                return;
            }

            // カメラIDを更新
            currentDeviceId = selectedDeviceId;

            // 現在のストリームを停止
            if (currentStream) {
                currentStream.getTracks().forEach((track) => track.stop());
            }

            // 新しいカメラで再起動
            try {
                console.log(`デバイスID ${selectedDeviceId} を使用してカメラを起動`);
                await startCameraByDeviceId(video, selectedDeviceId);
                currentStream = video.srcObject as MediaStream;

                // ビデオのメタデータが読み込まれるのを待つ
                await new Promise<void>((resolve) => {
                    if (video.readyState >= 2) {
                        // すでに読み込まれている場合
                        resolve();
                    } else {
                        // メタデータの読み込みを待つ
                        const onLoadedMetadata = () => {
                            video.removeEventListener('loadedmetadata', onLoadedMetadata);
                            resolve();
                        };
                        video.addEventListener('loadedmetadata', onLoadedMetadata);
                    }
                });

                // canvasのサイズを更新（ビデオのメタデータ読み込み後）
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                console.log(`Canvas サイズを更新: ${canvas.width}x${canvas.height}`);

                // アクティブなオプションを更新
                cameraOptions.forEach((opt) => opt.classList.remove("active"));
                option.classList.add("active");

                console.log(`カメラを切り替えました: ${option.textContent}`);
            } catch (error) {
                console.error("カメラの切り替え中にエラーが発生しました:", error);
                alert("カメラの切り替えに失敗しました。");
            }

            // メニューを閉じる
            cameraMenu.classList.add("hidden");
        });
    });

    // デフォルトで最初のカメラオプションをアクティブに設定
    if (cameraOptions.length > 0) {
        cameraOptions[0].classList.add("active");
        currentDeviceId = cameraOptions[0].getAttribute("data-device-id");
    }

    // 現在のストリームとデバイスIDを取得・設定する関数を返す
    return {
        getCurrentStream: () => currentStream,
        getCurrentDeviceId: () => currentDeviceId,
        setCurrentStream: (stream: MediaStream | null) => {
            currentStream = stream;
        },
        setCurrentDeviceId: (deviceId: string | null) => {
            currentDeviceId = deviceId;
        },
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
