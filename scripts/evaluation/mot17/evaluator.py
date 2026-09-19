"""固定数据下载/提取和官方 TrackEval 评分；仅供离线评测。"""
import argparse
import configparser
import hashlib
import importlib
import json
from pathlib import Path
import subprocess
import sys
import types
import urllib.request
import zipfile

LOCK = json.loads(Path(__file__).with_name("lock.json").read_text(encoding="utf-8"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare(archive, output):
    data = archive.read_bytes()
    expected = LOCK["dataset"]
    if len(data) != expected["bytes"] or digest(data) != expected["sha256"]:
        raise ValueError("数据包大小/SHA256 不匹配，拒绝提取")
    metadata = {}
    with zipfile.ZipFile(archive) as source:
        for name in expected["sequences"]:
            metadata[name] = {}
            # 固定白名单，不使用 extractall；不下载和解压媒体。
            for relative in ["seqinfo.ini", "det/det.txt", "gt/gt.txt"]:
                content = source.read(f"train/{name}/{relative}")
                target = output / name / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as stream:
                    stream.write(content)
                metadata[name][relative] = {"bytes": len(content), "sha256": digest(content)}
    return metadata


def load_official(root):
    actual = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    if actual != LOCK["trackeval"]["commit"]:
        raise ValueError("TrackEval 提交不匹配")
    subprocess.run(["git", "-C", str(root), "diff", "--exit-code", "HEAD", "--"], check=True, capture_output=True)
    # 仅装载官方依赖闭包，避免顶层 __init__ 导入无关视频数据集、绘图和可选扩展。
    # 不修改任何评分源码、预处理、阈值或 NumPy 行为。
    for name, relative in [("trackeval", "trackeval"), ("trackeval.datasets", "trackeval/datasets"), ("trackeval.metrics", "trackeval/metrics")]:
        module = types.ModuleType(name)
        module.__path__ = [str(root / relative)]
        sys.modules[name] = module
    import numpy
    import scipy
    for name, module in [("numpy", numpy), ("scipy", scipy)]:
        if module.__version__ != LOCK["pythonDependencies"][name]:
            raise ValueError(f"{name} 版本不匹配：{module.__version__}")
    dataset = importlib.import_module("trackeval.datasets.mot_challenge_2d_box").MotChallenge2DBox
    identity = importlib.import_module("trackeval.metrics.identity").Identity
    clear = importlib.import_module("trackeval.metrics.clear").CLEAR
    files = {str(Path(module.__file__).relative_to(root)).replace("\\", "/"): digest(Path(module.__file__).read_bytes()) for name, module in sys.modules.items() if name.startswith("trackeval") and getattr(module, "__file__", None)}
    return dataset, identity, clear, {"commit": actual, "licenseSha256": digest((root / "LICENSE").read_bytes()), "loadedFiles": files, "python": sys.version, "dependencies": {"numpy": numpy.__version__, "scipy": scipy.__version__}}


def score(root, ground_truth, trackers, sequences, configurations):
    Dataset, Identity, Clear, provenance = load_official(root)
    dataset = Dataset({"GT_FOLDER": str(ground_truth), "TRACKERS_FOLDER": str(trackers), "TRACKERS_TO_EVAL": configurations, "SEQ_INFO": sequences, "SKIP_SPLIT_FOL": True, "DO_PREPROC": True, "PRINT_CONFIG": False, "BENCHMARK": "MOT17", "SPLIT_TO_EVAL": "train", "CLASSES_TO_EVAL": ["pedestrian"]})
    metrics = [Identity({"THRESHOLD": 0.5, "PRINT_CONFIG": False}), Clear({"THRESHOLD": 0.5, "PRINT_CONFIG": False})]

    def summary(values):
        identity, clear = values
        return {"IDF1": float(identity["IDF1"]), "IDSW": int(clear["IDSW"]), "MOTA": float(clear["MOTA"]), "FP": int(clear["CLR_FP"]), "FN": int(clear["CLR_FN"]), "TP": int(clear["CLR_TP"]), "GT": int(clear["CLR_TP"] + clear["CLR_FN"]), "Frag": int(clear["Frag"]), "IDTP": int(identity["IDTP"]), "IDFP": int(identity["IDFP"]), "IDFN": int(identity["IDFN"])}

    results = {"scorer": provenance, "protocol": {"dataset": "MotChallenge2DBox", "DO_PREPROC": True, "class": "pedestrian", "iouThreshold": 0.5}}
    for tracker in configurations:
        per_metric = [{}, {}]
        for sequence in sequences:
            raw = dataset.get_raw_seq_data(tracker, sequence)
            data = dataset.get_preprocessed_seq_data(raw, "pedestrian")
            for metric, accumulator in zip(metrics, per_metric):
                accumulator[sequence] = metric.eval_sequence(data)
        results[tracker] = {"sequences": {sequence: summary([accumulator[sequence] for accumulator in per_metric]) for sequence in sequences}, "combined": summary([metric.combine_sequences(accumulator) for metric, accumulator in zip(metrics, per_metric)])}
    return results


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    preparation = subparsers.add_parser("prepare")
    preparation.add_argument("--archive", type=Path, required=True)
    preparation.add_argument("--output", type=Path, required=True)
    preparation.add_argument("--download", action="store_true")
    scoring = subparsers.add_parser("score")
    scoring.add_argument("--trackeval", type=Path, required=True)
    scoring.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        if args.download:
            with urllib.request.urlopen(LOCK["dataset"]["url"], timeout=120) as response:
                content = response.read()
            if len(content) != LOCK["dataset"]["bytes"] or digest(content) != LOCK["dataset"]["sha256"]:
                raise ValueError("下载数据 SHA256 不匹配")
            args.archive.parent.mkdir(parents=True, exist_ok=True)
            with args.archive.open("xb") as stream:
                stream.write(content)
        result = prepare(args.archive, args.output)
        target = args.output.parent / "input-hashes.json"
    else:
        sequences = {}
        for name in LOCK["dataset"]["sequences"]:
            info = configparser.ConfigParser()
            info.read(args.run / "input" / name / "seqinfo.ini")
            sequences[name] = int(info["Sequence"]["seqLength"])
        result = score(args.trackeval.resolve(), args.run / "input", args.run / "trackers", sequences, ["default", "no-low"])
        target = args.run / "metrics.json"
    with target.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


if __name__ == "__main__":
    main()
