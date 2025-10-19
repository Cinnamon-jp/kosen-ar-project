import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

import { getBoundingBoxCanvas } from "../index.ts";

import type { Detection } from "./inferOnnxModel.ts";

// 3Dモデルのパスとスケールを格納
const BASE_URL = import.meta.env.BASE_URL; // Viteの環境変数からベースURLを取得
const penlightScale: [number, number, number] = [0.03, 0.03, 0.03]; // ペンライトのスケールを一括指定
const modelResources: Record<string, [string, [number, number, number]]> = {
    mike: [`${BASE_URL}3d-models/mike.glb`, [0.1, 0.1, 0.1]],
    pen_b: [`${BASE_URL}3d-models/penlight_b.glb`, penlightScale],
    pen_g: [`${BASE_URL}3d-models/penlight_g.glb`, penlightScale],
    pen_o: [`${BASE_URL}3d-models/penlight_o.glb`, penlightScale],
    pen_p: [`${BASE_URL}3d-models/penlight_p.glb`, penlightScale],
    pen_r: [`${BASE_URL}3d-models/penlight_r.glb`, penlightScale],
    pen_s: [`${BASE_URL}3d-models/penlight_s.glb`, penlightScale],
    pen_w: [`${BASE_URL}3d-models/penlight_w.glb`, penlightScale],
    pen_y: [`${BASE_URL}3d-models/penlight_y.glb`, penlightScale],
    star: [`${BASE_URL}3d-models/star.glb`, [0.02, 0.02, 0.02]]
};
const keysOfModelResources: string[] = Object.keys(modelResources);

// 衝突判定用のボックス
export interface CollisionBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    boxCenterX: number;
    boxCenterY: number;
    boxHalfWidth: number;
    boxHalfHeight: number;
}

// ランダムな (指定した場合は任意の) 3Dモデルを読み込み、シーンに追加して、モデルオブジェクトを返す関数
function addRandomModel(
    loader: GLTFLoader,
    scene: THREE.Scene,
    modelPosition: [number, number, number],
    modelName?: string
): Promise<THREE.Group> {
    let selectedModelName: string | undefined = modelName && modelResources[modelName] ? modelName : undefined;

    if (!selectedModelName) {
        const randomIndex: number = Math.floor(Math.random() * keysOfModelResources.length);
        selectedModelName = keysOfModelResources[randomIndex];

        if (modelName) {
            console.warn(
                `指定されたモデル "${modelName}" は見つかりませんでした。ランダムに選択したモデル "${selectedModelName}" を使用します。`
            );
        }
    }

    if (!selectedModelName) {
        return Promise.reject(new Error("利用可能な3Dモデルがありません。"));
    }

    const ensuredModelName = selectedModelName;

    return new Promise((resolve, reject) => {
        // モデルの読み込み
        loader.load(
            modelResources[ensuredModelName][0],
            (gltf) => {
                const model = gltf.scene;

                // パラメータを分割代入
                const [positionX, positionY, positionZ] = modelPosition;
                const [scaleX, scaleY, scaleZ] = modelResources[ensuredModelName][1];

                // モデルの位置とサイズを調整
                model.position.set(positionX, positionY, positionZ);
                model.scale.set(scaleX, scaleY, scaleZ);

                scene.add(model); // シーンに追加
                resolve(model); // 読み込んだモデルを返す
            },
            undefined,
            (error) => {
                console.error(
                    `モデルの読み込み中にエラーが発生しました: ${modelResources[ensuredModelName][0]}`,
                    error
                );
                reject(error); // エラー時にPromiseをreject
            }
        );
    });
}

// メインの関数
export default async function animate(
    canvas: HTMLCanvasElement,
    getDetections: () => Detection[] // detectionsを返す関数を受け取る
): Promise<void> {
    if (!canvas) throw new Error("3D描画用のコンテナが見つかりません");

    // 初期化
    let canvasWidth = canvas.clientWidth;
    let canvasHeight = canvas.clientHeight;

    // シーンの作成
    const scene = new THREE.Scene();

    // カメラの作成
    const camera = new THREE.PerspectiveCamera(
        75, // 視野角
        canvasWidth / canvasHeight, // アスペクト比
        0.1, // ニアクリップ面
        1000 // ファークリップ面
    );

    // レンダラーの作成
    const renderer = new THREE.WebGLRenderer({
        // WebGLレンダラーの作成
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true // バッファを保持（スクリーンショット用）
    });

    // レンダラーのサイズを設定
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setClearColor(0x000000, 0); // 背景を透明に設定

    // frustum関連の変数を宣言
    let frustumHeight: number, frustumWidth: number, visibleHalfWidth: number, visibleHalfHeight: number;
    const distance = 5; // カメラ(0,0,0)とモデル(z=-5)の距離

    // ウィンドウリサイズ時の処理
    function onWindowResize() {
        // 新しいキャンバスサイズを取得
        canvasWidth = canvas.clientWidth;
        canvasHeight = canvas.clientHeight;

        // カメラのアスペクト比を更新
        camera.aspect = canvasWidth / canvasHeight;
        camera.updateProjectionMatrix();

        // レンダラーのサイズを更新
        renderer.setSize(canvasWidth, canvasHeight);

        // frustumのサイズを再計算
        frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
        frustumWidth = frustumHeight * camera.aspect;
        visibleHalfWidth = frustumWidth / 2;
        visibleHalfHeight = frustumHeight / 2;
    }
    window.addEventListener("resize", onWindowResize, false);

    // 環境光を追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    // 平行光源を追加
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // GLTFLoaderのインスタンスを作成
    const loader = new GLTFLoader();
    // 初期化終了

    // 3Dモデルの読み込みとシーンへの追加
    let modelsArray: THREE.Group[];
    try {
        // Promise.allで複数のモデルを並行して読み込む
        modelsArray = await Promise.all([
            addRandomModel(loader, scene, [0, 0, -5], "mike"),
            addRandomModel(loader, scene, [0, 1, -5], "mike"),
            addRandomModel(loader, scene, [0, -1, -5], "star"),
            addRandomModel(loader, scene, [1, 0, -5], "star"),
            addRandomModel(loader, scene, [1, 1, -5]),
            addRandomModel(loader, scene, [1, -1, -5]),
            addRandomModel(loader, scene, [-1, 0, -5]),
            addRandomModel(loader, scene, [-1, 1, -5]),
            addRandomModel(loader, scene, [-1, -1, -5]),
            addRandomModel(loader, scene, [0, 0, -5])
        ]);
    } catch (err) {
        console.error("3Dモデルの読み込み中にエラーが発生しました:", err);
        throw err;
    }

    onWindowResize(); // 初期値を計算

    // アニメーションループの設定
    renderer.setAnimationLoop(() => {
        // キャッシュ化してフレーム内の重複計算を避ける
        const detections: Detection[] = getDetections();
        const boundingBoxCanvas = getBoundingBoxCanvas();
        const boundingBoxCanvasWidth = boundingBoxCanvas ? boundingBoxCanvas.width || boundingBoxCanvas.clientWidth : 0;
        const boundingBoxCanvasHeight = boundingBoxCanvas
            ? boundingBoxCanvas.height || boundingBoxCanvas.clientHeight
            : 0;
        const hasValidBoundingBoxCanvas = boundingBoxCanvasWidth > 0 && boundingBoxCanvasHeight > 0;
        const normalizedDetections: Array<{
            minXNorm: number;
            maxXNorm: number;
            topYNorm: number;
            bottomYNorm: number;
        }> = hasValidBoundingBoxCanvas
            ? detections.map((detection) => ({
                minXNorm: detection.x1 / boundingBoxCanvasWidth,
                maxXNorm: (detection.x1 + detection.width) / boundingBoxCanvasWidth,
                topYNorm: detection.y1 / boundingBoxCanvasHeight,
                bottomYNorm: (detection.y1 + detection.height) / boundingBoxCanvasHeight
            }))
            : [];
        const detectionAspect = hasValidBoundingBoxCanvas
            ? boundingBoxCanvasWidth / boundingBoxCanvasHeight
            : camera.aspect;

        const collisionFrustumWidth = frustumHeight * detectionAspect;
        // 検出結果ボックスを衝突判定ボックスに変換
        const collisionBoxes: CollisionBox[] = hasValidBoundingBoxCanvas
            ? normalizedDetections.map((normalizedDetection) => {
                const minX = (normalizedDetection.minXNorm - 0.5) * collisionFrustumWidth;
                const maxX = (normalizedDetection.maxXNorm - 0.5) * collisionFrustumWidth;
                const maxY = (0.5 - normalizedDetection.topYNorm) * frustumHeight;
                const minY = (0.5 - normalizedDetection.bottomYNorm) * frustumHeight;

                const boxCenterX = (maxX + minX) / 2;
                const boxCenterY = (maxY + minY) / 2;
                const boxHalfWidth = (maxX - minX) / 2;
                const boxHalfHeight = (maxY - minY) / 2;

                return { minX, maxX, minY, maxY, boxCenterX, boxCenterY, boxHalfWidth, boxHalfHeight };
            })
            : [];

        modelsArray.forEach((model) => {
            // 初回のみ回転軸をランダムに生成して userData に保存
            if (!model.userData.axis) {
                const axis = new THREE.Vector3(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ).normalize();
                model.userData.axis = axis;
            }
            // 保存した軸で均等に回転
            model.rotateOnAxis(model.userData.axis, 0.01);

            // 初回のみ移動ベクトルをランダムに生成して userData に保存
            if (!model.userData.moveDirection) {
                const moveDirection = new THREE.Vector3(
                    (Math.random() * 0.03 + 0.01) * (Math.random() < 0.5 ? -1 : 1),
                    (Math.random() * 0.03 + 0.01) * (Math.random() < 0.5 ? -1 : 1),
                    0
                );
                model.userData.moveDirection = moveDirection;
            }
            // 保存した移動ベクトルで平行移動
            model.position.add(model.userData.moveDirection);

            // 画面外へ出たモデルを反対側へラップさせる
            if (model.position.x > visibleHalfWidth) model.position.x = -visibleHalfWidth;
            if (model.position.x < -visibleHalfWidth) model.position.x = visibleHalfWidth;
            if (model.position.y > visibleHalfHeight) model.position.y = -visibleHalfHeight;
            if (model.position.y < -visibleHalfHeight) model.position.y = visibleHalfHeight;

            collisionBoxes.forEach((collisionBox) => {
                // 各衝突判定ボックスの各パラメータは事前計算済み
                const { boxCenterX, boxCenterY, boxHalfWidth, boxHalfHeight } = collisionBox;
                const modelHalfSize = 0.1; // モデルの大きさの半分(ざっくりとした球体として扱う)

                // 衝突判定ボックスの中心からモデルの位置までのベクトル
                const dx = model.position.x - boxCenterX;
                const dy = model.position.y - boxCenterY;

                if (boxHalfWidth === 0 || boxHalfHeight === 0) return; // 衝突判定ボックスの幅または高さが0の場合、処理を中断
                // 衝突判定ボックスのサイズで正規化
                const scaledDx = dx / boxHalfWidth;
                const scaledDy = dy / boxHalfHeight;

                // 衝突判定
                if (
                    // AABB（軸並行境界ボックス）での衝突判定
                    model.position.x + modelHalfSize > collisionBox.minX &&
                    model.position.x - modelHalfSize < collisionBox.maxX &&
                    model.position.y + modelHalfSize > collisionBox.minY &&
                    model.position.y - modelHalfSize < collisionBox.maxY
                ) {
                    // 衝突したとき
                    if (Math.abs(scaledDx) > Math.abs(scaledDy)) {
                        // 左右方向から衝突
                        model.userData.moveDirection.x *= -1; // X方向の移動ベクトルを反転

                        // 衝突判定ボックスの内側に入り込んだ場合、外側に押し出す
                        if (model.position.x < boxCenterX) {
                            // モデルが衝突判定ボックスの左側にいる場合
                            model.position.x = collisionBox.minX - modelHalfSize;
                        } else {
                            // モデルが衝突判定ボックスの右側にいる場合
                            model.position.x = collisionBox.maxX + modelHalfSize;
                        }
                    } else {
                        // 上下方向から衝突
                        model.userData.moveDirection.y *= -1; // Y方向の移動ベクトルを反転

                        // 衝突判定ボックスの内側に入り込んだ場合、外側に押し出す
                        if (model.position.y < boxCenterY) {
                            // モデルが衝突判定ボックスの下側にいる場合
                            model.position.y = collisionBox.minY - modelHalfSize;
                        } else {
                            // モデルが衝突判定ボックスの上側にいる場合
                            model.position.y = collisionBox.maxY + modelHalfSize;
                        }
                    }
                }
            });
        });
        renderer.render(scene, camera);
    });
}
