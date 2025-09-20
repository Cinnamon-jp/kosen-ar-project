from ultralytics import YOLO

# テストするONXモデルを指定
onnx_model = YOLO("models/yolo11n.onnx")

# Run inference
onnx_results = onnx_model("https://ultralytics.com/images/bus.jpg")
