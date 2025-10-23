import type * as OrtModule from "onnxruntime-web";
import { getOrtRuntime } from "./createOnnxSession.ts";

const feedsCache: Record<string, OrtModule.Tensor> = {};

const ort = getOrtRuntime();

// prettier-ignore
// const COCO_CLASSES = [
//     "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
//     "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
//     "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
//     "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
//     "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
//     "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
//     "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
//     "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
// ] as const;

// export type TYPE_COCO_CLASSES = (typeof COCO_CLASSES)[number]; // COCO_CLASSESのいずれかの文字列

// 検出結果のフォーマット (座標は 高さ=1 幅=1 としたときの画像内での割合)
export interface Detection {
    classId: number;
    score: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface Conversion {
    aspect: number;
    originalWidth: number;
    originalHeight: number;
    targetWidth: number;
    targetHeight: number;
}

// パフォーマンス最適化: Float32Arrayを再利用するためのキャッシュ
let cachedFloatArray: Float32Array | null = null;
// 入力Tensorを再利用するためのキャッシュ
let cachedInputTensor: OrtModule.Tensor | null = null;
const TENSOR_SIZE = 640 * 640 * 3; // 640x640のRGB画像

// パフォーマンス最適化: 定数を事前計算
const INV_255 = 1 / 255; // 除算を乗算に変換するための逆数
const PAD_COLOR = "rgb(114, 114, 114)"; // YOLO11の学習時に使われたパディングの色

export default async function inferOnnxModel(
    session: OrtModule.InferenceSession,
    video: HTMLVideoElement,
    tempCanvas: HTMLCanvasElement,
    tempCtx: CanvasRenderingContext2D | null,
    targetClasses: number[] // 抽出したいクラスID (空配列なら全クラス対象)
): Promise<Detection[]> {
    // 例外処理
    if (!tempCtx) throw new Error("Unable to get 2D context from canvas");

    // テンソルの作成、倍率の取得
    const [inputTensor, conversion] = preprocess(video, tempCanvas.width, tempCanvas.height, tempCtx);

    // 入力テンソルのフィード
    feedsCache[session.inputNames[0]] = inputTensor;

    // モデル推論実行
    const results = await session.run(feedsCache);

    // 検出結果の後処理
    const detections = postprocess(results, conversion, tempCanvas.width, tempCanvas.height);

    // 特定のクラス名のみ抽出
    if (targetClasses.length > 0) {
        return extractTargetClassName(detections, targetClasses);
    }
    return detections;
}

// 画像前処理: <video> 要素を受け取り、640x640にリサイズしてTensorと倍率を返す
function preprocess(
    video: HTMLVideoElement,
    tempCanvasWidth: number,
    tempCanvasHeight: number,
    tempCtx: CanvasRenderingContext2D
): [OrtModule.Tensor, Conversion] {
    // videoのサイズを設定
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    // 例外処理
    if (videoWidth === 0 || videoHeight === 0) {
        throw new Error("Video width or height is zero");
    }

    // アスペクト比の計算
    const aspect = videoWidth / videoHeight;

    // 640pxに収まるようにリサイズ後のサイズを計算 -> 整数に丸める
    // aspect >= 1 (横長) : aspect < 1 (縦長)
    const targetWidth: number =
        aspect >= 1 ? tempCanvasWidth : Math.round(videoWidth * (tempCanvasHeight / videoHeight));
    const targetHeight: number =
        aspect >= 1 ? Math.round(videoHeight * (tempCanvasWidth / videoWidth)) : tempCanvasHeight;

    // canvasを灰色で塗りつぶし (パディング部分)
    tempCtx.fillStyle = PAD_COLOR;
    tempCtx.fillRect(0, 0, tempCanvasWidth, tempCanvasHeight);

    // 描画先のx,y座標を計算 (中央寄せ)
    const targetX = (tempCanvasWidth - targetWidth) / 2;
    const targetY = (tempCanvasHeight - targetHeight) / 2;

    // videoをcanvasの中央に縮小描画
    // prettier-ignore
    tempCtx.drawImage(
        video,
        0, 0, // 切り出し開始位置
        videoWidth, videoHeight, // 切り出しサイズ
        targetX, targetY, // 描画先の座標 (中央寄せ)
        targetWidth, targetHeight // 描画先のサイズ
    );

    // ピクセルデータを取得
    const { data }: { data: Uint8ClampedArray } = tempCtx.getImageData(0, 0, tempCanvasWidth, tempCanvasHeight);
    const size = tempCanvasWidth * tempCanvasHeight;

    // パフォーマンス最適化: Float32Arrayを再利用
    if (cachedFloatArray === null) {
        cachedFloatArray = new Float32Array(TENSOR_SIZE);
    }
    const floatArray = cachedFloatArray;

    // パフォーマンス最適化: 二重ループを単一ループに変更 & 除算を乗算に変換
    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    for (let i = 0; i < size; i++) {
        const dataIndex = i * 4; // RGBA形式なので4倍
        floatArray[i] = data[dataIndex] * INV_255; // R (除算→乗算)
        floatArray[size + i] = data[dataIndex + 1] * INV_255; // G (除算→乗算)
        floatArray[2 * size + i] = data[dataIndex + 2] * INV_255; // B (除算→乗算)
    }

    // 拡大・縮小情報
    const conversion: Conversion = {
        aspect: aspect,
        originalWidth: videoWidth,
        originalHeight: videoHeight,
        targetWidth: targetWidth,
        targetHeight: targetHeight
    };

    // 入力Tensorの再利用
    if (!cachedInputTensor) {
        cachedInputTensor = new ort.Tensor("float32", floatArray, [1, 3, tempCanvasHeight, tempCanvasWidth]);
    }
    return [cachedInputTensor, conversion];
}

// モジュールレベル: i番目のボックスを取得する
function getBox(data: Float32Array, attrs: number, i: number): Detection {
    const base = attrs * i;
    const x1 = data[base + 0];
    const y1 = data[base + 1];
    const x2 = data[base + 2];
    const y2 = data[base + 3];
    const score = data[base + 4];
    const classId = data[base + 5];
    return { classId, score, x1, y1, x2, y2 };
}

// モジュールレベル: 検出結果を元画像サイズに変換する
function convertToOriginalScale(
    detection: Detection,
    conversion: Conversion,
    tempCanvasWidth: number,
    tempCanvasHeight: number
): Detection {
    const padX = (tempCanvasWidth - conversion.targetWidth) / 2;
    const padY = (tempCanvasHeight - conversion.targetHeight) / 2;
    const x1 = (detection.x1 - padX) / conversion.targetWidth;
    const y1 = (detection.y1 - padY) / conversion.targetHeight;
    const x2 = (detection.x2 - padX) / conversion.targetWidth;
    const y2 = (detection.y2 - padY) / conversion.targetHeight;
    return {
        classId: detection.classId,
        score: detection.score,
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2
    };
}

// 画像後処理: モデルの出力を受け取り、Detectionの配列を返す
function postprocess(
    results: OrtModule.InferenceSession.OnnxValueMapType,
    conversion: Conversion,
    tempCanvasWidth: number,
    tempCanvasHeight: number
): Detection[] {
    const tensor = results["output0"] as OrtModule.Tensor;
    const attrs = tensor.dims[2]; // 例: [1, 8400, 84], [1, 300, 6]
    const data = tensor.data as Float32Array; // 実際のデータが格納された1次元配列

    // スコアが 0.1 = 10% より大きいボックスを抽出
    let detections: Detection[] = [];
    for (let i = 0; data[attrs * i + 4] > 0.1; i++) {
        const box = getBox(data as Float32Array, attrs, i);
        const scaled = convertToOriginalScale(box, conversion, tempCanvasWidth, tempCanvasHeight);
        detections.push(scaled);
    }

    // モデルにNMSを内蔵しているので、追加のNMS処理は不要
    return detections;
}

// 指定されたクラス名の検出結果のみを抽出する関数
function extractTargetClassName(detections: Detection[], targetClasses: number[]): Detection[] {
    return detections.filter((detection) => targetClasses.includes(detection.classId));
}
