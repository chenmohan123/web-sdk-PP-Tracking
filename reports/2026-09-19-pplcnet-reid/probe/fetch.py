"""一次性研究：固定公开来源和权重；仅向独立临时目录下载。"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

REVISION = "b25522a0f4bde8c80603f3ba5e3472059972e3b5"
CHECKPOINT_SHA256 = "abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758"
SOURCES = [
    "LICENSE",
    "configs/mot/deepsort/README_cn.md",
    "configs/mot/deepsort/reid/deepsort_pplcnet.yml",
    "ppdet/modeling/reid/pplcnet_embedding.py",
    "deploy/pptracking/python/mot/utils.py",
    "deploy/pptracking/python/mot_sde_infer.py",
    "deploy/python/preprocess.py",
]


def identity(path):
    data = path.read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def download(url, path):
    with urllib.request.urlopen(url, timeout=90) as response:
        data = response.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return {"url": url, "finalUrl": response.url, "etag": response.headers.get("ETag"), **identity(path)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    records = []
    for name in SOURCES:
        target = args.work / "sources" / name
        item = download(f"https://raw.githubusercontent.com/PaddlePaddle/PaddleDetection/{REVISION}/{name}", target)
        records.append({"path": str(target.relative_to(args.work)).replace("\\", "/"), "revision": REVISION, **item})
    for label, suffix in [("readme", "deepsort/deepsort_pplcnet.pdparams"), ("config", "deepsort_pplcnet.pdparams")]:
        target = args.work / "assets" / f"{label}.pdparams"
        item = download(f"https://paddledet.bj.bcebos.com/models/mot/{suffix}", target)
        assert item["bytes"] == 36769814 and item["sha256"] == CHECKPOINT_SHA256, "远端权重已变化，禁止静默更新基线"
        records.append({"path": str(target.relative_to(args.work)).replace("\\", "/"), **item})
    assert records[-1]["sha256"] == records[-2]["sha256"], "两个权重 URL 的内容不同，须分别调查"
    (args.work / "sources.lock.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(records[-2:], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
