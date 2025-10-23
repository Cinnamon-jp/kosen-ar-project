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
    img.style.transform = `translate(${positionX}px, ${positionY}px)`

    // 画像がロードされたらアスペクト比に応じて高さを設定
    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight
        img.width = width
        img.height = width / ratio
    }

    container.appendChild(img)
    return img
}

// 画像の移動ロジックを計算する純粋な関数
function calculateImageMovement(
    currentX: number,
    currentY: number,
    vector: [number, number],
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
    collisionBoxes: CollisionBox[],
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

    return { newX: x, newY: y, newVector: [dx, dy] };
}


// メインの関数
export default function animate(
    imgContainer: HTMLDivElement,
    getDetections: () => Detection[],
): void {
    // 初期位置
    let logoPos = { x: 50, y: 50 };
    let datePos = { x: 150, y: 150 };

    const logoImg = addPictureToHtml(pictureUrls[0], imgContainer, 100, logoPos.x, logoPos.y);
    const dateImg = addPictureToHtml(pictureUrls[1], imgContainer, 100, datePos.x, datePos.y);

    let logoVector: [number, number] = [5, 5];
    let dateVector: [number, number] = [6, 3];

    // --- ▼ パフォーマンス改善のための変更点 ▼ ---

    let containerWidth = imgContainer.offsetWidth;
    let containerHeight = imgContainer.offsetHeight;
    let logoWidth = 0;
    let logoHeight = 0;
    let dateWidth = 0;
    let dateHeight = 0;

    logoImg.onload = () => {
        const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
        logoImg.width = 100;
        logoImg.height = 100 / ratio;
        logoWidth = logoImg.width;
        logoHeight = logoImg.height;
    };

    dateImg.onload = () => {
        const ratio = dateImg.naturalWidth / dateImg.naturalHeight;
        dateImg.width = 100;
        dateImg.height = 100 / ratio;
        dateWidth = dateImg.width;
        dateHeight = dateImg.height;
    };

    // ウィンドウリサイズ時にコンテナサイズを更新
    window.addEventListener('resize', () => {
        containerWidth = imgContainer.offsetWidth;
        containerHeight = imgContainer.offsetHeight;
    });

    // --- ▲ パフォーマンス改善のための変更点 ▲ ---

    function tick() {
        const detections = getDetections();

        // ▼ 毎フレームのDOMアクセスを削除し、キャッシュした変数を使用
        const collisionBoxes: CollisionBox[] = detections.map(d => ({
            x: d.x1 * containerWidth,
            y: d.y1 * containerHeight,
            width: (d.x2 - d.x1) * containerWidth,
            height: (d.y2 - d.y1) * containerHeight,
        }));

        // logoImg の移動計算
        const logoResult = calculateImageMovement(
            logoPos.x,
            logoPos.y,
            logoVector,
            logoWidth, // ▼ キャッシュした値を使用
            logoHeight, // ▼ キャッシュした値を使用
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
            dateWidth, // ▼ キャッシュした値を使用
            dateHeight, // ▼ キャッシュした値を使用
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