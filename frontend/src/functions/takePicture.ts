export default function takePicture(video: HTMLVideoElement, threeCanvas: HTMLCanvasElement): void {
    // 一時的なcanvasを作成
    const tempCanvas = document.createElement("canvas");
    tempCanvas.style.display = "none";

    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
        throw new Error("一時キャンバスのコンテキストが取得できませんでした");
    }

    // videoの内容を一時canvasに描画
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Three.jsのcanvasの内容を一時canvasに重ねる
    tempCtx.drawImage(threeCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

    // 一時canvasをJPEGとして書き出す (品質: 0.92)
    tempCanvas.toBlob((blob) => {
        if (!blob) {
            throw new Error("JPEGファイルの生成に失敗しました");
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "snapshot.jpg";
        link.click();
        URL.revokeObjectURL(link.href);
    }, "image/jpeg", 0.92);
}
