import type { Detection } from "./inferOnnxModel.ts";

// 日付を格納
const now = new Date();
const date = now.getDate();

const BASE_URL = `${import.meta.env.BASE_URL}`;

// 画像URLの配列(日付でURLを指定)
const pictureUrls: [string, string] = [
    `${BASE_URL}assets/kosensai-logo.png`,
    `${BASE_URL}assets/kosensai-date-${date}.png`
];

// 衝突判定用のボックス型定義
interface CollisionBox {
    x: number;
    y: number;
    width: number;
    height: number;
}


// HTMLに画像を追加する関数（幅のみ指定しアスペクト比を維持）
function addPictureToHtml(
    pictureUrl: string,
    container: HTMLDivElement,
    width: number,
    positionX: number,
    positionY: number,
): HTMLImageElement {
    const img = new Image()
    img.src = pictureUrl
    img.style.position = 'absolute'
    img.style.left = `${positionX}px`
    img.style.top = `${positionY}px`

    // 画像がロードされたらアスペクト比に応じて高さを設定
    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight
        img.width = width
        img.height = width / ratio
    }

    container.appendChild(img)
    return img
}

// 画像を任意の方向に平行移動させる関数
function moveImage(
    img: HTMLImageElement, // 動かす画像要素
    imgContainer: HTMLDivElement, // 画像を囲むコンテナ要素
    vector: [number, number],
    collisionBoxes: CollisionBox[], // 衝突判定ボックス
): [number, number] {
    // 現在の画像の座標を取得
    let x = img.offsetLeft;
    let y = img.offsetTop;

    // コンテナのサイズを取得
    const containerWidth = imgContainer.offsetWidth;
    const containerHeight = imgContainer.offsetHeight;

    // 画像のサイズを取得
    const imageWidth = img.width;
    const imageHeight = img.height;

    // 画像の移動（ベクトルの大きさで移動量を調整）
    let dx = vector[0];
    let dy = vector[1];
    x += dx;
    y += dy;

    // 壁との衝突判定と跳ね返り
    if (x < 0) {
        x = 0; // 壁にめり込まないように位置を補正
        dx = -dx;
    } else if (x + imageWidth > containerWidth) {
        x = containerWidth - imageWidth; // 壁にめり込まないように位置を補正
        dx = -dx;
    }
    if (y < 0) {
        y = 0; // 壁にめり込まないように位置を補正
        dy = -dy;
    } else if (y + imageHeight > containerHeight) {
        y = containerHeight - imageHeight; // 壁にめり込まないように位置を補正
        dy = -dy;
    }

    // 衝突判定ボックスとの衝突判定と跳ね返り
    for (const box of collisionBoxes) {
        // 衝突判定
        if (
            x < box.x + box.width &&
            x + imageWidth > box.x &&
            y < box.y + box.height &&
            y + imageHeight > box.y
        ) {
            // 画像とボックスの中心座標
            const imgCenterX = x + imageWidth / 2;
            const imgCenterY = y + imageHeight / 2;
            const boxCenterX = box.x + box.width / 2;
            const boxCenterY = box.y + box.height / 2;

            // 中心間の距離
            const diffX = imgCenterX - boxCenterX;
            const diffY = imgCenterY - boxCenterY;

            // 重なりを計算
            const overlapX = (imageWidth / 2 + box.width / 2) - Math.abs(diffX);
            const overlapY = (imageHeight / 2 + box.height / 2) - Math.abs(diffY);

            // X方向の重なりの方がY方向の重なりより大きい場合、Y方向の速度を反転（横の辺との衝突）
            if (overlapX > overlapY) {
                if (diffY < 0) { // 画像の中心がボックスの中心より上
                    y -= overlapY; // 上に押し出す
                } else {
                    y += overlapY; // 下に押し出す
                }
                dy = -dy;
            } else {
                // Y方向の重なりの方が大きい、または等しい場合、X方向の速度を反転（縦の辺との衝突）
                if (diffX < 0) { // 画像の中心がボックスの中心より左
                    x -= overlapX; // 左に押し出す
                } else {
                    x += overlapX; // 右に押し出す
                }
                dx = -dx;
            }

            // 1つのボックスと衝突したらループを抜ける
            break;
        }
    }


    // 画像の位置を更新
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;

    return [dx, dy];
}

// メインの関数
export default function animate(
    imgContainer: HTMLDivElement,
    getDetections: () => Detection[],
): void {
    // 使用する画像を格納
    const logoImg = addPictureToHtml(pictureUrls[0], imgContainer, 100, 50, 50);
    const dateImg = addPictureToHtml(pictureUrls[1], imgContainer, 100, 150, 150);

    // 移動ベクトル (ベクトルの大きさが移動量になる)
    let logoVector: [number, number] = [5, 5];
    let dateVector: [number, number] = [6, 3];

    // アニメーションループ
    function tick() {
        const detections = getDetections();

        const collisionBoxes: CollisionBox[] = detections.map(d => ({
            x: d.x1 * imgContainer.offsetWidth,
            y: d.y1 * imgContainer.offsetHeight,
            width: (d.x2 - d.x1) * imgContainer.offsetWidth,
            height: (d.y2 - d.y1) * imgContainer.offsetHeight,
        }));

        logoVector = moveImage(logoImg, imgContainer, logoVector, collisionBoxes);
        dateVector = moveImage(dateImg, imgContainer, dateVector, collisionBoxes);
        requestAnimationFrame(tick);
    }
    tick();
}