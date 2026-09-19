"""固定本地研究输出；不归档 checkpoint、ONNX、原图或完整 GT。"""
import argparse
import json
from pathlib import Path
import shutil
from fetch import identity


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    report = Path(__file__).resolve().parent.parent
    evidence = report / "evidence"
    evidence.mkdir(exist_ok=True)
    for name in ["sources.lock.json", "data.lock.json", "requirements.txt"]:
        shutil.copyfile(args.work / name, report / name)
    for name in ["conversion.json", "python-result.json.gz", "browser-result.json.gz", "environment.json", "source-review.json", "sdk-verify.log", "sdk-browser.json", "validation.json"]:
        shutil.copyfile(args.work / name, evidence / name)
    if (args.work / "browser-initial.json.gz").exists():
        shutil.copyfile(args.work / "browser-initial.json.gz", evidence / "browser-initial.json.gz")
    python = __import__("gzip").decompress((evidence / "python-result.json.gz").read_bytes())
    p = json.loads(python)
    b = json.loads(__import__("gzip").decompress((evidence / "browser-result.json.gz").read_bytes()))
    summary = {"date": "2026-09-19", "model": p["model"], "numerical": [
        {"backend": "python-cpu", "passed": sum(x["passed"] for x in p["fixtures"]), "count": len(p["fixtures"]),
         "maxAbs": max(x["maxAbs"] for x in p["fixtures"]), "maxCosineDistance": max(x["cosineDistance"] for x in p["fixtures"])}]}
    for result in b["results"]:
        summary["numerical"].append({"backend": result["backend"], "passed": sum(x["passed"] for x in result["validation"]),
                                     "count": len(result["validation"]), "maxAbs": max(x["maxAbs"] for x in result["validation"]),
                                     "maxCosineDistance": max(x["cosineDistance"] for x in result["validation"]),
                                     "warmMedianMs": result["warm"]["medianMs"], "warmP95Ms": result["warm"]["p95Ms"],
                                     "serialCrops": [{k: v for k, v in row.items() if k != "rawMs"} for row in result["serialCrops"]]})
    summary["quality"] = {mode: {key: val for key, val in value.items() if key != "records"} for mode, value in p["quality"].items()}
    (evidence / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # 仅脚本和机器证据入锁，叙述文档仍可补充真实验收回执。
    files = list(evidence.rglob("*")) + list((report / "probe").glob("*.*")) + [report / "verify_archive.py", report / "protocol.md", report / "sources.lock.json", report / "data.lock.json", report / "requirements.txt"]
    lock = [{"path": str(path.relative_to(report)).replace("\\", "/"), **identity(path)} for path in sorted(files) if path.is_file()]
    (report / "evidence.lock.json").write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("归档文件", len(lock))


if __name__ == "__main__":
    main()
