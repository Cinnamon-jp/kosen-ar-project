export default function takePicture(
    video: HTMLVideoElement,
): void {
    // 一時的なキャンバスを作成
    const tempCanvas = document.createElement("canvas");
    tempCanvas.style.display = "none"; // 非表示
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const tempCtx = tempCanvas.getContext("2d", {});
    if (!tempCtx) throw new Error("一時キャンバスのコンテキストが取得できませんでした");

    // フレームを一時キャンバスに描画
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // 画像データをBlob形式で取得
    tempCanvas.toBlob((blob) => {
        if (!blob) throw new Error("画像データの取得に失敗しました");

        // aタグを作成してダウンロード
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const filename = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // メモリ解放
        URL.revokeObjectURL(url);
    }, "image/jpeg");
}