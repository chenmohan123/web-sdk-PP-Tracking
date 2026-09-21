"""独立序列质量对照与浏览器图像输入参考；不修改前一轮研究。"""
import argparse
import gzip
import json
import os
from pathlib import Path
import shutil
import time
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
import cv2
import numpy as np
import onnxruntime as ort
import paddle
from data import SEQUENCES, FRAMES, identity, PREVIOUS
from reference import prepare_rgba

MODES = ["opencv-rgb", "opencv-bgr", "float-rgb", "float-bgr"]
MODEL_SHA = "24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4"


def opencv(crop, bgr=False):
    rgb = crop[:, :, :3][:, :, ::-1] if bgr else crop[:, :, :3]
    value = cv2.resize(rgb, (64, 192), interpolation=cv2.INTER_LINEAR).astype(np.float32).transpose(2, 0, 1) / 255
    value -= np.array([.485, .456, .406]).reshape(3, 1, 1)
    value /= np.array([.229, .224, .225]).reshape(3, 1, 1)
    return np.ascontiguousarray(value[None])


def distances(a, b):
    a, b = np.asarray(a, dtype=np.float64).reshape(-1), np.asarray(b, dtype=np.float64).reshape(-1)
    assert a.shape == b.shape and np.isfinite(a).all() and np.isfinite(b).all()
    norms = np.linalg.norm(a), np.linalg.norm(b)
    assert min(norms) > 0
    return {"maxAbs": float(np.max(np.abs(a-b))), "cosineDistance": float(1 - a.dot(b) / norms[0] / norms[1])}


def metrics(samples, vectors):
    result = {}
    for mode in MODES:
        values = np.asarray(vectors[mode], dtype=np.float64)
        values /= np.linalg.norm(values, axis=1, keepdims=True)
        by_sequence, records = {}, []
        for sequence in SEQUENCES:
            gallery = [i for i, row in enumerate(samples) if row["sequence"] == sequence and row["frame"] == 1]
            queries = [i for i, row in enumerate(samples) if row["sequence"] == sequence and row["frame"] > 1]
            correct = 0
            for index in queries:
                d = 1 - values[gallery].dot(values[index])
                own = next(j for j, g in enumerate(gallery) if samples[g]["person"] == samples[index]["person"])
                best = int(np.argmin(d))
                correct += own == best
                records.append({"sampleIndex": index, "sequence": sequence, "person": samples[index]["person"],
                                "bestPerson": samples[gallery[best]]["person"], "correct": own == best,
                                "positiveDistance": float(d[own]), "negativeDistances": [float(v) for j, v in enumerate(d) if j != own]})
            by_sequence[sequence] = {"gallery": len(gallery), "queries": len(queries), "correct": correct,
                                     "rank1": correct / len(queries) if queries else None}
        positives = [r["positiveDistance"] for r in records]
        negatives = [v for r in records for v in r["negativeDistances"]]
        result[mode] = {"queries": len(records), "correct": sum(r["correct"] for r in records),
                        "rank1": float(np.mean([r["correct"] for r in records])),
                        "macroRank1": float(np.mean([v["rank1"] for v in by_sequence.values() if v["rank1"] is not None])),
                        "bySequence": by_sequence, "records": records,
                        "thresholdDiagnostics": [{"threshold": t, "positivePairs": len(positives), "positiveRejected": sum(v > t for v in positives),
                                                  "negativePairs": len(negatives), "negativeAccepted": sum(v <= t for v in negatives)} for t in [.1, .2, .3, .4]]}
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True, type=Path)
    parser.add_argument("--previous-work", default=".tmp/pplcnet-reid", type=Path)
    args = parser.parse_args()
    work, assets = args.work, args.work / "assets"
    assets.mkdir(exist_ok=True, parents=True)
    old = args.previous_work
    model_path = old / "assets/pplcnet-fp32.onnx"
    assert identity(model_path)["sha256"] == MODEL_SHA
    conversion = json.loads((PREVIOUS / "evidence/conversion.json").read_text(encoding="utf-8"))
    paddle_assets = {name: identity(old / "assets" / name) for name in ["pplcnet.pdmodel", "pplcnet.pdiparams"]}
    assert all(value == conversion["assets"][name] for name, value in paddle_assets.items()), "Paddle原始参考已变化"
    shutil.copyfile(model_path, assets / "model.onnx")
    original = paddle.jit.load(str(old / "assets/pplcnet"))
    original.eval()
    options = ort.SessionOptions()
    options.intra_op_num_threads = options.inter_op_num_threads = 1
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    session = ort.InferenceSession(str(model_path), options, providers=["CPUExecutionProvider"])
    samples, fixtures, vectors = [], [], {mode: [] for mode in MODES}
    decoded = []

    def add_fixture(name, rgba, box, real=False, jpeg=None, png=True):
        number = len(fixtures)
        tensor = prepare_rgba(rgba, box)
        with paddle.no_grad():
            reference = original(paddle.to_tensor(tensor)).numpy().reshape(-1)
        output = session.run(None, {"crops": tensor})[0].reshape(-1)
        error = distances(reference, output)
        assert error["maxAbs"] < 1e-3 and error["cosineDistance"] < 1e-5
        raw_path, input_path = assets / f"rgba-{number}.u8", assets / f"tensor-{number}.f32"
        rgba.tofile(raw_path)
        tensor.tofile(input_path)
        png_path = assets / f"image-{number}.png"
        assert cv2.imwrite(str(png_path), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
        fixtures.append({"id": number, "name": name, "real": real, "width": rgba.shape[1], "height": rgba.shape[0], "box": box,
                         "rgba": {"path": raw_path.name, **identity(raw_path)}, "tensor": {"path": input_path.name, **identity(input_path)},
                         "png": {"path": png_path.name, **identity(png_path)} if png else None,
                         "transparentPngDiagnostic": {"path": png_path.name, **identity(png_path)} if not png else None,
                         "jpeg": jpeg, "reference": reference.tolist(), "pythonOutput": output.tolist(), "pythonError": error})

    artificial = [
        ("red-single", np.array([[[255, 0, 0, 255]]], dtype=np.uint8), {"x": 0, "y": 0, "width": 1, "height": 1}),
        ("transparent", np.array([[[19, 110, 247, 0], [0, 0, 0, 128]]], dtype=np.uint8), {"x": 0, "y": 0, "width": 2, "height": 1}),
        ("black", np.full((9, 3, 4), [0, 0, 0, 255], dtype=np.uint8), {"x": 0, "y": 0, "width": 3, "height": 9}),
        ("white", np.full((3, 9, 4), 255, dtype=np.uint8), {"x": 0, "y": 0, "width": 9, "height": 3}),
    ]
    y, x = np.indices((29, 13))
    pattern = np.stack([(x*17+y*3)%256, (x*5+y*11)%256, (x*29+y)%256, np.full_like(x, 255)], axis=2).astype(np.uint8)
    artificial += [("fractional", pattern, {"x": 1.2, "y": 2.7, "width": 7.3, "height": 23.2}),
                   ("clipped", pattern, {"x": -3.8, "y": -1.2, "width": 12.1, "height": 34.5}),
                   ("single-column", pattern, {"x": 12, "y": 0, "width": 1, "height": 29}),
                   ("single-row", pattern, {"x": 0, "y": 28, "width": 13, "height": 1})]
    for name, rgba, box in artificial:
        add_fixture(name, rgba, box, png=name != "transparent")

    start = time.perf_counter()
    for sequence in SEQUENCES:
        gt = np.loadtxt(work / "data" / sequence / "gt/gt.txt", delimiter=",")
        eligible = []
        for frame in FRAMES:
            source = work / "data" / sequence / f"img1/{frame:06d}.jpg"
            rgba = cv2.cvtColor(cv2.imread(str(source)), cv2.COLOR_BGR2RGBA)
            height, width = rgba.shape[:2]
            rows = []
            for row in gt[gt[:, 0] == frame]:
                _, person, x, y, w, h, mark, category, visibility = row
                x, y = x-1, y-1
                if mark != 1 or category != 1 or visibility < .7 or w < 16 or h < 48 or x < 0 or y < 0 or x+w > width or y+h > height:
                    continue
                assert all(v == int(v) for v in [x, y, w, h]), "本协议真实GT为整数；若变化不得隐式更改裁剪"
                box = dict(zip(["x", "y", "width", "height"], map(int, [x, y, w, h])))
                rows.append({"sequence": sequence, "frame": frame, "person": int(person), "box": box, "visibility": float(visibility), "crop": rgba[int(y):int(y+h), int(x):int(x+w)]})
            rows.sort(key=lambda r: r["person"])
            eligible.extend(rows)
            if rows:
                jpeg = None
                if frame == 1:
                    target = assets / f"jpeg-{sequence}.jpg"
                    shutil.copyfile(source, target)
                    jpeg = {"path": target.name, **identity(target)}
                add_fixture(f"{sequence}-f{frame}-id{rows[0]['person']}", rgba, rows[0]["box"], True, jpeg)
            decoded.append({"sequence": sequence, "frame": frame, "eligible": len(rows)})
        gallery_ids = {r["person"] for r in eligible if r["frame"] == 1}
        selected = [r for r in eligible if r["person"] in gallery_ids]
        for sample in selected:
            crop = sample["crop"]
            full = {"x": 0, "y": 0, "width": crop.shape[1], "height": crop.shape[0]}
            for mode in MODES:
                tensor = opencv(crop, mode.endswith("bgr")) if mode.startswith("opencv") else prepare_rgba(crop, full, mode.endswith("bgr"))
                vector = session.run(None, {"crops": tensor})[0].reshape(-1)
                assert vector.shape == (512,) and np.isfinite(vector).all() and np.linalg.norm(vector) > 0
                vectors[mode].append(vector.tolist())
            samples.append({k: v for k, v in sample.items() if k != "crop"})
        print(sequence, "裁剪", len(selected), "图库", len(gallery_ids), flush=True)
    result = {"date": "2026-09-20", "model": identity(model_path), "paddleAssets": paddle_assets, "paddle": paddle.__version__, "onnxruntime": ort.__version__,
              "opencv": cv2.__version__, "numpy": np.__version__, "decoded": decoded, "samples": samples,
              "fixtures": fixtures, "vectors": vectors, "quality": metrics(samples, vectors), "qualityElapsedSeconds": time.perf_counter()-start}
    with gzip.open(work / "python-result.json.gz", "wt", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    (assets / "fixtures.json").write_text(json.dumps(fixtures, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(json.dumps({"samples": len(samples), "fixtures": len(fixtures), "quality": {m: {k: v for k, v in r.items() if k != "records"} for m, r in result["quality"].items()}}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
