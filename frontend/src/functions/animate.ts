import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
// import { WebGPURenderer } from "three/webgpu";

export default function animate(canvas: HTMLCanvasElement): void {
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
        const renderer = new THREE.WebGLRenderer({
            canvas, // 描画先
            antialias: true, // アンチエイリアスを有効化
            alpha: true, // 背景を透過させる
        });
        renderer.setSize(canvasWidth, canvasHeight);
        renderer.setClearColor(0x000000, 0); // 背景を透明にする

        
        window.addEventListener("resize", () => {
            camera.aspect = canvasWidth / canvasHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(canvasWidth, canvasHeight);
        });

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

    // 3Dモデルの読み込みとシーンへの追加 (描画は行わない)
    function addModel(
        modelPath: string,
        modelPosition: THREE.Vector3,
        modelScale: THREE.Vector3
    ): void {
        // モデルの読み込み
        loader.load(modelPath, (gltf) => {
        const model = gltf.scene;

        // 任意の座標に配置
        model.position.set(modelPosition.x, modelPosition.y, modelPosition.z);
        // 任意のスケールに設定
        model.scale.set(modelScale.x, modelScale.y, modelScale.z);

        // シーンに追加
        scene.add(model);
        });
    }

    // 3Dモデルの読み込みとシーンへの追加
    addModel(
        "/3d-models/mike.glb", // モデルのパス
        new THREE.Vector3(0, 0, -5), // モデルの位置
        new THREE.Vector3(0.5, 0.5, 0.5) // モデルのスケール
    );

    // アニメーションループの設定
    renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
    });

    // // モデルの読み込み（パスは適宜変更してください）
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