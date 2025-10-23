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

// ベクトル用と初期位置用のランダムな数値を生成する関数（min～max を含む）
function getRandomNumber(
    min: number,
    max: number,
    isInteger: boolean = false
): number {
    if (isInteger) {
        // 整数の場合は min～max の範囲で包含
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    // 浮動小数点数の場合も上限を超えないよう調整
    const rand = Math.random() * (max - min) + min;
    return rand > max ? max : rand;
}

// 50%の確率で入力した数字の符号を反転する関数
function randomSign(num: number): number {
    return Math.random() < 0.5 ? -num : num;
}

// HTMLに画像を追加する関数（幅のみ指定しアスペクト比を維持）
function addPictureToHtml(
    pictureUrl: string,
    container: HTMLDivElement,
    width: number,
    positionX: number,
    positionY: number
): HTMLImageElement {
    const img = new Image();
    img.src = pictureUrl;
    img.style.position = "absolute";
    img.style.transform = `translate(${positionX}px, ${positionY}px)`;

    // 画像がロードされたらアスペクト比に応じて高さを設定
    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        img.width = width;
        img.height = width / ratio;
    };

    container.appendChild(img);
    return img;
}

// 画像の移動ロジックを計算する関数
function calculateImageMovement(
    currentX: number,
    currentY: number,
    vector: [number, number],
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
    collisionBoxes: CollisionBox[]
): { newX: number; newY: number; newVector: [number, number] } {
    let x = currentX;
    let y = currentY;
    let dx = vector[0];
    let dy = vector[1];

    x += dx;
    y += dy;

    // 壁との衝突判定
    if (x < 0) {
        x = 0;
        dx = -dx;
    } else if (x + imageWidth > containerWidth) {
        x = containerWidth - imageWidth;
        dx = -dx;
    }
    if (y < 0) {
        y = 0;
        dy = -dy;
    } else if (y + imageHeight > containerHeight) {
        y = containerHeight - imageHeight;
        dy = -dy;
    }

    // 衝突判定ボックスとの衝突判定
    for (const box of collisionBoxes) {
        if (x < box.x + box.width && x + imageWidth > box.x && y < box.y + box.height && y + imageHeight > box.y) {
            // 画像とボックスの中心座標
            const imgCenterX = x + imageWidth / 2;
            const imgCenterY = y + imageHeight / 2;
            const boxCenterX = box.x + box.width / 2;
            const boxCenterY = box.y + box.height / 2;

            // 中心間の距離
            const diffX = imgCenterX - boxCenterX;
            const diffY = imgCenterY - boxCenterY;

            // 重なりを計算
            const overlapX = imageWidth / 2 + box.width / 2 - Math.abs(diffX);
            const overlapY = imageHeight / 2 + box.height / 2 - Math.abs(diffY);

            // X方向の重なりの方がY方向の重なりより大きい場合、Y方向の速度を反転（横の辺との衝突）
            if (overlapX > overlapY) {
                if (diffY < 0) {
                    // 画像の中心がボックスの中心より上
                    y -= overlapY; // 上に押し出す
                } else {
                    y += overlapY; // 下に押し出す
                }
                dy = -dy;
            } else {
                // Y方向の重なりの方が大きい、または等しい場合、X方向の速度を反転（縦の辺との衝突）
                if (diffX < 0) {
                    // 画像の中心がボックスの中心より左
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

    return { newX: x, newY: y, newVector: [dx, dy] };
}

// メインの関数
export default function animate(
    imgContainer: HTMLDivElement,
    getDetections: () => Detection[]
): void {
    // 初期位置をランダムに設定
    let logoPos = { x: getRandomNumber(0, imgContainer.offsetWidth), y: getRandomNumber(0, imgContainer.offsetHeight) };
    let datePos = { x: getRandomNumber(0, imgContainer.offsetWidth), y: getRandomNumber(0, imgContainer.offsetHeight) };

    const logoImg = addPictureToHtml(pictureUrls[0], imgContainer, 200, logoPos.x, logoPos.y);
    const dateImg = addPictureToHtml(pictureUrls[1], imgContainer, 70, datePos.x, datePos.y);

    // ランダムにベクトルを生成
    let logoVector: [number, number] = [randomSign(getRandomNumber(3, 6)), randomSign(getRandomNumber(3, 6))];
    let dateVector: [number, number] = [randomSign(getRandomNumber(3, 6)), randomSign(getRandomNumber(3, 6))];

    let containerWidth = imgContainer.offsetWidth;
    let containerHeight = imgContainer.offsetHeight;

    // ウィンドウリサイズ時にコンテナサイズを更新
    window.addEventListener("resize", () => {
        containerWidth = imgContainer.offsetWidth;
        containerHeight = imgContainer.offsetHeight;
    });

    function tick() {
        // 画像の読み込みが完了するまでアニメーションを開始しない
        if (logoImg.width === 0 || logoImg.height === 0 || dateImg.width === 0 || dateImg.height === 0) {
            requestAnimationFrame(tick);
            return;
        }

        const detections = getDetections();

        const collisionBoxes: CollisionBox[] = detections.map((d) => ({
            x: d.x1 * containerWidth,
            y: d.y1 * containerHeight,
            width: (d.x2 - d.x1) * containerWidth,
            height: (d.y2 - d.y1) * containerHeight
        }));

        // logoImg の移動計算
        const logoResult = calculateImageMovement(
            logoPos.x,
            logoPos.y,
            logoVector,
            logoImg.width,
            logoImg.height,
            containerWidth,
            containerHeight,
            collisionBoxes
        );
        logoPos = { x: logoResult.newX, y: logoResult.newY };
        logoVector = logoResult.newVector;

        // dateImg の移動計算
        const dateResult = calculateImageMovement(
            datePos.x,
            datePos.y,
            dateVector,
            dateImg.width,
            dateImg.height,
            containerWidth,
            containerHeight,
            collisionBoxes
        );
        datePos = { x: dateResult.newX, y: dateResult.newY };
        dateVector = dateResult.newVector;

        // DOM更新を transform で一括で行う
        logoImg.style.transform = `translate(${logoPos.x}px, ${logoPos.y}px)`;
        dateImg.style.transform = `translate(${datePos.x}px, ${datePos.y}px)`;

        requestAnimationFrame(tick);
    }
    tick();
}
