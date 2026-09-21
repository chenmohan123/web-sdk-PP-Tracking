"""一次性研究：原 Paddle 数值参考和固定同摄像头检索协议。"""
import argparse
import ast
import gzip
import json
import os
from pathlib import Path
import time
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
import cv2
import numpy as np
import onnxruntime as ort
import paddle
from export import load_model
from fetch import identity
from data import FRAMES, SEQUENCES

MODES = ["normal-rgb", "normal-bgr", "transposed-rgb", "upstream-transposed-bgr"]


def prepare(crop_bgr, mode):
    crop = crop_bgr if mode.endswith("bgr") else crop_bgr[:, :, ::-1]
    if "transposed" in mode:
        crop = crop.transpose(1, 0, 2)
    resized = cv2.resize(crop, (64, 192), interpolation=cv2.INTER_LINEAR)
    tensor = resized.astype("float32").transpose(2, 0, 1) / 255
    tensor -= np.array([0.485, 0.456, 0.406]).reshape(3, 1, 1)
    tensor /= np.array([0.229, 0.224, 0.225]).reshape(3, 1, 1)
    return np.ascontiguousarray(tensor[None])


def compare(reference, output):
    a, b = np.asarray(reference, dtype=np.float64).reshape(-1), np.asarray(output, dtype=np.float64).reshape(-1)
    assert a.shape == b.shape == (512,)
    assert np.isfinite(a).all() and np.isfinite(b).all()
    norm_a, norm_b = float(np.linalg.norm(a)), float(np.linalg.norm(b))
    assert norm_a > 0 and norm_b > 0
    maximum = float(np.max(np.abs(a - b)))
    cosine = float(1 - a.dot(b) / norm_a / norm_b)
    return {"maxAbs": maximum, "cosineDistance": cosine, "referenceNorm": norm_a, "outputNorm": norm_b,
            "passed": maximum < 1e-3 and cosine < 1e-5}


def upstream_check(work):
    source = (work / "sources/deploy/pptracking/python/mot/utils.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in ["get_crops", "preprocess_reid"]]
    assert len(selected) == 2
    scope = {"cv2": cv2, "np": np}
    exec(compile(ast.Module(body=selected, type_ignores=[]), "audited_preprocessing_only", "exec"), scope)
    rgb = np.random.default_rng(20260919).integers(0, 256, (240, 160, 3), dtype=np.uint8)
    reference = scope["get_crops"](np.array([[11, 7, 140, 230]], dtype=np.float32), rgb, 64, 192)
    actual = prepare(rgb[7:230, 11:140, ::-1], "upstream-transposed-bgr")
    assert np.array_equal(reference, actual)
    return {"matchesSelectedUpstreamFunctionsExactly": True, "input": "RGB HWC，整数、图内 xyxy；只执行两个已审阅的预处理函数"}


def read_samples(work):
    samples = []
    for sequence in SEQUENCES:
        table = np.loadtxt(work / "data" / sequence / "gt/gt.txt", delimiter=",")
        eligible = []
        for frame in FRAMES:
            image = cv2.imread(str(work / "data" / sequence / f"img1/{frame:06d}.jpg"))
            assert image is not None
            height, width = image.shape[:2]
            for row in table[table[:, 0] == frame]:
                _, person, x, y, w, h, mark, category, visibility = row
                # MOT 标注的像素原点为 1；裁剪统一为 0 起点、右/下边界不包含。
                x, y = x - 1, y - 1
                if mark != 1 or category != 1 or visibility < 0.7 or w < 16 or h < 48:
                    continue
                if x < 0 or y < 0 or x + w > width or y + h > height:
                    continue
                x1, y1, x2, y2 = map(int, [x, y, x + w, y + h])
                eligible.append({"sequence": sequence, "frame": frame, "person": int(person),
                                 "xyxy": [x1, y1, x2, y2], "visibility": float(visibility),
                                 "crop": image[y1:y2, x1:x2]})
        gallery_ids = {row["person"] for row in eligible if row["frame"] == 1}
        samples.extend(sorted([row for row in eligible if row["person"] in gallery_ids], key=lambda row: (row["frame"], row["person"])))
    assert all(any(s["sequence"] == seq and s["frame"] > 1 for s in samples) for seq in SEQUENCES)
    return samples


def quality(vectors, samples):
    result = {}
    for mode in MODES:
        records = []
        for sequence in SEQUENCES:
            gallery = [i for i, row in enumerate(samples) if row["sequence"] == sequence and row["frame"] == 1]
            queries = [i for i, row in enumerate(samples) if row["sequence"] == sequence and row["frame"] > 1]
            values = np.asarray(vectors[mode], dtype=np.float64)
            values /= np.linalg.norm(values, axis=1, keepdims=True)
            for index in queries:
                distances = 1 - values[gallery].dot(values[index])
                own = next(j for j, g in enumerate(gallery) if samples[g]["person"] == samples[index]["person"])
                best = int(np.argmin(distances))
                impostors = [float(d) for j, d in enumerate(distances) if j != own]
                records.append({"sampleIndex": index, "sequence": sequence, "frame": samples[index]["frame"],
                                "person": samples[index]["person"], "bestPerson": samples[gallery[best]]["person"],
                                "rank1": best == own, "positiveDistance": float(distances[own]),
                                "negativeDistances": impostors})
        positive = np.asarray([row["positiveDistance"] for row in records])
        negative = np.asarray([x for row in records for x in row["negativeDistances"]])
        result[mode] = {"queries": len(records), "rank1Correct": sum(row["rank1"] for row in records),
                        "rank1": float(np.mean([row["rank1"] for row in records])),
                        "positiveMedian": float(np.median(positive)), "negativeMedian": float(np.median(negative)),
                        "positiveRejectedAt02": int(np.sum(positive > 0.2)), "positivePairs": len(positive),
                        "negativeAcceptedAt02": int(np.sum(negative <= 0.2)), "negativePairs": len(negative),
                        "bySequence": {seq: {"queries": sum(r["sequence"] == seq for r in records),
                                             "correct": sum(r["sequence"] == seq and r["rank1"] for r in records)} for seq in SEQUENCES},
                        "records": records}
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    work = args.work
    start = time.perf_counter()
    preprocessing = upstream_check(work)
    model, _ = load_model(work)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    session = ort.InferenceSession(str(work / "assets/pplcnet-fp32.onnx"), options, providers=["CPUExecutionProvider"])
    fixtures = []

    def add_fixture(name, tensor, reference=None):
        if reference is None:
            with paddle.no_grad():
                reference = model(paddle.to_tensor(tensor)).numpy().reshape(-1)
        output = session.run(None, {"crops": tensor})[0].reshape(-1)
        path = work / "assets" / f"input-{len(fixtures)}.f32"
        tensor.tofile(path)
        item = {"id": len(fixtures), "name": name, "input": {"path": path.name, **identity(path)},
                "reference": reference.tolist(), "pythonOutput": output.tolist(), **compare(reference, output)}
        fixtures.append(item)

    y, x = np.indices((192, 64))
    edges = [("black", np.zeros((192, 64, 3), dtype=np.uint8)), ("white", np.full((192, 64, 3), 255, dtype=np.uint8)),
             ("low-contrast", np.repeat((127 + (x + y) % 2).astype(np.uint8)[:, :, None], 3, axis=2))]
    for color, bgr in [("red", [0, 0, 255]), ("green", [0, 255, 0]), ("blue", [255, 0, 0])]:
        edges.append((color, np.tile(np.array(bgr, dtype=np.uint8), (192, 64, 1))))
    edges.extend([("texture", np.stack([(x * 3 + y * 7) % 256, (x * 17 + y) % 256, (x + y * 23) % 256], axis=2).astype(np.uint8)),
                  ("checkerboard", np.repeat((((x // 4 + y // 4) % 2) * 255).astype(np.uint8)[:, :, None], 3, axis=2))])
    for name, image in edges:
        add_fixture(name, prepare(image, "normal-rgb"))
    samples = read_samples(work)
    vectors = {}
    for mode in MODES:
        outputs = []
        seen = {}
        for index, sample in enumerate(samples):
            tensor = prepare(sample["crop"], mode)
            with paddle.no_grad():
                output = model(paddle.to_tensor(tensor)).numpy().reshape(-1)
            assert output.shape == (512,) and np.isfinite(output).all() and np.linalg.norm(output) > 0
            outputs.append(output.tolist())
            key = (sample["sequence"], sample["frame"])
            seen[key] = seen.get(key, 0) + 1
            if mode == "normal-rgb" and seen[key] <= 2:
                add_fixture(f"{sample['sequence']}-f{sample['frame']}-id{sample['person']}-{mode}", tensor, output)
        vectors[mode] = outputs
        print(mode, len(outputs), "实际裁剪已完成", flush=True)
    metadata = [{k: v for k, v in sample.items() if k != "crop"} for sample in samples]
    result = {"date": "2026-09-19", "model": identity(work / "assets/pplcnet-fp32.onnx"),
              "paddle": paddle.__version__, "onnxruntime": ort.__version__, "opencv": cv2.__version__, "numpy": np.__version__,
              "threads": 1, "graphOptimizationLevel": "basic", "inputShape": [1, 3, 192, 64], "outputShape": [1, 512],
              "tolerance": {"maxAbs": 1e-3, "cosineDistance": 1e-5}, "preprocessingCheck": preprocessing,
              "fixtures": fixtures, "samples": metadata, "quality": quality(vectors, metadata),
              "qualityVectors": vectors, "elapsedSeconds": time.perf_counter() - start}
    with gzip.open(work / "python-result.json.gz", "wt", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    (work / "assets/fixtures.json").write_text(json.dumps(fixtures, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(json.dumps({"fixtures": len(fixtures), "passed": sum(x["passed"] for x in fixtures), "maxAbs": max(x["maxAbs"] for x in fixtures),
                      "quality": {k: {f: v for f, v in value.items() if f != "records"} for k, value in result["quality"].items()}}, ensure_ascii=False, indent=2))
    assert all(x["passed"] for x in fixtures), "原始 Paddle 与 ONNX 对齐失败，保留证据"


if __name__ == "__main__":
    main()
