import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { WebGPURenderer } from "three/webgpu";

// 3Dモデルのパスとスケールを格納
const penlightScale: [number, number, number] = [0.2, 0.2, 0.2]; // ペンライトのスケールを一括指定
const models: Record<string, [string, [number, number, number]]> = {
    mike: ["/3d-models/mike.glb", [0.5, 0.5, 0.5]],
    pen_b: ["/3d-models/penlight_b.glb", penlightScale],
    pen_g: ["/3d-models/penlight_g.glb", penlightScale],
    pen_o: ["/3d-models/penlight_o.glb", penlightScale],
    pen_p: ["/3d-models/penlight_p.glb", penlightScale],
    pen_r: ["/3d-models/penlight_r.glb", penlightScale],
    pen_s: ["/3d-models/penlight_s.glb", penlightScale],
    pen_w: ["/3d-models/penlight_w.glb", penlightScale],
    pen_y: ["/3d-models/penlight_y.glb", penlightScale],
    star: ["/3d-models/star.glb", [0.1, 0.1, 0.1]],
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
    
                // 任意の座標に配置
                model.position.set(positionX, positionY, positionZ);
                // 任意のスケールに設定
                model.scale.set(scaleX, scaleY, scaleZ);
    
                // シーンに追加
                scene.add(model);
                resolve(model); // 読み込んだモデルを返す
            }, undefined, (error) => {
                console.error(`モデルの読み込み中にエラーが発生しました: ${modelPath}`, error);
                reject(error); // エラー時にPromiseをreject
            });
        })
    }

    // 3Dモデルの読み込みとシーンへの追加
    try {
        // Promise.allで複数のモデルを並行して読み込む
        const [mike, penlight_b, star] = await Promise.all([
            addModel(models.mike[0], [0, 0, -5], models.mike[1]), // mike
            addModel(models.pen_b[0], [3, 0, -5], models.pen_b[1]), // penlight_b
            addModel(models.star[0], [-3, 0, -5], models.star[1]), // star
        ]);
    } catch (err) {
        console.error("3Dモデルの読み込み中にエラーが発生しました:", err);
        throw err;
    }

    // アニメーションループの設定
    renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
    });

    // loader.load("/3d-models/mike.glb", (glb) => {
    //     const model = glb.scene;
    //     // モデルの位置やサイズを調整
    //     model.position.set(0, 0, -5);
    //     model.scale.set(0.5, 0.5, 0.5);
    //     scene.add(model);
    //     // モデルを回転しつつ任意の方向に平行移動させるアニメーション
    //     const moveDirection = new THREE.Vector3(0.05, 0.05, 0); // 移動ベクトルを調整

    //     renderer.setAnimationLoop(() => {
    //         // 回転
    //         model.rotation.x += 0.01;
    //         model.rotation.y += 0.01;
    //         model.rotation.z += 0.01;

    //         // 平行移動
    //         model.position.add(moveDirection);
    //         // 画面端を超えたら反対側にワープ


    //         if (model.position.x > canvasWidth) {
    //             model.position.x = -canvasWidth;
    //         } else if (model.position.x < -canvasWidth) {
    //             model.position.x = canvasWidth;
    //         }

    //         if (model.position.y > canvasHeight) {
    //             model.position.y = -canvasHeight;
    //         } else if (model.position.y < -canvasHeight) {
    //             model.position.y = canvasHeight;
    //         }

    //         renderer.render(scene, camera);
    //     });
    // });
}