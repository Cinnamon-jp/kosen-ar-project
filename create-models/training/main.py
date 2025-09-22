from ultralytics import YOLO

# 基となるモデルのロード
model = YOLO("yolo11n.pt")

# モデルのトレーニング
results = model.train(
    data="dataset.yaml",
    epochs=100, # エポック数
    batch=16,
    imgsz=640,
    save=True, # 最終モデルの保存
    save_period=-1, # 中間モデル生成の間隔（エポック数）
    cache=False, # 画像のキャッシュ
    device=None, # 学習に使用するデバイス（0: 単一のGPU, [0, 1]: 複数のGPU, -1, アイドル状態のGPU, [-1, -1]: 複数のアイドル状態のGPU, cpu: CPU）
    project=None, # トレーニング出力が保存されるディレクトリの名前
    name=None, # トレーニングの名前
    exist_ok=False, # 既存の project/name の上書き
    pretrained=True, # 事前学習済みモデルの使用
    optimizer="auto", # オプティマイザの選択（'SGD', 'Adam', 'AdamW', 'NAdam', 'RAdam', 'RMSProp', 'auto'）
    seed=0, # 乱数シードの設定
    deterministic=True, # 再現性のために決定論的な動作を使用
    resume=False, # 中断したトレーニングの再開
    dropout=0.0, # ドロップアウト率
    )