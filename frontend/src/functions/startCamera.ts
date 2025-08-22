export default async function startCamera(video: HTMLVideoElement): Promise<void> {
    // 初回ストリームで最大解像度を取得
    const initialStream = await navigator.mediaDevices.getUserMedia({
        video: true
    });
    const track = initialStream.getVideoTracks()[0];
    const caps = track.getCapabilities();
    const maxWidth = caps.width?.max;
    const maxHeight = caps.height?.max;
    track.stop();

    // 取得した最大解像度を ideal に指定して再リクエスト
    const constraints: MediaStreamConstraints = {
        video: {
            ...(maxWidth ? { width: { ideal: maxWidth } } : {}),
            ...(maxHeight ? { height: { ideal: maxHeight } } : {})
        }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    video.srcObject = stream;
    await video.play();
}
