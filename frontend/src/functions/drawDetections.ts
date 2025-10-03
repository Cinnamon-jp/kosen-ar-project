import type { Detection } from "./inferOnnxModel";

export default function drawDetections(
    detections: Detection[],
    ctx: CanvasRenderingContext2D | null,
    canvasWidth: number,
    canvasHeight: number
): void {
    if (!ctx) return;
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    detections.forEach((det: Detection) => {
        const { x1, y1, width, height } = det;

        // ボックスの色を決める (固定色でもクラスごとに変えてもOK)
        const boxColor = "#ffffff";

        // バウンディングボックスを描画
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 5;
        ctx.strokeRect(x1, y1, width, height);
    });
}
