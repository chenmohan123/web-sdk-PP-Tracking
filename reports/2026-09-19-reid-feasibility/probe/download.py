"""一次性探针：固定官方资产并验证其 SHA-384 清单。"""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
import yaml

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
manifest = yaml.safe_load((ROOT / "sources/omz-models__intel__person-reidentification-retail-0288__model.yml").read_text(encoding="utf-8"))
records = []
for asset in manifest["files"]:
    if not asset["name"].startswith("FP32/"):
        continue
    path = ASSETS / Path(asset["name"]).name
    if not path.exists():
        with urlopen(Request(asset["source"], headers={"User-Agent": "PP-Tracking-feasibility"}), timeout=60) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    assert len(data) == asset["size"], "文件长度不符"
    assert hashlib.sha384(data).hexdigest() == asset["checksum"], "官方 SHA-384 不符"
    records.append({"file": path.name, "url": asset["source"], "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "sha384": asset["checksum"], "officialChecksumPassed": True})
(ROOT / "assets.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print(json.dumps(records, indent=2))
