import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { WebGPURenderer } from "three/webgpu";

// 3Dモデルのパスとスケールを格納
const penlightScale: [number, number, number] = [0.1, 0.1, 0.1]; // ペンライトのスケールを一括指定
const modelResources: Record<string, [string, [number, number, number]]> = {
    mike: [`${import.meta.env.BASE_URL}3d-models/mike.glb`, [0.3, 0.3, 0.3]],
    pen_b: [`${import.meta.env.BASE_URL}3d-models/penlight_b.glb`, penlightScale],
    pen_g: [`${import.meta.env.BASE_URL}3d-models/penlight_g.glb`, penlightScale],
    pen_o: [`${import.meta.env.BASE_URL}3d-models/penlight_o.glb`, penlightScale],
    pen_p: [`${import.meta.env.BASE_URL}3d-models/penlight_p.glb`, penlightScale],
    pen_r: [`${import.meta.env.BASE_URL}3d-models/penlight_r.glb`, penlightScale],
    pen_s: [`${import.meta.env.BASE_URL}3d-models/penlight_s.glb`, penlightScale],
    pen_w: [`${import.meta.env.BASE_URL}3d-models/penlight_w.glb`, penlightScale],
    pen_y: [`${import.meta.env.BASE_URL}3d-models/penlight_y.glb`, penlightScale],
    star: [`${import.meta.env.BASE_URL}3d-models/star.glb`, [0.07, 0.07, 0.07]],
};

export default async function animate(canvas: HTMLCanvasElement): Promise<void> {
    if (!canvas) throw new Error("3D描画用のコンテナが見つかりません");

// 初期化
    const canvasWidth = canvas.clientWidth
    const canvasHeight = canvas.clientHeight;

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
        : new THREE.WebGLRenderer({
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

    // 3Dモデルを読み込み、シーンに追加して、モデルオブジェクトを返す関数
    function addModel(
        modelPath: string,
        modelPosition: [number, number, number],
        modelScale: [number, number, number]
    ): Promise<THREE.Group> {
        return new Promise((resolve, reject) => {
            // モデルの読み込み
            loader.load(modelPath, (gltf) => {
                const model = gltf.scene;
    
                // パラメータを分割代入
                const [positionX, positionY, positionZ] = modelPosition;
                const [scaleX, scaleY, scaleZ] = modelScale;
    
                // モデルの位置とサイズを調整
                model.position.set(positionX, positionY, positionZ);
                model.scale.set(scaleX, scaleY, scaleZ);
    
                scene.add(model); // シーンに追加
                resolve(model); // 読み込んだモデルを返す
            }, undefined, (error) => {
                console.error(`モデルの読み込み中にエラーが発生しました: ${modelPath}`, error);
                reject(error); // エラー時にPromiseをreject
            });
        })
    }
    // // ランダムな3Dモデルを読み込み、シーンに追加して、モデルオブジェクトを返す関数
    // function addRandomModel(
    //     modelPosition: [number, number, number],
    // ): Promise<THREE.Group> {
    //     const keysOfModelResources = Object.keys(modelResources);
    //     const randomIndex = Math.floor(Math.random() * keysOfModelResources.length);
    //     const randomModelName = keysOfModelResources[randomIndex];

    //     return new Promise((resolve, reject) => {
    //         // モデルの読み込み
    //         loader.load(modelResources[randomModelName][0], (gltf) => {
    //             const model = gltf.scene;
    
    //             // パラメータを分割代入
    //             const [positionX, positionY, positionZ] = modelPosition;
    //             const [scaleX, scaleY, scaleZ] = modelResources[randomModelName][1];
    
    //             // モデルの位置とサイズを調整
    //             model.position.set(positionX, positionY, positionZ);
    //             model.scale.set(scaleX, scaleY, scaleZ);
    
    //             scene.add(model); // シーンに追加
    //             resolve(model); // 読み込んだモデルを返す
    //         }, undefined, (error) => {
    //             console.error(`モデルの読み込み中にエラーが発生しました: ${modelResources[randomModelName][0]}`, error);
    //             reject(error); // エラー時にPromiseをreject
    //         });
    //     })
    // }

    // 各モデルの変数宣言
    let model_1: THREE.Group;
    let model_2: THREE.Group;
    let model_3: THREE.Group;
    let model_4: THREE.Group;
    // 3Dモデルの読み込みとシーンへの追加
    try {
        // Promise.allで複数のモデルを並行して読み込む
        [model_1, model_2, model_3, model_4] = await Promise.all([
            addModel(modelResources.mike[0], [0, 0, -5], modelResources.mike[1]),
            addModel(modelResources.mike[0], [0, -3, -5], modelResources.mike[1]),
            addModel(modelResources.pen_b[0], [3, 0, -5], modelResources.pen_b[1]),
            addModel(modelResources.star[0], [-3, 0, -5], modelResources.star[1]),
        ]);
    } catch (err) {
        console.error("3Dモデルの読み込み中にエラーが発生しました:", err);
        throw err;
    }
    const modelsArray = [model_1, model_2, model_3, model_4]; // アニメーションの一括指定のため配列にまとめる

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
            const margin = 0.2;
            // 画面外へ出たモデルを反対側へラップさせる
            if (model.position.x > visibleHalfWidth + margin) model.position.x = -visibleHalfWidth - margin;
            if (model.position.x < -visibleHalfWidth - margin) model.position.x = visibleHalfWidth + margin;
            if (model.position.y > visibleHalfHeight + margin) model.position.y = -visibleHalfHeight - margin;
            if (model.position.y < -visibleHalfHeight - margin) model.position.y = visibleHalfHeight + margin;

            // 衝突判定用の四角形
            const collisionBox = {
                minX: -visibleHalfWidth * 0.5, // 左端
                maxX: visibleHalfWidth * 0.5,  // 右端
                minY: -visibleHalfHeight * 0.5, // 下端
                maxY: visibleHalfHeight * 0.5,  // 上端
                // 後に計算するパラメータ
                centerX: 0,
                centerY: 0,
                halfWidth: 0,
                halfHeight: 0,
            };
            // const modelRadius = 0.1; // モデルのおおよその半径
            // 衝突判定ボックスの各パラメータを計算
            collisionBox.centerX = (collisionBox.maxX + collisionBox.minX) / 2;
            collisionBox.centerY = (collisionBox.maxY + collisionBox.minY) / 2;
            collisionBox.halfWidth = (collisionBox.maxX - collisionBox.minX) / 2;
            collisionBox.halfHeight = (collisionBox.maxY - collisionBox.minY) / 2;

            // 衝突判定ボックスの中心からモデルの位置までのベクトル
            const dx = model.position.x - collisionBox.centerX;
            const dy = model.position.y - collisionBox.centerY;

            if (collisionBox.halfWidth === 0 || collisionBox.halfHeight === 0) return; // 衝突判定ボックスの幅または高さが0の場合、処理を中断
            // 衝突判定ボックスのサイズで正規化
            const scaledDx = dx / collisionBox.halfWidth;
            const scaledDy = dy / collisionBox.halfHeight;

            // 衝突判定
            if (
                (model.position.x > collisionBox.minX && model.position.x < collisionBox.maxX)
                && (model.position.y > collisionBox.minY && model.position.y < collisionBox.maxY)
            ) { // 衝突判定ボックスに触れたとき
                if (Math.abs(scaledDx) > Math.abs(scaledDy)) { // 左右方向から衝突
                    model.userData.moveDirection.x *= -1; // X方向の移動ベクトルを反転

                    // 衝突判定ボックスの内側に入り込んだ場合、外側に押し出す
                    if (model.position.x < collisionBox.centerX) { // モデルが衝突判定ボックスの左側にいる場合
                        model.position.x = collisionBox.minX;
                    } else { // モデルが衝突判定ボックスの右側にいる場合
                        model.position.x = collisionBox.maxX;
                    }
                } else { // 上下方向から衝突
                    model.userData.moveDirection.y *= -1; // Y方向の移動ベクトルを反転

                    // 衝突判定ボックスの内側に入り込んだ場合、外側に押し出す
                    if (model.position.y < collisionBox.centerY) { // モデルが衝突判定ボックスの下側にいる場合
                        model.position.y = collisionBox.minY;
                    } else { // モデルが衝突判定ボックスの上側にいる場合
                        model.position.y = collisionBox.maxY;
                    }
                }
            }
        });
        renderer.render(scene, camera);
    });
}