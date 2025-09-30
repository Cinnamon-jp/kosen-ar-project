## 環境構築
```bash
> npm install
```

## ルール
* TypeScriptはES Modules形式`import / export`, etc.で記述すること。
* コールバック関数はアロー関数`() => {}`で、コールバック関数以外の関数は関数宣言`function example() {}`で記述すること。

## ビルド時のCDN利用
* `vite-plugin-cdn-import` により本番ビルドでは `onnxruntime-web` を jsDelivr からロード。
* URL内のバージョンは `vite.config.ts` で固定しているため、依存を更新する際は併せて変更が必要。
