"""复核封存证据；归档通过与模型不通过是两个独立结论。"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8-sig"))

def compare(a, b):
    assert len(a) == len(b) == 256
    assert all(math.isfinite(value) for value in a + b)
    norm_a, norm_b = sum(x * x for x in a), sum(x * x for x in b)
    assert norm_a > 0 and norm_b > 0
    return {"maxAbs": max(abs(x - y) for x, y in zip(a, b)), "cosineDistance": 1 - sum(x * y for x, y in zip(a, b)) / math.sqrt(norm_a * norm_b)}

def check_metrics(measured, saved):
    for key in ("maxAbs", "cosineDistance"):
        assert math.isclose(measured[key], saved[key], rel_tol=1e-10, abs_tol=1e-12), (key, measured, saved)

lock = read("evidence.lock.json")
for entry in lock["files"]:
    path = ROOT / entry["path"]
    assert path.resolve().is_relative_to(ROOT.resolve())
    data = path.read_bytes()
    assert len(data) == entry["bytes"] and hashlib.sha256(data).hexdigest() == entry["sha256"], entry["path"]

fixtures = read("evidence/fixtures.json")
python_result = read("evidence/python-result.json")
browser = read("evidence/browser-result.json")
adaptation = read("evidence/adaptation.json")
assert len(fixtures) == 8 and [f["id"] for f in fixtures] == list(range(8))
assert adaptation["targetSha256"] == python_result["model"]["sha256"] == browser["modelSha256"]
assert python_result["model"]["bytes"] == 991822
assert len(adaptation["changes"]) == 14
assert browser["tolerance"] == python_result["validation"]["tolerance"] == {"maxAbs": 1e-3, "cosineDistance": 1e-5}
python_metrics = []
for fixture in fixtures:
    metrics = compare(fixture["reference"], fixture["onnx"])
    check_metrics(metrics, fixture["comparison"])
    assert metrics["maxAbs"] < 1e-3 and metrics["cosineDistance"] < 1e-5
    python_metrics.append(metrics)
assert math.isclose(max(x["maxAbs"] for x in python_metrics), python_result["validation"]["maxAbs"], abs_tol=1e-12)
assert python_result["validation"]["passed"] is True

assert browser["errors"] == []
assert [result["backend"] for result in browser["results"]] == ["wasm", "webgpu"]
for result in browser["results"]:
    assert result["status"] == "ran" and result["validationPassed"] is False
    assert len(result["validation"]) == 8
    assert result["ortVersion"]["web"] == "1.27.0"
    assert result["graphOptimizationLevel"] == "basic"
    if result["backend"] == "webgpu":
        assert result["disableCpuEpFallback"] is True
        assert result["adapterInfo"]["vendor"] == "nvidia"
        assert result["adapterInfo"]["isFallbackAdapter"] is False
    failed = []
    for i, sample in enumerate(result["validation"]):
        assert sample["id"] == i
        metrics = compare(fixtures[i]["reference"], sample["output"])
        check_metrics(metrics, sample)
        if metrics["maxAbs"] >= 1e-3 or metrics["cosineDistance"] >= 1e-5:
            failed.append(i)
    assert failed == [0, 1], (result["backend"], failed)
    assert len(result["warm"]["rawMs"]) == 30
    for timing in [result["warm"], *result["serialCrops"]]:
        values = sorted(timing["rawMs"])
        assert all(math.isfinite(x) and x >= 0 for x in values)
        assert timing["medianMs"] == values[len(values) // 2]
        assert timing["p95Ms"] == values[math.ceil(len(values) * 0.95) - 1]
print("归档哈希及原始向量复算通过：Python 8/8；WASM 6/8、WebGPU 6/8，浏览器模型验收仍为失败。")
