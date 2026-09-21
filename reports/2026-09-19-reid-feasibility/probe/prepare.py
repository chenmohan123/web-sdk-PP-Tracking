"""一次性数值探针：合成张量不用于证明行人识别质量。"""
import collections
import hashlib
import importlib.metadata
import json
import platform
import time
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
import openvino as ov

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
model_path = ASSETS / "reid-0288-fp32-ort.onnx"
model = onnx.load(str(model_path))
onnx.checker.check_model(model, full_check=True)
assert [(x.domain, x.version) for x in model.opset_import] == [("", 17)]
ov_model = ov.Core().compile_model(str(ASSETS / "person-reidentification-retail-0288.xml"), "CPU", {"INFERENCE_PRECISION_HINT": "f32"})
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])

def compare(left, right):
    a, b = left.astype(np.float64).ravel(), right.astype(np.float64).ravel()
    assert np.isfinite(a).all() and np.isfinite(b).all()
    assert np.linalg.norm(a) > 0 and np.linalg.norm(b) > 0
    return {"maxAbs": float(np.max(np.abs(a - b))), "cosineDistance": float(1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))}

index = np.arange(3 * 256 * 128, dtype=np.uint32).reshape(1, 3, 256, 128)
inputs = [np.zeros_like(index, dtype=np.float32), np.full_like(index, 255, dtype=np.float32)]
inputs += [((index * (i * 2 + 1) + i * 37) % 256).astype(np.float32) for i in range(1, 7)]
fixtures = []
for i, tensor in enumerate(inputs):
    tensor.astype("<f4").tofile(ASSETS / f"input-{i}.f32")
    reference = ov_model([tensor])[0]
    output = session.run(None, {"data": tensor})[0]
    assert output.shape == (1, 256)
    metrics = compare(reference, output)
    assert metrics["maxAbs"] < 1e-3 and metrics["cosineDistance"] < 1e-5, metrics
    fixtures.append({"id": i, "reference": reference.ravel().tolist(), "onnx": output.ravel().tolist(), "comparison": metrics, "referenceNorm": float(np.linalg.norm(reference)), "inputSha256": hashlib.sha256((ASSETS / f"input-{i}.f32").read_bytes()).hexdigest()})
(ASSETS / "fixtures.json").write_text(json.dumps(fixtures, indent=2) + "\n", encoding="utf-8")

for _ in range(5):
    session.run(None, {"data": inputs[2]})
timings = []
for i in range(30):
    start = time.perf_counter()
    session.run(None, {"data": inputs[i % len(inputs)]})
    timings.append((time.perf_counter() - start) * 1000)

constants = {node.output[0]: onnx.numpy_helper.to_array(node.attribute[0].t) for node in model.graph.node if node.op_type == "Constant" and node.attribute and node.attribute[0].type == onnx.AttributeProto.TENSOR}
preprocessing = []
reachable = {"data"}
for node in model.graph.node:
    if any(name in reachable for name in node.input) and len(preprocessing) < 5:
        preprocessing.append({"op": node.op_type, "inputs": list(node.input), "constants": {name: constants[name].tolist() for name in node.input if name in constants and constants[name].size < 10}})
        reachable.update(node.output)

result = {"date": "2026-09-19", "purpose": "一次性转换/执行成本探针，非行人识别或跟踪质量验证", "platform": platform.platform(), "versions": {name: importlib.metadata.version(name) for name in ("numpy", "onnx", "onnxruntime", "openvino", "openvino2onnx")}, "model": {"bytes": model_path.stat().st_size, "sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(), "opset": 17, "input": {"name": "data", "shape": [1, 3, 256, 128], "dtype": "float32", "color": "BGR", "range": [0, 255]}, "output": {"name": session.get_outputs()[0].name, "shape": [1, 256]}, "operators": dict(collections.Counter(node.op_type for node in model.graph.node)), "firstOperations": preprocessing}, "validation": {"fixtureCount": len(fixtures), "maxAbs": max(f["comparison"]["maxAbs"] for f in fixtures), "maxCosineDistance": max(f["comparison"]["cosineDistance"] for f in fixtures), "tolerance": {"maxAbs": 1e-3, "cosineDistance": 1e-5}, "passed": True}, "pythonOrtSingleThread": {"warmup": 5, "iterations": 30, "medianMs": float(np.median(timings)), "p95Ms": float(np.percentile(timings, 95)), "rawMs": timings}}
(ROOT / "python-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"model": result["model"], "validation": result["validation"], "medianMs": result["pythonOrtSingleThread"]["medianMs"]}, ensure_ascii=False, indent=2))
