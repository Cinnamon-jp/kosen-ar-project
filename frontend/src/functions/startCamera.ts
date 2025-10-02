export type CameraType = 'environment' | 'user' | 'telephoto' | 'wide-angle' | 'ultra-wide';

// 拡張されたMediaTrackCapabilities（zoom等の実験的機能を含む）
interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
    zoom?: {
        max?: number;
        min?: number;
        step?: number;
    };
    focusDistance?: {
        max?: number;
        min?: number;
        step?: number;
    };
}

// カメラデバイスの情報を格納
export interface CameraDeviceInfo {
    deviceId: string;
    label: string;
    facingMode?: string;
    capabilities?: ExtendedMediaTrackCapabilities;
}

// 利用可能なカメラの情報
export interface AvailableCameras {
    hasUser: boolean;
    hasEnvironment: boolean;
    hasTelephoto: boolean;
    hasWideAngle: boolean;
    hasUltraWide: boolean;
    backCameras: CameraDeviceInfo[];
    frontCameras: CameraDeviceInfo[];
}

// カメラ情報のキャッシュ
let cameraDevicesCache: CameraDeviceInfo[] | null = null;
let cameraAnalysisCache: AvailableCameras | null = null;

// キャッシュをクリアする関数（必要に応じて外部から呼び出し可能）
export function clearCameraCache(): void {
    cameraDevicesCache = null;
    cameraAnalysisCache = null;
    console.log('カメラキャッシュをクリアしました');
}

// 利用可能なすべてのカメラを分析する関数（外部から呼び出し可能）
export async function analyzeAvailableCameras(): Promise<AvailableCameras> {
    // キャッシュがある場合はそれを返す
    if (cameraAnalysisCache) {
        console.log('キャッシュされたカメラ分析結果を使用');
        return cameraAnalysisCache;
    }

    console.log('カメラを分析中...');
    const allCameras = await getAllCameraDevices();
    
    const backCameras = allCameras.filter(info => 
        info.facingMode === 'environment' || 
        info.label.toLowerCase().includes('back') ||
        info.label.toLowerCase().includes('rear') ||
        (!info.facingMode && !info.label.toLowerCase().includes('front') && !info.label.toLowerCase().includes('user'))
    );
    
    const frontCameras = allCameras.filter(info => 
        info.facingMode === 'user' || 
        info.label.toLowerCase().includes('front') ||
        info.label.toLowerCase().includes('user')
    );

    // 望遠カメラの有無を判定
    const hasTelephoto = backCameras.some(camera =>
        camera.label.toLowerCase().includes('telephoto') ||
        camera.label.toLowerCase().includes('tele') ||
        camera.label.toLowerCase().includes('望遠')
    ) || backCameras.length >= 2;

    // 広角カメラの有無を判定
    const hasWideAngle = backCameras.some(camera =>
        camera.label.toLowerCase().includes('wide') ||
        camera.label.toLowerCase().includes('広角') ||
        camera.label.toLowerCase().includes('main')
    ) || backCameras.length >= 1;

    // 超広角カメラの有無を判定
    const hasUltraWide = backCameras.some(camera =>
        camera.label.toLowerCase().includes('ultra') ||
        camera.label.toLowerCase().includes('超広角')
    ) || backCameras.length >= 3;

    const result: AvailableCameras = {
        hasUser: frontCameras.length > 0,
        hasEnvironment: backCameras.length > 0,
        hasTelephoto,
        hasWideAngle,
        hasUltraWide,
        backCameras,
        frontCameras
    };

    // 結果をキャッシュ
    cameraAnalysisCache = result;
    console.log('カメラ分析結果をキャッシュしました');

    return result;
}

// すべてのカメラデバイスの情報を取得する関数
async function getAllCameraDevices(): Promise<CameraDeviceInfo[]> {
    // キャッシュがある場合はそれを返す
    if (cameraDevicesCache) {
        console.log('キャッシュされたカメラデバイス情報を使用');
        return cameraDevicesCache;
    }

    console.log('カメラデバイス情報を取得中...');

    // まず、権限を取得するために一度カメラにアクセス
    try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        tempStream.getTracks().forEach(track => track.stop());
    } catch (err) {
        console.warn('カメラ権限の取得に失敗:', err);
    }

    // デバイスを列挙（権限取得後なのでラベルが取得できる）
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    console.log('利用可能なすべてのカメラ:', videoDevices.map(d => ({ 
        label: d.label, 
        id: d.deviceId 
    })));

    // 各カメラの能力を取得
    const cameraInfos: CameraDeviceInfo[] = [];
    
    for (const device of videoDevices) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: device.deviceId } }
            });
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as ExtendedMediaTrackCapabilities;
            const settings = track.getSettings();
            
            cameraInfos.push({
                deviceId: device.deviceId,
                label: device.label,
                facingMode: settings.facingMode,
                capabilities: capabilities
            });
            
            console.log(`カメラ "${device.label}" の情報:`, {
                facingMode: settings.facingMode,
                zoom: capabilities.zoom,
                focusDistance: capabilities.focusDistance,
                width: capabilities.width,
                height: capabilities.height
            });
            
            track.stop();
        } catch (err) {
            console.warn(`カメラ "${device.label}" の情報取得に失敗:`, err);
        }
    }

    // 結果をキャッシュ
    cameraDevicesCache = cameraInfos;
    console.log('カメラデバイス情報をキャッシュしました');

    return cameraInfos;
}

// 利用可能なすべての背面カメラを取得する関数
async function getAvailableBackCameras(): Promise<CameraDeviceInfo[]> {
    // キャッシュがある場合は直接フィルタリング
    if (cameraAnalysisCache) {
        console.log('キャッシュから背面カメラ情報を取得');
        return cameraAnalysisCache.backCameras;
    }

    const allCameras = await getAllCameraDevices();
    
    // 背面カメラのみをフィルタリング
    return allCameras.filter(info => 
        info.facingMode === 'environment' || 
        info.label.toLowerCase().includes('back') ||
        info.label.toLowerCase().includes('rear') ||
        (!info.facingMode && !info.label.toLowerCase().includes('front'))
    );
}

// カメラタイプに基づいてデバイスを選択
async function selectCameraDevice(
    cameraType: CameraType,
    backCameras: CameraDeviceInfo[]
): Promise<string | undefined> {
    if (backCameras.length === 0) {
        console.warn('背面カメラが見つかりません');
        return undefined;
    }

    console.log(`カメラタイプ "${cameraType}" の選択を試みます`);
    console.log('利用可能な背面カメラ:', backCameras.map(c => c.label));

    // ラベルによる識別を試みる
    if (cameraType === 'telephoto') {
        const telephoto = backCameras.find(camera =>
            camera.label.toLowerCase().includes('telephoto') ||
            camera.label.toLowerCase().includes('tele') ||
            camera.label.toLowerCase().includes('望遠')
        );
        if (telephoto) {
            console.log('ラベルから望遠カメラを選択:', telephoto.label);
            return telephoto.deviceId;
        }
        
        // ラベルで見つからない場合、zoom能力で判断
        // 最大ズームが大きいカメラを望遠として選択
        const sortedByZoom = backCameras
            .filter(c => c.capabilities?.zoom?.max)
            .sort((a, b) => (b.capabilities!.zoom!.max || 0) - (a.capabilities!.zoom!.max || 0));
        
        if (sortedByZoom.length > 0 && sortedByZoom[0].capabilities?.zoom?.max! > 1) {
            console.log('ズーム能力から望遠カメラを選択:', sortedByZoom[0].label);
            return sortedByZoom[0].deviceId;
        }
        
        // 複数ある場合は2番目のカメラを望遠として扱う
        if (backCameras.length >= 2) {
            console.log('2番目のカメラを望遠として選択:', backCameras[1].label);
            return backCameras[1].deviceId;
        }
    } else if (cameraType === 'wide-angle') {
        const wideAngle = backCameras.find(camera =>
            camera.label.toLowerCase().includes('wide') ||
            camera.label.toLowerCase().includes('広角') ||
            camera.label.toLowerCase().includes('main')
        );
        if (wideAngle) {
            console.log('ラベルから広角カメラを選択:', wideAngle.label);
            return wideAngle.deviceId;
        }
        
        // 最初のカメラ（通常メインカメラ）を広角として扱う
        if (backCameras.length > 0) {
            console.log('メインカメラを広角として選択:', backCameras[0].label);
            return backCameras[0].deviceId;
        }
    } else if (cameraType === 'ultra-wide') {
        const ultraWide = backCameras.find(camera =>
            camera.label.toLowerCase().includes('ultra') ||
            camera.label.toLowerCase().includes('超広角')
        );
        if (ultraWide) {
            console.log('ラベルから超広角カメラを選択:', ultraWide.label);
            return ultraWide.deviceId;
        }
        
        // 複数ある場合は3番目のカメラを超広角として扱う
        if (backCameras.length >= 3) {
            console.log('3番目のカメラを超広角として選択:', backCameras[2].label);
            return backCameras[2].deviceId;
        }
    }

    return undefined;
}

// デバイスIDを直接指定してカメラを起動する関数
export async function startCameraByDeviceId(
    video: HTMLVideoElement,
    deviceId: string
): Promise<void> {
    console.log(`デバイスID ${deviceId} でカメラを起動`);

    const videoConstraints: MediaTrackConstraints = {
        deviceId: { exact: deviceId }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
        });

        const track = stream.getVideoTracks()[0];
        console.log('カメラストリームの取得に成功');
        console.log('使用中のカメラ:', track.label);
        console.log('カメラ設定:', track.getSettings());

        video.srcObject = stream;
        await video.play();
    } catch (error) {
        console.error('指定されたデバイスIDでカメラの起動に失敗:', error);
        throw error;
    }
}

export default async function startCamera(
    video: HTMLVideoElement,
    cameraType: CameraType
): Promise<void> {
    let maxWidth: number | undefined;
    let maxHeight: number | undefined;
    let selectedDeviceId: string | undefined;

    // ユーザーカメラ（前面）の場合
    if (cameraType === 'user') {
        const facingMode = 'user';
        
        try {
            const testStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facingMode } }
            });
            const testTrack = testStream.getVideoTracks()[0];
            const testCaps = testTrack.getCapabilities();
            maxWidth = testCaps.width?.max;
            maxHeight = testCaps.height?.max;
            
            console.log('前面カメラの能力:', testCaps);
            console.log('使用中のカメラ:', testTrack.label);
            
            testTrack.stop();
        } catch (err) {
            console.warn('前面カメラの初期化に失敗:', err);
        }

        const videoConstraints: MediaTrackConstraints = {
            facingMode: { ideal: facingMode }
        };
        
        if (maxWidth) videoConstraints.width = { ideal: maxWidth };
        if (maxHeight) videoConstraints.height = { ideal: maxHeight };

        const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
        });

        const track = stream.getVideoTracks()[0];
        console.log('最終的に使用するカメラ:', track.label);
        console.log('カメラ設定:', track.getSettings());

        video.srcObject = stream;
        await video.play();
        return;
    }

    // 背面カメラの場合: すべての背面カメラを取得
    const backCameras = await getAvailableBackCameras();
    
    if (backCameras.length === 0) {
        console.warn('背面カメラが見つかりません。デフォルトで試行します。');
    } else {
        // カメラタイプに応じてデバイスを選択
        selectedDeviceId = await selectCameraDevice(cameraType, backCameras);
        console.log(`選択されたデバイスID: ${selectedDeviceId || 'なし'}`);
    }

    // 解像度制約を組み立て
    const videoConstraints: MediaTrackConstraints = {};
    
    if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId };
        console.log(`デバイスID ${selectedDeviceId} を使用してストリームを取得`);
    } else {
        videoConstraints.facingMode = { ideal: 'environment' };
        console.log('facingMode: environmentを使用してストリームを取得');
    }
    
    // キャッシュから解像度情報を取得（可能な場合）
    if (selectedDeviceId && backCameras.length > 0) {
        const cameraInfo = backCameras.find(cam => cam.deviceId === selectedDeviceId);
        if (cameraInfo?.capabilities) {
            maxWidth = cameraInfo.capabilities.width?.max;
            maxHeight = cameraInfo.capabilities.height?.max;
            console.log(`キャッシュから解像度を取得: ${maxWidth}x${maxHeight}`);
        }
    }
    
    if (maxWidth) videoConstraints.width = { ideal: maxWidth };
    if (maxHeight) videoConstraints.height = { ideal: maxHeight };

    // 指定されたカメラでストリーム取得
    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
        });
        console.log('カメラストリームの取得に成功');
    } catch (errStream) {
        console.error("指定されたカメラの取得に失敗:", errStream);
        console.warn("selectedDeviceIdを保持したままフォールバックを試行");
        
        // フォールバック: デバイスIDを維持しつつ、解像度制約を緩和
        if (selectedDeviceId) {
            try {
                // 解像度制約なしで再試行
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: selectedDeviceId } }
                });
                console.log('解像度制約なしでストリーム取得に成功');
            } catch (errRetry) {
                console.error("デバイスID指定でも失敗:", errRetry);
                // 最終フォールバック: デフォルト背面カメラ
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: "environment" } }
                    });
                    console.log('フォールバック（デフォルト背面カメラ）でストリーム取得に成功');
                } catch (errFinal) {
                    console.error("すべてのフォールバックが失敗:", errFinal);
                    // 最後の手段：制約なし
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    console.log('制約なしでストリーム取得に成功');
                }
            }
        } else {
            // selectedDeviceIdがない場合のフォールバック
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } }
                });
                console.log('フォールバック（背面カメラ）でストリーム取得に成功');
            } catch (errEnvStream) {
                console.warn("背面カメラの取得に失敗。制約なしで再試行:", errEnvStream);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                console.log('制約なしでストリーム取得に成功');
            }
        }
    }

    // 使用中のカメラ情報をログ出力
    const track = stream.getVideoTracks()[0];
    console.log('最終的に使用するカメラ:', track.label);
    console.log('カメラ設定:', track.getSettings());

    // 4) ビデオ再生
    video.srcObject = stream;
    try {
        await video.play();
    } catch (err) {
        console.error("ビデオの再生に失敗しました。", err);
    }
}
