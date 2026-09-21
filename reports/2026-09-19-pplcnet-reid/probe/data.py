"""一次性研究：通过 HTTP Range 读取官方 ZIP 的预定样本，不下载完整数据集。"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

URL = "https://motchallenge.net/data/MOT17.zip"
FRAMES = [1, 31, 61, 91, 121, 151]
SEQUENCES = ["MOT17-02-FRCNN", "MOT17-04-FRCNN"]


class RemoteZip(io.RawIOBase):
    def __init__(self):
        with urllib.request.urlopen(urllib.request.Request(URL, method="HEAD"), timeout=60) as response:
            self.size = int(response.headers["Content-Length"])
            self.etag = response.headers["ETag"]
        self.position = 0
        self.transferred = 0

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = (0 if whence == 0 else self.position if whence == 1 else self.size) + offset
        assert 0 <= self.position <= self.size
        return self.position

    def read(self, count=-1):
        count = self.size - self.position if count < 0 else min(count, self.size - self.position)
        if count == 0:
            return b""
        assert count < 20_000_000, "禁止无界请求"
        start, end = self.position, self.position + count - 1
        request = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{end}", "If-Match": self.etag})
        with urllib.request.urlopen(request, timeout=90) as response:
            assert response.status == 206
            assert response.headers["Content-Range"] == f"bytes {start}-{end}/{self.size}"
            data = response.read(count + 1)
            assert len(data) == count
        self.transferred += count
        self.position += count
        return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    remote = RemoteZip()
    entries = []
    with zipfile.ZipFile(remote) as archive:
        names = archive.namelist()
        print("ZIP 条目", len(names), "元数据", [n for n in names if any(t in n.lower() for t in ["readme", "license", "copying"])], flush=True)
        for sequence in SEQUENCES:
            prefix = next(n[:-len("seqinfo.ini")] for n in names if n.endswith(f"/{sequence}/seqinfo.ini"))
            relative = ["seqinfo.ini", "gt/gt.txt"] + [f"img1/{frame:06d}.jpg" for frame in FRAMES]
            for suffix in relative:
                member = prefix + suffix
                data = archive.read(member)
                path = args.work / "data" / sequence / suffix
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                entries.append({"path": str(path.relative_to(args.work)).replace("\\", "/"), "zipMember": member,
                                "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "zipCrc32": archive.getinfo(member).CRC})
            print(sequence, "预定六帧与标注已读取", flush=True)
    lock = {"date": "2026-09-19", "url": URL, "archiveBytes": remote.size, "archiveEtag": remote.etag,
            "transferredBytes": remote.transferred, "frames": FRAMES, "entries": entries,
            "scope": "官方训练集预定样本，仅本地研究；原图和完整标注不归档、不分发。未取得当前站点完整许可页面。"}
    (args.work / "data.lock.json").write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("总传输字节", remote.transferred)


if __name__ == "__main__":
    main()
