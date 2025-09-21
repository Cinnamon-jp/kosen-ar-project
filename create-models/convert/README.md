## 環境構築
```bash
# パッケージの同期
> uv sync
```

## モデルの出力・テスト
```bash
# ファイル内の設定に基づいてONNXモデルを出力 + テストを実行
> uv run yolo.py
```
**※ONNXモデルはルートディレクトリに出力される（必要に応じて `models/` に移動させること）**

## 諸情報
yolo11n.pt: 5.4 MB, 100 layers, 2,616,248 parameters, 6.5 GFLOPs  
yolo11s.pt: 18.4 MB, 100 layers, 9,443,760 parameters, 21.5 GFLOPs  
yolo11m.pt: 38.8 MB, 125 layers, 20,091,712 parameters, 68.0 GFLOPs  

yolo11n.onnx: 10.2 MB  
yolo11s.onnx: 36.3 MB  
yolo11m.onnx: 76.9 MB  

`PyTorch: starting from 'yolo11m.pt' with input shape (1, 3, 640, 640) BCHW and output shape(s) (1, 300, 6)`