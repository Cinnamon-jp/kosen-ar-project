from ultralytics import YOLO

model = YOLO("yolo11n.pt")

model.export(format="onnx",
            imgsz=640,
            half=False,
            dynamic=False,
            simplify=False,
            nms=True,
            batch=1,
            device=None
            )
