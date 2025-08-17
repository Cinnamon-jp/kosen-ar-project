import { GET_video, GET_canvas } from "../index.ts";

export default function takePicture(): void {
    const video = GET_video();
    const canvas = GET_canvas();

    const context = canvas.getContext("2d");
    if (!context) {
        console.error("Canvasのコンテキストが取得できませんでした。");
        return;
    }

    // videoの実際の解像度をcanvasに設定
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // canvasにビデオの現在のフレームを描画
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 画像をダウンロードするためのリンクを作成
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `capture-${new Date().toISOString()}.png`; // ファイル名の生成
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
