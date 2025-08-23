import type { Detection } from "./postprocess.ts";

// 任意: 検出結果をキャンバスに描画
export default function drawDetections(ctx: CanvasRenderingContext2D, detections: Detection[], color = "#00FF7F"): void {
    if (!ctx || !detections || detections.length === 0) return;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "top";

    const pad = 4;
    const boxColor = color;
    const textColor = "#000";

    for (const d of detections) {
        // Normalize coordinates
        const x1 = Math.min(d.x1, d.x2);
        const y1 = Math.min(d.y1, d.y2);
        const x2 = Math.max(d.x1, d.x2);
        const y2 = Math.max(d.y1, d.y2);
        const w = x2 - x1;
        const h = y2 - y1;
        if (w <= 0 || h <= 0) continue;

        // Draw rectangle
        ctx.strokeStyle = boxColor;
        ctx.beginPath();
        ctx.rect(x1, y1, w, h);
        ctx.stroke();

        // Build label
        const score = typeof d.score === "number" && isFinite(d.score) ? (d.score * 100).toFixed(1) : "?";
        const cls = d.className ?? `cls ${d.classId}`;
        const label = `${cls} ${score}%`;

        // Measure and draw label background
        const metrics = ctx.measureText(label);
        const textW = metrics.width;
        const textH = (metrics.actualBoundingBoxAscent ?? 10) + (metrics.actualBoundingBoxDescent ?? 4);
        const bgW = textW + pad * 2;
        const bgH = textH + pad * 2;

        // Prefer placing label above box; if not enough space, place inside
        let labelY = y1 - bgH;
        if (labelY < 0) labelY = y1;

        ctx.fillStyle = boxColor;
        ctx.fillRect(x1, labelY, bgW, bgH);

        // Draw text
        ctx.fillStyle = textColor;
        ctx.fillText(label, x1 + pad, labelY + pad);
    }

    ctx.restore();
}
