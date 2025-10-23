export default function takePicture(
    video: HTMLVideoElement,
    imgContainer: HTMLDivElement
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

    // imgContainer内の画像を取得
    const images = imgContainer.getElementsByTagName("img");

    // 各画像を描画
    for (const img of images) {
        // img の transform から位置を取得
        const computedStyle = getComputedStyle(img);
        const transform = computedStyle.transform;
        let x = 0;
        let y = 0;
        if (transform && transform !== 'none') {
            const match = transform.match(/matrix\(([^)]+)\)/);
            if (match) {
                const values = match[1].split(',').map(val => parseFloat(val.trim()));
                if (values.length === 6) {
                    x = values[4];
                    y = values[5];
                }
            }
        }
        const width = img.width;
        const height = img.height;

        // videoのサイズとimgContainerのサイズの比率を考慮して描画位置を調整
        const scaleX = tempCanvas.width / imgContainer.offsetWidth;
        const scaleY = tempCanvas.height / imgContainer.offsetHeight;

        tempCtx.drawImage(img, x * scaleX, y * scaleY, width * scaleX, height * scaleY);
    }

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
