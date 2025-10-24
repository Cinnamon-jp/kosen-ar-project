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

    // 一時的なキャンバスを作成（高解像度で作成）
    // ビデオの実際の解像度をそのまま使用（カメラの高画質を保つ）
    const tempCanvas = document.createElement("canvas");
    tempCanvas.style.display = "none"; // 非表示
    
    // object-fit: cover でトリミングされた部分のサイズを計算
    // （ビューポートのアスペクト比を保ちつつ、ビデオの解像度を活かす）
    let outputWidth: number;
    let outputHeight: number;
    
    if (videoAspect > viewportAspect) {
        // ビデオの方が横長 → 高さを基準にする
        outputHeight = videoHeight;
        outputWidth = videoHeight * viewportAspect;
    } else {
        // ビデオの方が縦長 → 幅を基準にする
        outputWidth = videoWidth;
        outputHeight = videoWidth / viewportAspect;
    }
    
    tempCanvas.width = Math.round(outputWidth);
    tempCanvas.height = Math.round(outputHeight);

    const tempCtx = tempCanvas.getContext("2d", {
        alpha: false, // アルファチャンネル不要で高速化
        willReadFrequently: false
    });
    if (!tempCtx) throw new Error("一時キャンバスのコンテキストが取得できませんでした");

    // 画像補間の品質を最高に設定
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = "high";

    // object-fit: cover でトリミングされた部分のみをキャンバスに描画（高解像度で）
    tempCtx.drawImage(
        video,
        srcX, srcY, srcWidth, srcHeight,  // ソース（ビデオから切り取る範囲）
        0, 0, tempCanvas.width, tempCanvas.height  // デスティネーション（キャンバス全体）
    );

    // imgContainer内の画像を取得
    const images = imgContainer.getElementsByTagName("img");

    // ビューポートとキャンバスのスケール比を計算
    const scaleX = tempCanvas.width / viewportWidth;
    const scaleY = tempCanvas.height / viewportHeight;

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

        // 画面表示と同じ座標系で描画（スケール比を適用）
        tempCtx.drawImage(
            img,
            x * scaleX,
            y * scaleY,
            width * scaleX,
            height * scaleY
        );
    }

    // 画像データをBlob形式で取得（高品質JPEGで出力）
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
    }, "image/jpeg", 0.95); // JPEG品質を95%に設定
}
