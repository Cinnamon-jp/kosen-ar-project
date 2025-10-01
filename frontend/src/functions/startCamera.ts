export default async function startCamera(video: HTMLVideoElement): Promise<void> {
    let maxWidth: number | undefined;
    let maxHeight: number | undefined;

    // 1) 一度背面カメラをリクエストして解像度を取得
    try {
        const envStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } }
        });
        const envTrack = envStream.getVideoTracks()[0];
        const envCaps = envTrack.getCapabilities();
        maxWidth = envCaps.width?.max;
        maxHeight = envCaps.height?.max;
        envTrack.stop();
    } catch (errEnv) {
        console.warn("背面カメラの初期化に失敗。前面カメラを試行します。", errEnv);
        // 1-2) 背面がダメなら前面で解像度を取得
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

    // 2) 解像度制約を組み立て
    const videoConstraints: MediaTrackConstraints = {};
    if (maxWidth) videoConstraints.width = { ideal: maxWidth };
    if (maxHeight) videoConstraints.height = { ideal: maxHeight };

    // 3) 背面カメラでストリーム取得、失敗したら前面カメラ、さらに失敗したら解像度指定なし
    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { ...videoConstraints, facingMode: { ideal: "environment" } }
        });
    } catch (errEnvStream) {
        console.warn("背面カメラの取得に失敗。前面カメラを試行します。", errEnvStream);
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { ...videoConstraints, facingMode: { ideal: "user" } }
            });
        } catch (errUserStream) {
            console.warn("前面カメラの取得にも失敗。解像度指定なしで再試行します。", errUserStream);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
    }

    // 4) ビデオ再生
    video.srcObject = stream;
    try {
        await video.play();
    } catch (err) {
        console.error("ビデオの再生に失敗しました。", err);
    }
}
