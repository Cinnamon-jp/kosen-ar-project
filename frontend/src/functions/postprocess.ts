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

const defaultOptions: Required<Pick<PostprocessOptions, "scoreThreshold" | "iouThreshold" | "maxDetections">> = {
    scoreThreshold: 0.25,
    iouThreshold: 0.45,
    maxDetections: 100
};

// YOLO系の出力を検出結果にデコード
// 対応形状: [1, C, N], [1, N, C], [N, C], [C, N], 1次元([C])
export default function postprocess(
    results: ort.InferenceSession.OnnxValueMapType,
    options: PostprocessOptions = {}
): Detection[] {
    const { scoreThreshold, iouThreshold, maxDetections } = { ...defaultOptions, ...options };

    // 最初の出力テンソル取得
    const firstKey = Object.keys(results)[0];
    if (!firstKey) return [];
    const output = results[firstKey];
    if (!output || !(output as ort.Tensor).data) return [];

    const tensor = output as ort.Tensor;
    const data = tensor.data as Float32Array | number[];
    const dims = tensor.dims.slice();

    if (!dims.length) return [];

    // 先頭の連続する1(Batch)を除去（例: [1,84,8400] -> [84,8400], [1,1,84,8400] -> [84,8400]）
    while (dims.length > 1 && dims[0] === 1) dims.shift();

    let numRows = 0; // 予測数
    let numCols = 0; // 各予測の特徴量数
    let accessor: (row: number, col: number) => number;

    if (dims.length === 3) {
        // 想定: [B(=1除去済), C, N] または [B, N, C] だったがバッチ除去後 [C, N] になるはずなので
        // ここに来るのは想定外（多次元）。安全策として終了
        return [];
    } else if (dims.length === 2) {
        const [d0, d1] = dims;
        // 小さい方を特徴量(C)とみなすヒューリスティック（典型: 84 vs 8400）
        // ただし d0 が十分小さく(>=6 && <=2048) かつ d1 > d0 の場合 d0=cols
        const d0IsCols = d0 >= 6 && d0 <= 2048 && d1 > d0;
        const d1IsCols = d1 >= 6 && d1 <= 2048 && d0 > d1;
        if (d0IsCols || (!d1IsCols && d0 <= d1)) {
            // 形状 [C, N]
            numCols = d0;
            numRows = d1;
            const stride = d1; // 列優先ではなく行優先の再考: data配列はrow-major想定
            // 元配列は ONNX (C,N) でもフラットは C*N の行優先(Cが最初次元)
            accessor = (row, col) => (data as any)[col * numRows + row];
        } else {
            // 形状 [N, C]
            numRows = d0;
            numCols = d1;
            const stride = numCols;
            accessor = (row, col) => (data as any)[row * stride + col];
        }
    } else if (dims.length === 1) {
        numRows = 1;
        numCols = dims[0];
        accessor = (_row, col) => (data as any)[col];
    } else {
        // 4次元以上は未対応
        return [];
    }

    if (numCols < 6) return []; // bbox + 最低限クラス列が無い

    // クラス列開始位置（基本: 4, obj信号があれば 5）
    const clsStartBase = 4;

    // クラススコア分布サンプリング
    const sampleRows = Math.min(numRows, 20);
    let sampleMin = Infinity;
    let sampleMax = -Infinity;

    // 一旦 obj ありなし不明なので列4も後で調査
    for (let r = 0; r < sampleRows; r++) {
        for (let c = clsStartBase; c < Math.min(numCols, clsStartBase + 8); c++) {
            const v = accessor(r, c);
            if (v < sampleMin) sampleMin = v;
            if (v > sampleMax) sampleMax = v;
        }
    }
    const needSigmoid = !(sampleMin >= 0 && sampleMax <= 1);

    // オブジェクトネス列(4)判定
    let hasObj = false;
    if (numCols >= 6) {
        let oMin = Infinity,
            oMax = -Infinity;
        for (let r = 0; r < sampleRows; r++) {
            const v = accessor(r, 4);
            if (v < oMin) oMin = v;
            if (v > oMax) oMax = v;
        }
        // obj列が[0,1] に収まっていて、クラスがシグモイド必要そうなら obj と判断
        hasObj = oMin >= 0 && oMax <= 1 && needSigmoid;
    }

    const clsStart = hasObj ? 5 : 4;
    const imgW = options.imgWidth ?? 0;
    const imgH = options.imgHeight ?? 0;

    // ボックス正規化判定
    let normBoxes = false;
    if (imgW > 0 && imgH > 0) {
        let maxW = -Infinity,
            maxH = -Infinity;
        for (let r = 0; r < sampleRows; r++) {
            const w = accessor(r, 2);
            const h = accessor(r, 3);
            if (w > maxW) maxW = w;
            if (h > maxH) maxH = h;
        }
        normBoxes = maxW <= 1.5 && maxH <= 1.5;
    }

    const dets: Detection[] = [];
    const minScore = scoreThreshold;

    for (let r = 0; r < numRows; r++) {
        const cxRaw = accessor(r, 0);
        const cyRaw = accessor(r, 1);
        const wRaw = accessor(r, 2);
        const hRaw = accessor(r, 3);

        // クラス探索
        const classesCount = Math.max(1, numCols - clsStart);
        let bestId = -1;
        let bestScore = -Infinity;
        for (let c = 0; c < classesCount; c++) {
            let v = accessor(r, clsStart + c);
            if (needSigmoid) v = sigmoid(v);
            if (v > bestScore) {
                bestScore = v;
                bestId = c;
            }
        }
        if (bestId < 0) continue;

        let finalScore = bestScore;
        if (hasObj) {
            let obj = accessor(r, 4);
            if (needSigmoid) obj = sigmoid(obj);
            finalScore *= obj;
        }
        if (finalScore < minScore) continue;

        // 座標スケーリング
        let cx = cxRaw,
            cy = cyRaw,
            w = wRaw,
            h = hRaw;
        if (normBoxes && imgW > 0 && imgH > 0) {
            cx *= imgW;
            cy *= imgH;
            w *= imgW;
            h *= imgH;
        }

        let x1 = cx - w / 2;
        let y1 = cy - h / 2;
        let x2 = cx + w / 2;
        let y2 = cy + h / 2;

        if (imgW > 0 && imgH > 0) {
            // 画像境界にクリップ
            x1 = Math.max(0, Math.min(imgW, x1));
            y1 = Math.max(0, Math.min(imgH, y1));
            x2 = Math.max(0, Math.min(imgW, x2));
            y2 = Math.max(0, Math.min(imgH, y2));
            w = Math.max(0, x2 - x1);
            h = Math.max(0, y2 - y1);
            cx = x1 + w / 2;
            cy = y1 + h / 2;
        }

        dets.push({
            x: cx,
            y: cy,
            width: w,
            height: h,
            x1,
            y1,
            x2,
            y2,
            score: finalScore,
            classId: bestId,
            className: options.classNames?.[bestId]
        });
    }

    if (!dets.length) return dets;
    return nms(dets, iouThreshold, maxDetections);
}

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
        .map((o) => o.i);

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
