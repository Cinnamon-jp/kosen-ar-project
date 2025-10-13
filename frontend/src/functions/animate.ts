import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { WebGPURenderer } from "three/webgpu";

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
    star: [`${BASE_URL}3d-models/star.glb`, [0.02, 0.02, 0.02]],
};

// 衝突判定用のボックス
export interface CollisionBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

// canvas座標をthree.jsのワールド座標に変換する関数
function canvasToThreeCoords(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    frustumWidth: number,
    frustumHeight: number
): [number, number] {
    if (canvasWidth === 0 || canvasHeight === 0) {
        console.warn("canvasToThreeCoords: キャンバスの幅または高さが0のため、原点を返します");
        return [0, 0];
    }

    // 1. canvasの中心を原点(0,0)に移動し、2. ワールド座標のスケールに変換する
    // canvas座標(左上が0,0)から、ワールド座標(中央が0,0)への変換
    const worldX = (x - canvasWidth / 2) * (frustumWidth / canvasWidth);
    // Y軸はcanvas(下向きが正)とthree.js(上向きが正)で逆なので、符号を反転させる
    const worldY = -(y - canvasHeight / 2) * (frustumHeight / canvasHeight);

    return [worldX, worldY];
}

export default async function animate(
    canvas: HTMLCanvasElement,
    getDetections: () => Detection[] // detectionsを返す関数を受け取る
): Promise<void> { // detections: Detection[]
    if (!canvas) throw new Error("3D描画用のコンテナが見つかりません");

// 初期化
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    // バウンディングボックス用のcanvasを取得
    const boundingBoxCanvas = getBoundingBoxCanvas();

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
    const renderer = navigator.gpu
        ? new WebGPURenderer({
            canvas, // 描画先
            antialias: true, // アンチエイリアス
            alpha: true, // 背景を透過
        })
        : new THREE.WebGLRenderer({ // WebGLへフォールバック
            canvas,
            antialias: true,
            alpha: true,
        });

    // レンダラーのサイズを設定
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setClearColor(0x000000, 0); // 背景を透明に設定

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

    // ランダムな (指定した場合は任意の) 3Dモデルを読み込み、シーンに追加して、モデルオブジェクトを返す関数
    function addRandomModel(
        modelPosition: [number, number, number],
        modelName?: string
    ): Promise<THREE.Group> {
        const keysOfModelResources: string[] = Object.keys(modelResources);
        let selectedModelName: string | undefined =
            modelName && modelResources[modelName] ? modelName : undefined;

        if (!selectedModelName) {
            const randomIndex: number = Math.floor(Math.random() * keysOfModelResources.length);
            selectedModelName = keysOfModelResources[randomIndex];

            if (modelName) {
                console.warn(`指定されたモデル "${modelName}" は見つかりませんでした。ランダムに選択したモデル "${selectedModelName}" を使用します。`);
            }
        }

        if (!selectedModelName) {
            return Promise.reject(new Error("利用可能な3Dモデルがありません。"));
        }

        const ensuredModelName = selectedModelName;
        
        return new Promise((resolve, reject) => {
            // モデルの読み込み
            loader.load(modelResources[ensuredModelName][0], (gltf) => {
                const model = gltf.scene;
    
                // パラメータを分割代入
                const [positionX, positionY, positionZ] = modelPosition;
                const [scaleX, scaleY, scaleZ] = modelResources[ensuredModelName][1];
    
                // モデルの位置とサイズを調整
                model.position.set(positionX, positionY, positionZ);
                model.scale.set(scaleX, scaleY, scaleZ);
    
                scene.add(model); // シーンに追加
                resolve(model); // 読み込んだモデルを返す
            }, undefined, (error) => {
                console.error(`モデルの読み込み中にエラーが発生しました: ${modelResources[ensuredModelName][0]}`, error);
                reject(error); // エラー時にPromiseをreject
            });
        })
    }

    // 各モデルの変数宣言
    let model_1: THREE.Group;
    let model_2: THREE.Group;
    let model_3: THREE.Group;
    let model_4: THREE.Group;
    let model_5: THREE.Group;
    let model_6: THREE.Group;
    let model_7: THREE.Group;
    let model_8: THREE.Group;
    let model_9: THREE.Group;
    let model_10: THREE.Group;
    // 3Dモデルの読み込みとシーンへの追加
    try {
        // Promise.allで複数のモデルを並行して読み込む
        [model_1, model_2, model_3, model_4, model_5, model_6, model_7, model_8, model_9, model_10] = await Promise.all([
            addRandomModel([0, 0, -5], "mike"),
            addRandomModel([0, 1, -5], "mike"),
            addRandomModel([0, -1, -5], "star"),
            addRandomModel([1, 0, -5], "star"),
            addRandomModel([1, 1, -5]),
            addRandomModel([1, -1, -5]),
            addRandomModel([-1, 0, -5]),
            addRandomModel([-1, 1, -5]),
            addRandomModel([-1, -1, -5]),
            addRandomModel([0, 0, -5]),
        ]);
    } catch (err) {
        console.error("3Dモデルの読み込み中にエラーが発生しました:", err);
        throw err;
    }
    const modelsArray = [model_1, model_2, model_3, model_4, model_5, model_6, model_7, model_8, model_9, model_10]; // アニメーションの一括指定のため配列にまとめる

    // アニメーションループの設定
    renderer.setAnimationLoop(() => {
        modelsArray.forEach(model => {
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
            const distance = Math.abs(model.position.z - camera.position.z); // カメラからモデルまでの距離
            const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance; // モデルの位置における鉛直方向の長さ
            const frustumWidth = frustumHeight * camera.aspect; // モデルの位置における水平方向の長さ
            const visibleHalfWidth = frustumWidth / 2;
            const visibleHalfHeight = frustumHeight / 2;
            // 画面外へ出たモデルを反対側へラップさせる
            if (model.position.x > visibleHalfWidth) model.position.x = -visibleHalfWidth;
            if (model.position.x < -visibleHalfWidth) model.position.x = visibleHalfWidth;
            if (model.position.y > visibleHalfHeight) model.position.y = -visibleHalfHeight;
            if (model.position.y < -visibleHalfHeight) model.position.y = visibleHalfHeight;

            const detections: Detection[] = getDetections();

            // 衝突判定ボックス (Detection[]からCollosionBox[]への変換)
            const collisionBoxes: CollisionBox[] = detections.map(detection => {
                const boundingBoxCanvasWidth = boundingBoxCanvas.clientWidth;
                const boundingBoxCanvasHeight = boundingBoxCanvas.clientHeight;
                const [minX, maxY] = canvasToThreeCoords(detection.x1, detection.y1, boundingBoxCanvasWidth, boundingBoxCanvasHeight, frustumWidth, frustumHeight);
                const [maxX, minY] = canvasToThreeCoords((detection.x1 + detection.width), (detection.y1 + detection.height), boundingBoxCanvasWidth, boundingBoxCanvasHeight, frustumWidth, frustumHeight);
                return { minX, maxX, minY, maxY }
            });

            collisionBoxes.forEach(collisionBox => {
                // 各衝突判定ボックスの各パラメータを計算
                const boxCenterX = (collisionBox.maxX + collisionBox.minX) / 2;
                const boxCenterY = (collisionBox.maxY + collisionBox.minY) / 2;
                const boxHalfWidth = (collisionBox.maxX - collisionBox.minX) / 2;
                const boxHalfHeight = (collisionBox.maxY - collisionBox.minY) / 2;

                // 衝突判定ボックスの中心からモデルの位置までのベクトル
                const dx = model.position.x - boxCenterX;
                const dy = model.position.y - boxCenterY;

                if (boxHalfWidth === 0 || boxHalfHeight === 0) return; // 衝突判定ボックスの幅または高さが0の場合、処理を中断
                // 衝突判定ボックスのサイズで正規化
                const scaledDx = dx / boxHalfWidth;
                const scaledDy = dy / boxHalfHeight;

                // 衝突判定
                if (
                    (model.position.x > collisionBox.minX && model.position.x < collisionBox.maxX)
                    && (model.position.y > collisionBox.minY && model.position.y < collisionBox.maxY)
                ) { // 衝突判定ボックスに触れたとき
                    if (Math.abs(scaledDx) > Math.abs(scaledDy)) { // 左右方向から衝突
                        model.userData.moveDirection.x *= -1; // X方向の移動ベクトルを反転

                        // 衝突判定ボックスの内側に入り込んだ場合、外側に押し出す
                        if (model.position.x < boxCenterX) { // モデルが衝突判定ボックスの左側にいる場合
                            model.position.x = collisionBox.minX;
                        } else { // モデルが衝突判定ボックスの右側にいる場合
                            model.position.x = collisionBox.maxX;
                        }
                    } else { // 上下方向から衝突
                        model.userData.moveDirection.y *= -1; // Y方向の移動ベクトルを反転

                        // 衝突判定ボックスの内側に入り込んだ場合、外側に押し出す
                        if (model.position.y < boxCenterY) { // モデルが衝突判定ボックスの下側にいる場合
                            model.position.y = collisionBox.minY;
                        } else { // モデルが衝突判定ボックスの上側にいる場合
                            model.position.y = collisionBox.maxY;
                        }
                    }
                }
            });
        });
        renderer.render(scene, camera);
    });
}