import type { Detection } from "./inferOnnxModel.ts";

// 日付を格納
const now = new Date();
const date = now.getDate();

const BASE_URL = `${import.meta.env.BASE_URL}`;

// 画像URLの配列(日付でURLを指定)
const pictureUrls: [string, string, string] = [
    `${BASE_URL}assets/kosensai-logo.png`,
    `${BASE_URL}assets/kosensai-date-${date}.png`,
    `${BASE_URL}assets/hero.png`
];

// 衝突判定用のボックス型定義
interface CollisionBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Quad-treeノード
class QuadTreeNode {
    bounds: CollisionBox;
    boxes: CollisionBox[];
    children: QuadTreeNode[] | null;
    maxBoxes: number;
    maxDepth: number;
    depth: number;

    constructor(bounds: CollisionBox, depth: number = 0, maxBoxes: number = 4, maxDepth: number = 5) {
        this.bounds = bounds;
        this.boxes = [];
        this.children = null;
        this.maxBoxes = maxBoxes;
        this.maxDepth = maxDepth;
        this.depth = depth;
    }

    // ボックスを挿入
    insert(box: CollisionBox): void {
        // 境界外なら挿入しない
        if (!this.intersects(this.bounds, box)) {
            return;
        }

        // 子ノードがある場合は子に委譲
        if (this.children !== null) {
            for (const child of this.children) {
                child.insert(box);
            }
            return;
        }

        // 現在のノードに追加
        this.boxes.push(box);

        // 分割条件: 最大数を超え、かつ最大深度に達していない
        if (this.boxes.length > this.maxBoxes && this.depth < this.maxDepth) {
            this.subdivide();
        }
    }

    // ノードを4分割
    subdivide(): void {
        const { x, y, width, height } = this.bounds;
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        this.children = [
            new QuadTreeNode({ x, y, width: halfWidth, height: halfHeight }, this.depth + 1, this.maxBoxes, this.maxDepth),
            new QuadTreeNode({ x: x + halfWidth, y, width: halfWidth, height: halfHeight }, this.depth + 1, this.maxBoxes, this.maxDepth),
            new QuadTreeNode({ x, y: y + halfHeight, width: halfWidth, height: halfHeight }, this.depth + 1, this.maxBoxes, this.maxDepth),
            new QuadTreeNode({ x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight }, this.depth + 1, this.maxBoxes, this.maxDepth)
        ];

        // 既存のボックスを子ノードに再配置
        for (const box of this.boxes) {
            for (const child of this.children) {
                child.insert(box);
            }
        }
        this.boxes = [];
    }

    // 範囲と交差するボックスを取得
    query(range: CollisionBox, result: CollisionBox[] = []): CollisionBox[] {
        // 範囲外なら何もしない
        if (!this.intersects(this.bounds, range)) {
            return result;
        }

        // 子ノードがある場合は子に問い合わせ
        if (this.children !== null) {
            for (const child of this.children) {
                child.query(range, result);
            }
        } else {
            // リーフノードの場合、ボックスをチェック
            for (const box of this.boxes) {
                if (this.intersects(range, box)) {
                    result.push(box);
                }
            }
        }

        return result;
    }

    // 2つのボックスが交差しているかチェック
    intersects(a: CollisionBox, b: CollisionBox): boolean {
        return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }
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
    collisionBoxes: CollisionBox[],
    quadTree: QuadTreeNode | null = null
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
    // Quad-treeがある場合は範囲クエリで近傍のボックスのみチェック
    const boxesToCheck = quadTree !== null
        ? quadTree.query({ x, y, width: imageWidth, height: imageHeight })
        : collisionBoxes;

    for (const box of boxesToCheck) {
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

    // 画像を追加
    const logoImg = addPictureToHtml(pictureUrls[0], imgContainer, 200, logoPos.x, logoPos.y);
    const dateImg = addPictureToHtml(pictureUrls[1], imgContainer, 70, datePos.x, datePos.y);

    // heroImgの配列とプール
    const MAX_HERO_IMAGES = 10; // 最大想定数（必要に応じて調整）
    let heroImgsArray: HTMLImageElement[] = [];
    // heroImgのアスペクト比をキャッシュ
    const heroImgAspectRatios = new Map<HTMLImageElement, number>();
    
    // heroImg用のプールを事前作成
    for (let i = 0; i < MAX_HERO_IMAGES; i++) {
        const heroImg = addPictureToHtml(pictureUrls[2], imgContainer, 100, 0, 0);
        heroImg.style.display = "none"; // 初期状態は非表示
        heroImgsArray.push(heroImg);
        
        // アスペクト比をキャッシュ
        heroImg.onload = () => {
            const ratio = heroImg.naturalWidth / heroImg.naturalHeight;
            heroImgAspectRatios.set(heroImg, ratio);
        };
        // 既に読み込まれている場合は即座に設定
        if (heroImg.complete && heroImg.naturalWidth > 0) {
            const ratio = heroImg.naturalWidth / heroImg.naturalHeight;
            heroImgAspectRatios.set(heroImg, ratio);
        }
    }

    // ランダムにベクトルを生成
    let logoVector: [number, number] = [randomSign(getRandomNumber(2, 4)), randomSign(getRandomNumber(2, 4))];
    let dateVector: [number, number] = [randomSign(getRandomNumber(2, 4)), randomSign(getRandomNumber(2, 4))];

    let containerWidth = imgContainer.offsetWidth;
    let containerHeight = imgContainer.offsetHeight;

    // 画像読み込み完了フラグ
    let imagesLoaded = false;

    // ウィンドウリサイズ時にコンテナサイズを更新
    window.addEventListener("resize", () => {
        containerWidth = imgContainer.offsetWidth;
        containerHeight = imgContainer.offsetHeight;
    });

    // collision box配列を再利用するための変数
    let collisionBoxes: CollisionBox[] = [];
    // Quad-treeを使用する閾値（ボックス数がこれ以上の場合にQuad-treeを使用）
    const QUADTREE_THRESHOLD = 5;

    function tick() {
        // 画像の読み込みが完了するまでアニメーションを開始しない（初回のみチェック）
        if (!imagesLoaded) {
            if (logoImg.width === 0 || logoImg.height === 0 || dateImg.width === 0 || dateImg.height === 0) {
                requestAnimationFrame(tick);
                return;
            }
            imagesLoaded = true;
        }

        const detections = getDetections();

        // collision box配列を再利用（長さが変わる場合のみ再作成）
        if (collisionBoxes.length !== detections.length) {
            collisionBoxes = new Array(detections.length);
            for (let i = 0; i < detections.length; i++) {
                collisionBoxes[i] = { x: 0, y: 0, width: 0, height: 0 };
            }
        }

        // 既存の配列の値を更新
        for (let i = 0; i < detections.length; i++) {
            const d = detections[i];
            collisionBoxes[i].x = d.x1 * containerWidth;
            collisionBoxes[i].y = d.y1 * containerHeight;
            collisionBoxes[i].width = (d.x2 - d.x1) * containerWidth;
            collisionBoxes[i].height = (d.y2 - d.y1) * containerHeight;
        }

        // Quad-treeの構築（ボックス数が閾値を超える場合のみ）
        let quadTree: QuadTreeNode | null = null;
        if (collisionBoxes.length > QUADTREE_THRESHOLD) {
            quadTree = new QuadTreeNode({
                x: 0,
                y: 0,
                width: containerWidth,
                height: containerHeight
            });
            for (const box of collisionBoxes) {
                quadTree.insert(box);
            }
        }

        // logoImg の移動計算
        const logoResult = calculateImageMovement(
            logoPos.x,
            logoPos.y,
            logoVector,
            logoImg.width,
            logoImg.height,
            containerWidth,
            containerHeight,
            collisionBoxes,
            quadTree
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
            collisionBoxes,
            quadTree
        );
        datePos = { x: dateResult.newX, y: dateResult.newY };
        dateVector = dateResult.newVector;

        // heroImgの描画処理 (検出結果の上辺に追従させる)
        const activeCount = Math.min(collisionBoxes.length, MAX_HERO_IMAGES);
        
        // DOM更新を transform で一括で行う
        logoImg.style.transform = `translate(${logoPos.x}px, ${logoPos.y}px)`;
        dateImg.style.transform = `translate(${datePos.x}px, ${datePos.y}px)`;
        
        // heroImgのサイズと位置を1つのループで設定
        heroImgsArray.forEach((heroImg, index) => {
            if (index < activeCount) {
                // 表示する画像
                const box = collisionBoxes[index];
                const ratio = heroImgAspectRatios.get(heroImg);
                
                // アスペクト比がキャッシュされている場合のみ処理
                if (ratio) {
                    heroImg.width = box.width;
                    heroImg.height = heroImg.width / ratio;
                    
                    const heroImgX = box.x + (box.width - heroImg.width) / 2;
                    const heroImgY = box.y - heroImg.height - 10;
                    heroImg.style.transform = `translate(${heroImgX}px, ${heroImgY}px)`;
                    heroImg.style.display = "block";
                }
            } else {
                // 非表示にする画像
                heroImg.style.display = "none";
            }
        });

        requestAnimationFrame(tick);
    }
    tick();
}
