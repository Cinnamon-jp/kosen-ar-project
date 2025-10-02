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

// 利用可能なすべてのカメラを分析する関数（外部から呼び出し可能）
export async function analyzeAvailableCameras(): Promise<AvailableCameras> {
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

    return {
        hasUser: frontCameras.length > 0,
        hasEnvironment: backCameras.length > 0,
        hasTelephoto,
        hasWideAngle,
        hasUltraWide,
        backCameras,
        frontCameras
    };
}

// すべてのカメラデバイスの情報を取得する関数
async function getAllCameraDevices(): Promise<CameraDeviceInfo[]> {
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

    return cameraInfos;
}

// 利用可能なすべての背面カメラを取得する関数
async function getAvailableBackCameras(): Promise<CameraDeviceInfo[]> {
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
    }

    // 1) 指定されたカメラで解像度を取得
    try {
        const constraints: MediaTrackConstraints = {};
        
        if (selectedDeviceId) {
            constraints.deviceId = { exact: selectedDeviceId };
            console.log(`デバイスID ${selectedDeviceId} を使用してカメラを初期化します`);
        } else {
            constraints.facingMode = { ideal: 'environment' };
            console.log('デフォルトの背面カメラを使用します');
        }

        const testStream = await navigator.mediaDevices.getUserMedia({
            video: constraints
        });
        const testTrack = testStream.getVideoTracks()[0];
        const testCaps = testTrack.getCapabilities();
        maxWidth = testCaps.width?.max;
        maxHeight = testCaps.height?.max;
        
        console.log('選択されたカメラの能力:', testCaps);
        console.log('使用中のカメラ:', testTrack.label);
        
        testTrack.stop();
    } catch (errTest) {
        console.warn("指定されたカメラの初期化に失敗。フォールバックします。", errTest);
        
        // フォールバック: 背面カメラで再試行
        try {
            const envStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } }
            });
            const envTrack = envStream.getVideoTracks()[0];
            const envCaps = envTrack.getCapabilities();
            maxWidth = envCaps.width?.max;
            maxHeight = envCaps.height?.max;
            envTrack.stop();
            selectedDeviceId = undefined; // デバイスIDをリセット
        } catch (errEnv) {
            console.warn("背面カメラの初期化に失敗。前面カメラを試行します。", errEnv);
            // 前面カメラで解像度を取得
            try {
                const userStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "user" } }
                });
                const userTrack = userStream.getVideoTracks()[0];
                const userCaps = userTrack.getCapabilities();
                maxWidth = userCaps.width?.max;
                maxHeight = userCaps.height?.max;
                userTrack.stop();
            } catch (errUser) {
                console.warn("前面カメラの初期化にも失敗。デフォルト解像度にフォールバックします。", errUser);
            }
        }
    }

    // 2) 解像度制約を組み立て
    const videoConstraints: MediaTrackConstraints = {};
    
    if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId };
        console.log(`最終的なストリーム取得にデバイスID ${selectedDeviceId} を使用`);
    } else {
        videoConstraints.facingMode = { ideal: 'environment' };
        console.log('最終的なストリーム取得にfacingMode: environmentを使用');
    }
    
    if (maxWidth) videoConstraints.width = { ideal: maxWidth };
    if (maxHeight) videoConstraints.height = { ideal: maxHeight };

    // 3) 指定されたカメラでストリーム取得
    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
        });
        console.log('カメラストリームの取得に成功');
    } catch (errStream) {
        console.warn("指定されたカメラの取得に失敗。フォールバックします。", errStream);
        
        // フォールバック: 背面カメラで再試行
        try {
            const fallbackConstraints: MediaTrackConstraints = {
                facingMode: { ideal: "environment" }
            };
            if (maxWidth) fallbackConstraints.width = { ideal: maxWidth };
            if (maxHeight) fallbackConstraints.height = { ideal: maxHeight };
            
            stream = await navigator.mediaDevices.getUserMedia({
                video: fallbackConstraints
            });
            console.log('フォールバック（背面カメラ）でストリーム取得に成功');
        } catch (errEnvStream) {
            console.warn("背面カメラの取得に失敗。前面カメラを試行します。", errEnvStream);
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "user" } }
                });
                console.log('フォールバック（前面カメラ）でストリーム取得に成功');
            } catch (errUserStream) {
                console.warn("前面カメラの取得にも失敗。解像度指定なしで再試行します。", errUserStream);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                console.log('フォールバック（デフォルト）でストリーム取得に成功');
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
