import * as THREE from "three";

export default function animate(canvas: HTMLCanvasElement): void {
    if (!canvas) throw new Error("3D描画用のコンテナが見つかりません");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
    );

    // canvas要素に直接描画するように指定
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true, // 背景を透過させる
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    // 背景を透明にする
    renderer.setClearColor(0x000000, 0);

    window.addEventListener("resize", () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 5;

    renderer.setAnimationLoop(() => {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
    });
}