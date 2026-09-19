"""一次性探针：按报告锁定的 URL/哈希下载来源文档。"""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
sources = json.loads((ROOT / "sources.lock.json").read_text(encoding="utf-8"))
target = ROOT / "sources"
target.mkdir(exist_ok=True)
for repo in sources["sources"]:
    for entry in repo["files"]:
        assert "error" not in entry
        path = target / entry["file"]
        if path.exists():
            data = path.read_bytes()
        else:
            with urlopen(Request(entry["url"], headers={"User-Agent": "PP-Tracking-feasibility"}), timeout=60) as response:
                data = response.read()
        assert len(data) == entry["bytes"] and hashlib.sha256(data).hexdigest() == entry["sha256"], entry["url"]
        path.write_bytes(data)
print("固定来源文档哈希全部通过")
