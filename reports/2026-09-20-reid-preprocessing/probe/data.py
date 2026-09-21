"""固定另外五个序列，仅复用自己写过的 HTTP Range ZIP 读取器。"""
import argparse
import importlib.util
import json
from pathlib import Path
import zipfile
import hashlib

SEQUENCES = [f"MOT17-{n}-FRCNN" for n in ["05", "09", "10", "11", "13"]]
FRAMES = [1, 31, 61, 91, 121, 151]
PREVIOUS = Path(__file__).resolve().parents[2] / "2026-09-19-pplcnet-reid"


def identity(path):
    data = path.read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True, type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("previous_range_reader", PREVIOUS / "probe/data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    remote = module.RemoteZip()
    original = json.loads((PREVIOUS / "data.lock.json").read_text(encoding="utf-8"))
    assert remote.etag == original["archiveEtag"] and remote.size == original["archiveBytes"]
    records = []
    with zipfile.ZipFile(remote) as archive:
        for sequence in SEQUENCES:
            prefix = next(n[:-len("seqinfo.ini")] for n in archive.namelist() if n.endswith(f"/{sequence}/seqinfo.ini"))
            for suffix in ["seqinfo.ini", "gt/gt.txt"] + [f"img1/{frame:06d}.jpg" for frame in FRAMES]:
                member = prefix + suffix
                path = args.work / "data" / sequence / suffix
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(archive.read(member))
                records.append({"path": path.relative_to(args.work).as_posix(), "zipMember": member,
                                "zipCrc32": archive.getinfo(member).CRC, **identity(path)})
            print(sequence, "完成", flush=True)
    report = {"date": "2026-09-20", "url": module.URL, "archiveEtag": remote.etag, "archiveBytes": remote.size,
              "transferredBytes": remote.transferred, "frames": FRAMES, "sequences": SEQUENCES, "entries": records}
    (args.work / "data.lock.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("传输字节", remote.transferred)


if __name__ == "__main__":
    main()
