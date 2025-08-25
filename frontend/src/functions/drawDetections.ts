import type { Detection } from "./inferOnnxModel";

export default function drawDetections(detections: Detection[], canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 共通設定
    ctx.font = "16px sans-serif";
    ctx.textBaseline = "top";

    detections.forEach((det: Detection) => {
        const { x1, y1, width, height, className, score } = det;

        const label = `${className} ${(score * 100).toFixed(1)}%`;

        // ボックスの色を決める (固定色でもクラスごとに変えてもOK)
        const boxColor = "green";

        // バウンディングボックスを描画
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, width, height);

        // // 点を中心に描画
        // const centerX = x1 + width / 2;
        // const centerY = y1 + height / 2;
        // const pointRadius = 3;
        // ctx.fillStyle = "red";
        // ctx.beginPath();
        // ctx.arc(centerX, centerY, pointRadius, 0, Math.PI * 2);
        // ctx.fill();

        // ラベル用の背景を描画
        const textWidth = ctx.measureText(label).width;
        const textHeight = 16; // フォントサイズに合わせる
        ctx.fillStyle = boxColor;
        ctx.fillRect(x1, y1, textWidth + 4, textHeight + 4);

        // テキストを描画
        ctx.fillStyle = "white";
        ctx.fillText(label, x1 + 2, y1 + 2);
    });
}
