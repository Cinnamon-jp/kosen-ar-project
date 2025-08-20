import * as ort from "onnxruntime-web";

export type Detection = {
    x: number; // ピクセル単位の中心x
    y: number; // ピクセル単位の中心y
    width: number; // ピクセル単位の幅
    height: number; // ピクセル単位の高さ
    x1: number; // 左
    y1: number; // 上
    x2: number; // 右
    y2: number; // 下
    score: number; // 確信度
    classId: number; // 最良クラスのインデックス
    className?: string; // 任意のラベル
};

export type PostprocessOptions = {
    scoreThreshold?: number; // NMS前にボックスを保持するための最小スコア
    iouThreshold?: number; // NMSのIoUしきい値
    maxDetections?: number; // 最終検出数の上限
    imgWidth?: number; // 元画像の幅（正規化出力用）
    imgHeight?: number; // 元画像の高さ（正規化出力用）
    classNames?: string[]; // 任意のクラス名
};

const defaultOptions: Required<Pick<PostprocessOptions,
    "scoreThreshold" | "iouThreshold" | "maxDetections"
>> = {
    scoreThreshold: 0.25,
    iouThreshold: 0.45,
    maxDetections: 100
};

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

function iou(a: Detection, b: Detection): number {
    const x1 = Math.max(a.x1, b.x1);
    const y1 = Math.max(a.y1, b.y1);
    const x2 = Math.min(a.x2, b.x2);
    const y2 = Math.min(a.y2, b.y2);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    const inter = w * h;
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
    const uni = areaA + areaB - inter + 1e-9;
    return inter / uni;
}

function nms(dets: Detection[], iouThr: number, maxDet: number): Detection[] {
    // スコアの降順でソート
    const order = dets
        .map((d, i) => ({ i, s: d.score }))
        .sort((a, b) => b.s - a.s)
        .map(o => o.i);

    const selected: Detection[] = [];
    const suppressed = new Array(dets.length).fill(false);

    for (let _k = 0; _k < order.length; _k++) {
        const i = order[_k];
        if (suppressed[i]) continue;
        const di = dets[i];
        selected.push(di);
        if (selected.length >= maxDet) break;
        for (let _l = _k + 1; _l < order.length; _l++) {
            const j = order[_l];
            if (suppressed[j]) continue;
            const dj = dets[j];
            if (iou(di, dj) > iouThr) suppressed[j] = true;
        }
    }
    return selected;
}

// YOLO系の出力を検出結果にデコード
// 対応形状: [1, C, N], [1, N, C], または [N, C]
export default function postprocess(
    results: ort.InferenceSession.OnnxValueMapType,
    options: PostprocessOptions = {}
): Detection[] {
    const { scoreThreshold, iouThreshold, maxDetections } = { ...defaultOptions, ...options };

    // 最初のテンソル出力を取得
    const firstKey = Object.keys(results)[0];
    if (!firstKey) return [];
    const output = results[firstKey];
    if (!output || !(output as ort.Tensor).data) return [];

    const tensor = output as ort.Tensor;
    const data = tensor.data as Float32Array | number[];
    const dims = tensor.dims;

    // 先頭のサイズ1次元を削除（例: [1, 1, N, C] -> [N, C]）
    const reducedDims = dims.filter((d, idx) => !(d === 1 && idx < dims.length - 2));

    // レイアウトを判定
    let numRows: number; // 予測数
    let numCols: number; // 1予測あたりの値（4 + クラス数 [+ たぶんobj]）
    let accessor: (row: number, col: number) => number;

    if (reducedDims.length === 3) {
        // Bが1（または削減済み）の [B, C, N] または [B, N, C] を想定
    const [, b, c] = reducedDims; // a==1 は上で除去済みだが汎用的に扱う
        // 列（特徴量）は小さい方（通常<=256）と仮定して向きを選択
        if (b <= c) {
            // 形状例: [1, C, N]
            numRows = c; // N
            numCols = b; // C
            const stride2 = c; // 最終次元のストライド
            accessor = (row, col) => (data as any)[col * stride2 + row];
        } else {
            // 形状例: [1, N, C]
            numRows = b; // N
            numCols = c; // C
            const stride2 = c;
            accessor = (row, col) => (data as any)[row * stride2 + col];
        }
    } else if (reducedDims.length === 2) {
        // [N, C]
        const [n, c] = reducedDims;
        numRows = n;
        numCols = c;
        const stride = c;
        accessor = (row, col) => (data as any)[row * stride + col];
    } else if (reducedDims.length === 1) {
        // 特殊ケース: N=1 の [C]
        numRows = 1;
        numCols = reducedDims[0];
        accessor = (_row, col) => (data as any)[col];
    } else {
        // 想定外
        return [];
    }

    if (numCols < 6) {
        // bboxとクラスを構成する列数が不足
        return [];
    }

    // クラスロジットにシグモイドが必要か判定
    const clsStart = 4; // YOLO: [cx, cy, w, h, (obj?), クラススコア...]
    // クラススコアを少数サンプルして概観
    let sampleMax = -Infinity, sampleMin = Infinity, samples = 0;
    const sampleRows = Math.min(numRows, 20);
    const clsCols = Math.max(1, numCols - clsStart);
    for (let r = 0; r < sampleRows; r++) {
        for (let c = 0; c < Math.min(clsCols, 6); c++) {
            const v = accessor(r, clsStart + c);
            sampleMax = Math.max(sampleMax, v);
            sampleMin = Math.min(sampleMin, v);
            samples++;
        }
    }
    const needSigmoid = !(sampleMin >= 0 && sampleMax <= 1);

    // インデックス4に明示的なオブジェクトネス列があるか検出
    // ヒューリスティック: 列数が6以上でクラス列が多くても確実ではない。
    // numCols - 5 >= 1 かつ分布が [0..1] を示す場合のみ列4をオブジェクトネスとみなす。
    let hasObj = false;
    if (numCols >= 6) {
        // 列4の値域を調査
        let oMin = Infinity, oMax = -Infinity;
        for (let r = 0; r < sampleRows; r++) {
            const v = accessor(r, 4);
            oMin = Math.min(oMin, v);
            oMax = Math.max(oMax, v);
        }
        // 列4が[0,1]に収まり、クラスロジットにシグモイドが必要そうならオブジェクトネスありと仮定
        hasObj = oMin >= 0 && oMax <= 1 && needSigmoid;
    }

    const imgW = options.imgWidth ?? 0;
    const imgH = options.imgHeight ?? 0;

    // ボックスが正規化（[0..1]）されているか確認
    let normBoxes = false;
    {
        let maxW = -Infinity, maxH = -Infinity;
        for (let r = 0; r < sampleRows; r++) {
            maxW = Math.max(maxW, accessor(r, 2));
            maxH = Math.max(maxH, accessor(r, 3));
        }
        if (imgW > 0 && imgH > 0) {
            normBoxes = maxW <= 1.5 && maxH <= 1.5; // 正規化されている可能性が高い
        }
    }

    const dets: Detection[] = [];
    for (let r = 0; r < numRows; r++) {
        const cxRaw = accessor(r, 0);
        const cyRaw = accessor(r, 1);
        const wRaw = accessor(r, 2);
        const hRaw = accessor(r, 3);

        // クラススコア
        const start = hasObj ? 5 : 4;
        const classesCount = Math.max(1, numCols - start);
        let bestId = -1;
        let bestScore = -Infinity;
        for (let c = 0; c < classesCount; c++) {
            let v = accessor(r, start + c);
            if (needSigmoid) v = sigmoid(v);
            if (v > bestScore) {
                bestScore = v;
                bestId = c;
            }
        }

        let score = bestScore;
        if (hasObj) {
            let obj = accessor(r, 4);
            if (needSigmoid) obj = sigmoid(obj);
            score = obj * bestScore;
        }

        if (score < (scoreThreshold ?? 0)) continue;

        // 必要に応じてボックスをスケーリング
        let cx = cxRaw, cy = cyRaw, w = wRaw, h = hRaw;
        if (normBoxes && imgW > 0 && imgH > 0) {
            cx *= imgW; cy *= imgH; w *= imgW; h *= imgH;
        }

        const x1 = cx - w / 2;
        const y1 = cy - h / 2;
        const x2 = cx + w / 2;
        const y2 = cy + h / 2;

        const det: Detection = {
            x: cx, y: cy, width: w, height: h,
            x1, y1, x2, y2,
            score,
            classId: bestId,
            className: options.classNames?.[bestId]
        };
        dets.push(det);
    }

    if (dets.length === 0) return dets;

    const finalDets = nms(dets, iouThreshold ?? 0.45, maxDetections ?? 100);
    return finalDets;
}

// 任意: 検出結果をキャンバスに描画
export function drawDetections(
    ctx: CanvasRenderingContext2D,
    detections: Detection[],
    color = "#00FF7F"
): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.font = "14px sans-serif";
    for (const d of detections) {
        const w = Math.max(0, d.x2 - d.x1);
        const h = Math.max(0, d.y2 - d.y1);
        ctx.beginPath();
        ctx.rect(d.x1, d.y1, w, h);
        ctx.stroke();
        const label = `${d.className ?? `cls ${d.classId}`} ${(d.score * 100).toFixed(1)}%`;
        const pad = 3;
        const metrics = ctx.measureText(label);
        const tw = metrics.width + pad * 2;
        const th = 16 + pad * 2;
        ctx.fillRect(d.x1, Math.max(0, d.y1 - th), tw, th);
        ctx.fillStyle = "#000";
        ctx.fillText(label, d.x1 + pad, Math.max(12, d.y1 - th + 12));
        ctx.fillStyle = color;
    }
    ctx.restore();
}

