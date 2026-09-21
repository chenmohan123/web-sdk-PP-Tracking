"""离线复算归档中的数值、检索结论和性能统计；不需要模型或原图。"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parent


def cosine(a, b):
    assert len(a) == len(b) == 512
    assert all(math.isfinite(x) for x in a + b)
    na, nb = math.hypot(*a), math.hypot(*b)
    assert na > 0 and nb > 0
    return 1 - math.fsum(x * y for x, y in zip(a, b)) / na / nb


def near(actual, expected):
    assert math.isclose(actual, expected, abs_tol=1e-12, rel_tol=1e-9), (actual, expected)


def numerical(ref, output, recorded):
    error = max(abs(a - b) for a, b in zip(ref, output))
    distance = cosine(ref, output)
    near(error, recorded["maxAbs"])
    near(distance, recorded["cosineDistance"])
    assert recorded["passed"] == (error < 1e-3 and distance < 1e-5)
    assert recorded["passed"]


def main():
    lock = json.loads((ROOT / "evidence.lock.json").read_text(encoding="utf-8"))
    for entry in lock:
        data = (ROOT / entry["path"]).read_bytes()
        assert len(data) == entry["bytes"]
        assert hashlib.sha256(data).hexdigest() == entry["sha256"], entry["path"]
    python = json.loads(gzip.decompress((ROOT / "evidence/python-result.json.gz").read_bytes()))
    browser = json.loads(gzip.decompress((ROOT / "evidence/browser-result.json.gz").read_bytes()))
    conversion = json.loads((ROOT / "evidence/conversion.json").read_text(encoding="utf-8"))
    assert conversion["assets"]["pplcnet-fp32.onnx"] == python["model"]
    assert browser["modelSha256"] == python["model"]["sha256"]
    assert len(python["fixtures"]) == 32 and len(python["samples"]) == 120
    assert {x["backend"] for x in browser["results"]} == {"wasm", "webgpu"} and not browser["errors"]
    for fixture in python["fixtures"]:
        numerical(fixture["reference"], fixture["pythonOutput"], fixture)
    for backend in browser["results"]:
        assert backend["status"] == "ran" and backend["validationPassed"]
        assert backend["modelSha256"] == python["model"]["sha256"]
        assert len(backend["validation"]) == len(python["fixtures"])
        if backend["backend"] == "webgpu":
            assert backend["disableCpuEpFallback"] and backend["adapterInfo"]["isFallbackAdapter"] is False
            assert backend["runtimeAdapterInfo"]["isFallbackAdapter"] is False
            assert backend["runtimeAdapterInfo"]["vendor"] == "nvidia"
        for fixture, actual in zip(python["fixtures"], backend["validation"]):
            assert fixture["id"] == actual["id"] and fixture["name"] == actual["name"]
            numerical(fixture["reference"], actual["output"], actual)
        for timing in [backend["warm"], *backend["serialCrops"]]:
            values = timing["rawMs"]
            assert len(values) == timing["iterations"] and all(math.isfinite(x) and x >= 0 for x in values)
            near(statistics.median(values), timing["medianMs"])
            near(sorted(values)[math.ceil(len(values) * 0.95) - 1], timing["p95Ms"])
    samples = python["samples"]
    for mode, summary in python["quality"].items():
        vectors = python["qualityVectors"][mode]
        assert len(vectors) == len(samples)
        positive, negative, correct = [], [], 0
        expected_queries = [i for i, row in enumerate(samples) if row["frame"] != 1]
        assert [r["sampleIndex"] for r in summary["records"]] == expected_queries
        for record in summary["records"]:
            index = record["sampleIndex"]
            sample = samples[index]
            gallery = [i for i, row in enumerate(samples) if row["frame"] == 1 and row["sequence"] == sample["sequence"]]
            distances = [cosine(vectors[index], vectors[g]) for g in gallery]
            own = next(j for j, g in enumerate(gallery) if samples[g]["person"] == sample["person"])
            best = min(range(len(gallery)), key=lambda j: distances[j])
            assert record["bestPerson"] == samples[gallery[best]]["person"]
            assert record["rank1"] == (own == best)
            near(record["positiveDistance"], distances[own])
            negatives = [d for j, d in enumerate(distances) if j != own]
            assert len(negatives) == len(record["negativeDistances"])
            for actual, expected in zip(negatives, record["negativeDistances"]):
                near(actual, expected)
            correct += own == best
            positive.append(distances[own])
            negative.extend(negatives)
        assert correct == summary["rank1Correct"]
        assert len(positive) == summary["queries"] == summary["positivePairs"] == 95
        assert len(negative) == summary["negativePairs"] == 1274
        near(correct / len(positive), summary["rank1"])
        near(statistics.median(positive), summary["positiveMedian"])
        near(statistics.median(negative), summary["negativeMedian"])
        assert sum(x > 0.2 for x in positive) == summary["positiveRejectedAt02"]
        assert sum(x <= 0.2 for x in negative) == summary["negativeAcceptedAt02"]
    print(json.dumps({"归档文件": len(lock), "数值对齐": "Python/WASM/WebGPU 各 32/32", "真实查询": 95,
                      "四种预处理检索复算": "通过", "性能统计复算": "通过"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
