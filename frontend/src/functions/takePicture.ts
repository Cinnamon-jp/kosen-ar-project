export default function takePicture(
    video: HTMLVideoElement,
    imgContainer: HTMLDivElement
): void {
    // ビューポートとビデオのサイズを取得
    const viewportWidth = imgContainer.offsetWidth;
    const viewportHeight = imgContainer.offsetHeight;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // ビューポートとビデオのアスペクト比を計算
    const viewportAspect = viewportWidth / viewportHeight;
    const videoAspect = videoWidth / videoHeight;

    // object-fit: cover のロジックを実装
    // ビデオのどの部分が実際に表示されているかを計算
    let srcX = 0;
    let srcY = 0;
    let srcWidth = videoWidth;
    let srcHeight = videoHeight;

    if (videoAspect > viewportAspect) {
        // ビデオの方が横長 → 左右がトリミングされる
        srcWidth = videoHeight * viewportAspect;
        srcX = (videoWidth - srcWidth) / 2;
    } else {
        // ビデオの方が縦長 → 上下がトリミングされる
        srcHeight = videoWidth / viewportAspect;
        srcY = (videoHeight - srcHeight) / 2;
    }

    // 一時的なキャンバスを作成（ビューポートのアスペクト比に合わせる）
    const tempCanvas = document.createElement("canvas");
    tempCanvas.style.display = "none"; // 非表示
    tempCanvas.width = viewportWidth;
    tempCanvas.height = viewportHeight;

    const tempCtx = tempCanvas.getContext("2d", {});
    if (!tempCtx) throw new Error("一時キャンバスのコンテキストが取得できませんでした");

    // object-fit: cover でトリミングされた部分のみをキャンバスに描画
    tempCtx.drawImage(
        video,
        srcX, srcY, srcWidth, srcHeight,  // ソース（ビデオから切り取る範囲）
        0, 0, viewportWidth, viewportHeight  // デスティネーション（キャンバス全体）
    );

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

        // 画面表示と同じ座標系で描画（スケール変換不要）
        tempCtx.drawImage(img, x, y, width, height);
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
