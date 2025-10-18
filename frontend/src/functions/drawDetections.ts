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

    // スタイルを設定
    const boxColor = "#ffffff";
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 5;

    detections.forEach((det: Detection) => {
        const { x1, y1, width, height } = det;
        ctx.strokeRect(x1, y1, width, height);
    });
}
