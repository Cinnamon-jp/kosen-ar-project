import type { CameraType } from "./startCamera";
import startCamera, { analyzeAvailableCameras } from "./startCamera";

interface CameraControlsOptions {
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
    cameraToggle: HTMLButtonElement;
    cameraMenu: HTMLDivElement;
    defaultCameraType?: CameraType;
}

// カメラタイプの表示名
const cameraTypeLabels: Record<CameraType, string> = {
    'environment': '背面カメラ',
    'user': '前面カメラ',
    'telephoto': '望遠カメラ',
    'wide-angle': '広角カメラ',
    'ultra-wide': '超広角カメラ'
};

// カメラメニューを動的に生成する関数
async function buildCameraMenu(cameraMenu: HTMLDivElement): Promise<CameraType[]> {
    console.log('利用可能なカメラを分析中...');
    const availableCameras = await analyzeAvailableCameras();
    
    console.log('利用可能なカメラ:', availableCameras);
    
    // メニューをクリア
    cameraMenu.innerHTML = '';
    
    // 利用可能なカメラタイプのリスト
    const availableTypes: CameraType[] = [];
    
    const backCameraCount = availableCameras.backCameras.length;
    
    // 前面カメラ
    if (availableCameras.hasUser) {
        availableTypes.push('user');
    }
    
    // 背面カメラが1つの場合：「背面カメラ」のみ表示（広角カメラとして表示しない）
    if (backCameraCount === 1) {
        availableTypes.push('environment');
    }
    // 背面カメラが2つの場合：「広角カメラ」と「望遠カメラ」を表示
    else if (backCameraCount === 2) {
        availableTypes.push('wide-angle');
        availableTypes.push('telephoto');
    }
    // 背面カメラが3つ以上の場合：「広角」「望遠」「超広角」を表示
    else if (backCameraCount >= 3) {
        availableTypes.push('wide-angle');
        availableTypes.push('telephoto');
        availableTypes.push('ultra-wide');
    }
    // 背面カメラがない場合（念のため）
    else if (availableCameras.hasEnvironment) {
        availableTypes.push('environment');
    }
    
    // メニュー項目を動的に生成
    availableTypes.forEach((type) => {
        const button = document.createElement('button');
        button.className = 'camera-option';
        button.setAttribute('data-camera', type);
        button.textContent = cameraTypeLabels[type];
        cameraMenu.appendChild(button);
    });
    
    console.log(`${availableTypes.length}個のカメラオプションを生成しました:`, availableTypes);
    
    return availableTypes;
}

export default async function setupCameraControls(options: CameraControlsOptions): Promise<{
    getCurrentStream: () => MediaStream | null;
    getCameraType: () => CameraType;
    setCurrentStream: (stream: MediaStream | null) => void;
}> {
    const { video, canvas, cameraToggle, cameraMenu, defaultCameraType = "environment" } = options;

    let cameraType: CameraType = defaultCameraType;
    let currentStream: MediaStream | null = null;

    // カメラメニューを動的に生成
    const availableTypes = await buildCameraMenu(cameraMenu);
    
    // デフォルトのカメラタイプが利用可能でない場合、最初の利用可能なタイプを使用
    if (!availableTypes.includes(cameraType) && availableTypes.length > 0) {
        cameraType = availableTypes[0];
        console.log(`デフォルトカメラが利用不可のため、${cameraType}を使用します`);
    }

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
    const defaultOption = cameraMenu.querySelector(`[data-camera="${cameraType}"]`) as HTMLButtonElement;
    if (defaultOption) {
        defaultOption.classList.add("active");
    }

    // 現在のストリームとカメラタイプを取得・設定する関数を返す
    return {
        getCurrentStream: () => currentStream,
        getCameraType: () => cameraType,
        setCurrentStream: (stream: MediaStream | null) => {
            currentStream = stream;
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
