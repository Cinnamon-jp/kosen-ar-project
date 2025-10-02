export type CameraType = 'environment' | 'user' | 'telephoto' | 'wide-angle' | 'ultra-wide';

export default async function startCamera(
    video: HTMLVideoElement,
    cameraType: CameraType
): Promise<void> {
    let maxWidth: number | undefined;
    let maxHeight: number | undefined;
    let selectedDeviceId: string | undefined;

    // 利用可能なカメラデバイスを列挙
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    console.log('利用可能なカメラ:', videoDevices.map(d => ({ label: d.label, id: d.deviceId })));

    // カメラタイプに応じてデバイスを選択
    if (cameraType === 'telephoto') {
        // 望遠カメラを検索
        const telephoto = videoDevices.find(device =>
            device.label.toLowerCase().includes('telephoto') ||
            device.label.toLowerCase().includes('tele') ||
            device.label.toLowerCase().includes('zoom') ||
            device.label.toLowerCase().includes('望遠')
        );
        if (telephoto) {
            selectedDeviceId = telephoto.deviceId;
            console.log('望遠カメラを選択:', telephoto.label);
        }
    } else if (cameraType === 'wide-angle') {
        // 広角カメラを検索
        const wideAngle = videoDevices.find(device =>
            device.label.toLowerCase().includes('wide') ||
            device.label.toLowerCase().includes('広角')
        );
        if (wideAngle) {
            selectedDeviceId = wideAngle.deviceId;
            console.log('広角カメラを選択:', wideAngle.label);
        }
    } else if (cameraType === 'ultra-wide') {
        // 超広角カメラを検索
        const ultraWide = videoDevices.find(device =>
            device.label.toLowerCase().includes('ultra') ||
            device.label.toLowerCase().includes('超広角')
        );
        if (ultraWide) {
            selectedDeviceId = ultraWide.deviceId;
            console.log('超広角カメラを選択:', ultraWide.label);
        }
    }

    // 1) 指定されたカメラで解像度を取得
    const facingMode = cameraType === 'user' ? 'user' : 'environment';
    
    try {
        const constraints: MediaTrackConstraints = {
            facingMode: { ideal: facingMode }
        };
        
        if (selectedDeviceId) {
            constraints.deviceId = { exact: selectedDeviceId };
            delete constraints.facingMode; // deviceIdを指定する場合はfacingModeを削除
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
    } else {
        videoConstraints.facingMode = { ideal: facingMode };
    }
    
    if (maxWidth) videoConstraints.width = { ideal: maxWidth };
    if (maxHeight) videoConstraints.height = { ideal: maxHeight };

    // 3) 指定されたカメラでストリーム取得
    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
        });
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
        } catch (errEnvStream) {
            console.warn("背面カメラの取得に失敗。前面カメラを試行します。", errEnvStream);
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "user" } }
                });
            } catch (errUserStream) {
                console.warn("前面カメラの取得にも失敗。解像度指定なしで再試行します。", errUserStream);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
