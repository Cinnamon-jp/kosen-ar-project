// object-fit: contain が適用された video 要素の実際の表示領域を計算する
export interface VideoDisplayArea {
    width: number;
    height: number;
    left: number;
    top: number;
}

export default function calculateVideoDisplayArea(
    video: HTMLVideoElement
): VideoDisplayArea {
    // ビデオ要素のコンテナサイズ（黒い帯を含む全体）
    const containerRect = video.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // ビデオのネイティブ解像度
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) {
        // ビデオがまだロードされていない場合
        return { width: 0, height: 0, left: 0, top: 0 };
    }

    // ビデオとコンテナのアスペクト比
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;

    // object-fit: contain のロジック
    if (videoAspect > containerAspect) {
        // ビデオの方が横長 → 幅を基準にする
        displayWidth = containerWidth;
        displayHeight = containerWidth / videoAspect;
    } else {
        // ビデオの方が縦長（または同じ） → 高さを基準にする
        displayHeight = containerHeight;
        displayWidth = containerHeight * videoAspect;
    }

    // 中央配置のための位置
    const left = (containerWidth - displayWidth) / 2;
    const top = (containerHeight - displayHeight) / 2;

    return {
        width: displayWidth,
        height: displayHeight,
        left,
        top
    };
}
