"""一次性图适配：按原 IR 的 MVN 公式展开归一化，独立核对轴与 epsilon。"""
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
import onnx

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
source = ASSETS / "reid-0288-fp32.onnx"
target = ASSETS / "reid-0288-fp32-ort.onnx"
model = onnx.load(str(source))
ir = ET.parse(ASSETS / "person-reidentification-retail-0288.xml")
layers = {layer.attrib["id"]: layer for layer in ir.findall("./layers/layer")}
by_name = {layer.attrib["name"]: layer for layer in layers.values()}
weights = (ASSETS / "person-reidentification-retail-0288.bin").read_bytes()
changes = []
nodes = []
for node in model.graph.node:
    if node.op_type != "LayerNormalization":
        nodes.append(node)
        continue
    original = by_name[node.name]
    shape = [int(d.text) for d in original.findall('./input/port[@id="0"]/dim')]
    attrs = {a.name: onnx.helper.get_attribute_value(a) for a in node.attribute}
    axes = list(range(attrs["axis"], len(shape)))
    edge = next(e for e in ir.findall("./edges/edge") if e.attrib["to-layer"] == original.attrib["id"] and e.attrib["to-port"] == "1")
    data = layers[edge.attrib["from-layer"]].find("data").attrib
    start, size = int(data["offset"]), int(data["size"])
    assert np.frombuffer(weights[start:start + size], dtype="<i8").tolist() == axes
    settings = original.find("data").attrib
    assert settings["eps_mode"] == "INSIDE_SQRT" and settings["normalize_variance"] == "true"
    assert attrs["epsilon"] == float(settings["eps"]) > 0
    assert len(node.output) == 1 and len(node.input) == 2
    prefix = node.name + "/explicit_mvn"
    def op(kind, inputs, suffix, **kwargs):
        output = prefix + "/" + suffix
        nodes.append(onnx.helper.make_node(kind, inputs, [output], name=output, **kwargs))
        return output
    mean = op("ReduceMean", [node.input[0]], "mean", axes=axes, keepdims=1)
    centered = op("Sub", [node.input[0], mean], "centered")
    squared = op("Mul", [centered, centered], "squared")
    variance = op("ReduceMean", [squared], "variance", axes=axes, keepdims=1)
    epsilon = prefix + "/epsilon"
    nodes.append(onnx.helper.make_node("Constant", [], [epsilon], name=epsilon, value=onnx.numpy_helper.from_array(np.array(attrs["epsilon"], dtype=np.float32))))
    adjusted = op("Add", [variance, epsilon], "variance_epsilon")
    std = op("Sqrt", [adjusted], "std")
    normalized = op("Div", [centered, std], "normalized")
    nodes.append(onnx.helper.make_node("Mul", [normalized, node.input[1]], list(node.output), name=prefix + "/scaled"))
    changes.append({"node": node.name, "shape": shape, "axes": axes, "epsilon": attrs["epsilon"], "replacement": "(x - mean(x)) / sqrt(mean((x - mean(x)) ** 2) + epsilon) * scale", "reason": "明确保持原 IR 的 INSIDE_SQRT 与中心化方差语义，规避单元素限制和常量输入数值异常"})
assert len(changes) == 14, changes
del model.graph.node[:]
model.graph.node.extend(nodes)
model.doc_string = "本地可行性探针；由 Intel OMZ 0288 FP32 转换，14 个 MVN 用中心化方差公式展开；不是发布模型。"
onnx.checker.check_model(model, full_check=True)
onnx.save(model, str(target))
record = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "targetSha256": hashlib.sha256(target.read_bytes()).hexdigest(), "changes": changes}
(ROOT / "adaptation.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record, ensure_ascii=False, indent=2))
