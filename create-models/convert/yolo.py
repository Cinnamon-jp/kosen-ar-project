from ultralytics import YOLO

# 基となるモデル名を指定
baseModel = "yolo11n" # yolo11n, yolo11s, yolo11m

# PyTorchモデルの格納（存在しない場合、自動ダウンロードされる）
model = YOLO(baseModel + ".pt")

model.export(format="onnx",
            imgsz=640,
            half=False, # FP16量子化
            dynamic=False,
            simplify=True, # ONNXslimによるモデル簡略化
            nms=True,
            batch=1,
            device=None
            )

#----- TEST -----

# テストするONXモデルを指定
onnx_model = YOLO(baseModel + ".onnx")

# Run inference
onnx_results = onnx_model("https://ultralytics.com/images/bus.jpg")