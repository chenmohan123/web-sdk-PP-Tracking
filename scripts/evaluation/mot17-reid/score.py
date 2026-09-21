"""只在评分进程读取GT，复用固定官方评分API和官方合计。"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("mot17_evaluator", ROOT / "scripts/evaluation/mot17/evaluator.py")
evaluator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluator)


def main():
    parser = argparse.ArgumentParser()
    for key in ["input", "trackeval", "run"]:
        parser.add_argument("--" + key, type=Path, required=True)
    args = parser.parse_args()
    target = evaluator.new_tmp_target(args.run / "metrics.json")
    summary = json.loads((args.run / "summary.json").read_text(encoding="utf-8"))
    expected = json.loads((ROOT / "reports/2026-09-19-mot17/summary.json").read_text(encoding="utf-8"))["inputHashes"]
    names = evaluator.LOCK["dataset"]["sequences"]
    if not summary["complete"] or summary["subset"] or summary["backend"] != "webgpu" or set(summary["sequences"]) != set(names):
        raise ValueError("评分只接收七段完整WebGPU运行")
    sequences = {}
    for name in names:
        # 原图、GT、检测不复制到新输出，只在评分器内核对全部固定身份。
        for relative, pin in expected[name].items():
            data = (args.input / name / relative).read_bytes()
            if len(data) != pin["bytes"] or evaluator.digest(data) != pin["sha256"]:
                raise ValueError("固定评分输入身份不匹配")
        sequence = summary["sequences"][name]
        if sequence["frames"] != sequence["info"]["length"]:
            raise ValueError("序列帧数不完整")
        sequences[name] = sequence["frames"]
    metrics = evaluator.score(args.trackeval.resolve(), args.input.resolve(), args.run / "trackers", sequences, ["bytetrack", "ocsort", "deepsort"])
    evaluator.write_new(target, (json.dumps(metrics, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print("官方TrackEval七段合计完成")


if __name__ == "__main__":
    main()
