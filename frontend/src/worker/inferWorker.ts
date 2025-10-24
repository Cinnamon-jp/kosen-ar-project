import * as ort from "onnxruntime-web";
import createOnnxSession from "../functions/createOnnxSession";

export interface Detection {
    classId: number;
    score: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

let session: ort.InferenceSession;
const feedsCache: Record<string, ort.Tensor> = {};
let cachedFloatArray: Float32Array | null = null;
let cachedInputTensor: ort.Tensor | null = null;
const TENSOR_SIZE = 640 * 640 * 3;
const INV_255 = 1 / 255;
const PAD_COLOR = "rgb(114, 114, 114)";

const OFFSCREEN_SIZE = 640;
let offscreen: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;

self.addEventListener("message", async (e) => {
    const { type } = e.data;
    if (type === "init") {
        const { modelUrl } = e.data;
        session = await createOnnxSession(modelUrl);
        offscreen = new OffscreenCanvas(OFFSCREEN_SIZE, OFFSCREEN_SIZE);
        ctx = offscreen.getContext("2d", { willReadFrequently: true, alpha: false })!;
        postMessage({ type: "initDone" });
    }
    if (type === "infer") {
        const { bitmap, targetClasses } = e.data;
        // 塗りつぶしとリサイズ
        const videoWidth = bitmap.width;
        const videoHeight = bitmap.height;
        const aspect = videoWidth / videoHeight;
        let targetW = OFFSCREEN_SIZE;
        let targetH = OFFSCREEN_SIZE;
        if (aspect >= 1) {
            targetH = Math.round(videoHeight * (OFFSCREEN_SIZE / videoWidth));
        } else {
            targetW = Math.round(videoWidth * (OFFSCREEN_SIZE / videoHeight));
        }
        const x = (OFFSCREEN_SIZE - targetW) / 2;
        const y = (OFFSCREEN_SIZE - targetH) / 2;
        
        // パディング領域のみを塗りつぶす（最適化）
        ctx.fillStyle = PAD_COLOR;
        if (y > 0) {
            // 上下のパディング
            ctx.fillRect(0, 0, OFFSCREEN_SIZE, y); // 上
            ctx.fillRect(0, y + targetH, OFFSCREEN_SIZE, y); // 下
        }
        if (x > 0) {
            // 左右のパディング
            ctx.fillRect(0, 0, x, OFFSCREEN_SIZE); // 左
            ctx.fillRect(x + targetW, 0, x, OFFSCREEN_SIZE); // 右
        }
        
        ctx.drawImage(bitmap, 0, 0, videoWidth, videoHeight, x, y, targetW, targetH);
        // ImageBitmapを使用後に明示的に解放
        bitmap.close();
        const imageData = ctx.getImageData(0, 0, OFFSCREEN_SIZE, OFFSCREEN_SIZE);
        const data = imageData.data;
        if (!cachedFloatArray) cachedFloatArray = new Float32Array(TENSOR_SIZE);
        const floatArray = cachedFloatArray;
        const size = OFFSCREEN_SIZE * OFFSCREEN_SIZE;
        for (let i = 0; i < size; i++) {
            const idx = i * 4;
            floatArray[i] = data[idx] * INV_255;
            floatArray[size + i] = data[idx + 1] * INV_255;
            floatArray[2 * size + i] = data[idx + 2] * INV_255;
        }
        if (!cachedInputTensor) {
            cachedInputTensor = new ort.Tensor("float32", floatArray, [1, 3, OFFSCREEN_SIZE, OFFSCREEN_SIZE]);
        }
        feedsCache[session.inputNames[0]] = cachedInputTensor;
        const results = await session.run(feedsCache);
        // postprocess
        const tensor = results[session.outputNames[0]] as ort.Tensor;
        const attrs = tensor.dims[2];
        const outData = tensor.data as Float32Array;
        const detections: Detection[] = [];
        for (let i = 0; outData[attrs * i + 4] > 0.1; i++) {
            const base = attrs * i;
            const x1 = outData[base + 0];
            const y1 = outData[base + 1];
            const x2 = outData[base + 2];
            const y2 = outData[base + 3];
            const score = outData[base + 4];
            const classId = outData[base + 5];
            // convert scale
            const padX = (OFFSCREEN_SIZE - targetW) / 2;
            const padY = (OFFSCREEN_SIZE - targetH) / 2;
            const nx1 = (x1 - padX) / targetW;
            const ny1 = (y1 - padY) / targetH;
            const nx2 = (x2 - padX) / targetW;
            const ny2 = (y2 - padY) / targetH;
            detections.push({ classId, score, x1: nx1, y1: ny1, x2: nx2, y2: ny2 });
        }
        // filter classes
        const result =
            targetClasses.length > 0 ? detections.filter((d) => targetClasses.includes(d.classId)) : detections;
        postMessage({ type: "inferResult", detections: result });
    }
});
