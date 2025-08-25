## 依存関係のインストール
`frontend/`, `backend/`で以下のコマンドを実行して、プロジェクトの依存関係をインストールしてください。
```bash
npm install
```

## ルール
* TypeScriptはES Modules形式`import / export`, etc.で記述すること。
* コールバック関数はアロー関数`() => {}`で、コールバック関数以外の関数は関数宣言`function example() {}`で記述すること。

## 使用している技術スタック
* 基本的に **TypeScript** で記述
* **prettier** を使用してコードのフォーマットを統一
* **vite** を使用してプロジェクトをビルド
---
* 物体検出には **YOLO11** をファインチューニングして使用する
* 物体検出モデルは **onnxruntime-web** を使用して動作させる
* 物体検出モデルは **WebGL** (可能であれば **WebGPU** ) を使用して推論を行う
* 必要に応じて **WebAssembly** ( **AssemblyScript** ) を使用する
---
* 物体検出モデル作成・変換時のPythonプロジェクトは **Docker** で構築した **Linux (Ubuntu)** 環境で作成
* Pythonプロジェクトのバージョン・パッケージ管理には、**uv** を使用