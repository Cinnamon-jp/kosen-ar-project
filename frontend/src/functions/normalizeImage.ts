import * as tf from "@tensorflow/tfjs";

import { GET_video } from "../index.ts";

export function tensorizeImage(targetWidth: number = 224, targetHeight: number = 224): tf.Tensor4D {
    const video = GET_video();

    // HTML要素（CanvasまたはVideo）からピクセルデータを取得し、float型に変換
    const imgTensor = tf.browser.fromPixels(video).toFloat();

    // 指定されたターゲットサイズにリサイズ
    const resized = tf.image.resizeBilinear(imgTensor, [
        targetHeight,
        targetWidth
    ]);

    // ピクセル値を0-1の範囲に正規化
    const normalized = resized.div(255);

    // バッチ次元を追加して4Dテンソルにする (例: [1, height, width, channels])
    return normalized.expandDims(0); // モデルの入力形式に合わせるため
}
