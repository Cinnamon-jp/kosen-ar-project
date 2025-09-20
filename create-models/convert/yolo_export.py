from ultralytics import YOLO

# 基となるPyTorchモデルを指定（存在しない場合、自動ダウンロードされる）
model = YOLO("yolo11n.pt")

model.export(format="onnx",
            imgsz=640,
            half=False, # FP16量子化
            dynamic=False,
            simplify=False,
            nms=True,
            batch=1,
            device=None
            )
