import type { Detection } from "./inferOnnxModel.ts";

export default function drawDetections(
    detections: Detection[],
    ctx: CanvasRenderingContext2D | null,
    canvasWidth: number,
    canvasHeight: number
): void {
    if (!ctx) return;
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // スタイルを設定
    const boxColor = "#ffffff";
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 5;

    detections.forEach((det: Detection) => {
        const { x1, y1, x2, y2 } = det;
        ctx.strokeRect(
            canvasWidth * x1,
            canvasHeight * y1,
            canvasWidth * (x2 - x1),
            canvasHeight * (y2 - y1),
        );
    });
}
