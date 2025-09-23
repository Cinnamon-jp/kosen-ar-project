export default async function startCamera(video: HTMLVideoElement): Promise<void> {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    let maxWidth: number | undefined
    let maxHeight: number | undefined

    // 1) 初回ストリームで最大解像度を取得
    try {
        const initialConstraints: MediaStreamConstraints = isMobile
            ? { video: { facingMode: { ideal: "environment" } } }
            : { video: true }
        const initialStream = await navigator.mediaDevices.getUserMedia(initialConstraints)
        const track = initialStream.getVideoTracks()[0]
        const caps = track.getCapabilities()
        maxWidth = caps.width?.max ?? undefined
        maxHeight = caps.height?.max ?? undefined
        track.stop()
    } catch (err) {
        console.warn("カメラ初期化に失敗。デフォルト解像度にフォールバックします。", err)
    }

    // 2) 取得した解像度情報で再リクエスト or フォールバック
    const videoConstraints: any = {}
    if (maxWidth) videoConstraints.width = { ideal: maxWidth }
    if (maxHeight) videoConstraints.height = { ideal: maxHeight }
    if (isMobile) videoConstraints.facingMode = { ideal: "environment" }

    let stream: MediaStream
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
    } catch {
        console.warn("解像度指定なしで再試行します。")
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
    }

    // 3) ビデオ再生
    video.srcObject = stream
    try {
        await video.play()
    } catch (err) {
        console.error("ビデオの再生に失敗しました。", err)
    }
}
