"""按固定官方 ZIP 身份获取七段完整图片；不读取 GT，不分发媒体。"""
import concurrent.futures
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import urllib.request
import zipfile
import zlib

REPO = Path(__file__).resolve().parents[3]
WORK = REPO / '.tmp/mot17-reid-media'
URL = 'https://motchallenge.net/data/MOT17.zip'
SIZE = 5860214001
ETAG = '"15d4bc4f1-5b6c01991f807"'
LENGTHS = {'02': 600, '04': 1050, '05': 837, '09': 525, '10': 654, '11': 900, '13': 750}


def central_directory():
    source = REPO / 'reports/2026-09-19-pplcnet-reid/probe/data.py'
    spec = importlib.util.spec_from_file_location('range_reader', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    remote = module.RemoteZip()
    if remote.size != SIZE or remote.etag != ETAG:
        raise ValueError('官方 ZIP 身份变化')
    entries = []
    with zipfile.ZipFile(remote) as archive:
        for number, count in LENGTHS.items():
            for frame in range(1, count + 1):
                name = f'MOT17/train/MOT17-{number}-FRCNN/img1/{frame:06d}.jpg'
                item = archive.getinfo(name)
                entries.append(dict(name=name, offset=item.header_offset, compressed=item.compress_size,
                                    bytes=item.file_size, crc32=item.CRC, method=item.compress_type))
    return entries


def target(item):
    relative = item['name'].removeprefix('MOT17/train/')
    return WORK / 'data' / relative


def checked_record(item, data):
    if len(data) != item['bytes'] or zlib.crc32(data) != item['crc32']:
        raise ValueError(f"图片 CRC/大小不匹配：{item['name']}")
    return dict(path=target(item).relative_to(WORK / 'data').as_posix(),
                zipMember=item['name'], zipCrc32=item['crc32'], bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest())


def fetch_group(group):
    start = group[0]['offset']
    last = group[-1]
    # 官方各图片本地头的 extra 长度可能非零，读取小范围余量后按实际头精确切片。
    end = min(SIZE - 1, last['offset'] + last['compressed'] + 65536 + 30 + len(last['name'].encode()))
    for attempt in range(3):
        try:
            request = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end}', 'If-Match': ETAG})
            with urllib.request.urlopen(request, timeout=90) as response:
                if response.status != 206 or response.headers['Content-Range'] != f'bytes {start}-{end}/{SIZE}':
                    raise ValueError('HTTP Range 响应身份错误')
                block = response.read(end - start + 2)
                if len(block) != end - start + 1:
                    raise ValueError('HTTP Range 长度错误')
            break
        except Exception:
            if attempt == 2:
                raise
    records = []
    for item in group:
        offset = item['offset'] - start
        header = struct.unpack_from('<4s5H3I2H', block, offset)
        signature, _, flags, method, _, _, _, _, _, name_size, extra_size = header
        name = block[offset + 30:offset + 30 + name_size].decode('utf-8')
        if signature != b'PK\x03\x04' or name != item['name'] or method != item['method'] or flags & 1:
            raise ValueError('ZIP 本地头与中央目录不一致')
        begin = offset + 30 + name_size + extra_size
        payload = block[begin:begin + item['compressed']]
        if len(payload) != item['compressed']:
            raise ValueError('图片压缩流不完整')
        if method == 8:
            data = zlib.decompress(payload, -15)
        elif method == 0:
            data = payload
        else:
            raise ValueError('未知 ZIP 压缩方式')
        record = checked_record(item, data)
        path = target(item)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as stream:
            stream.write(data)
        records.append(record)
    return records, len(block)


def main():
    WORK.mkdir(exist_ok=True)
    entries = central_directory()
    records, missing = [], []
    for item in entries:
        path = target(item)
        if path.exists():
            records.append(checked_record(item, path.read_bytes()))
        else:
            missing.append(item)
    groups = []
    for item in sorted(missing, key=lambda value: value['offset']):
        if (not groups or item['offset'] + item['compressed'] - groups[-1][0]['offset'] > 12_000_000
                or item['offset'] - (groups[-1][-1]['offset'] + groups[-1][-1]['compressed']) > 100_000):
            groups.append([])
        groups[-1].append(item)
    transferred = 0
    print(f'已核验缓存 {len(records)}/5316 张，准备请求 {len(groups)} 段', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for future in concurrent.futures.as_completed([pool.submit(fetch_group, group) for group in groups]):
            batch, size = future.result()
            records.extend(batch)
            transferred += size
            print(f'完整图片 {len(records)}/5316，本次传输 {transferred / 1e6:.1f} MB', flush=True)
    records.sort(key=lambda item: item['path'])
    report = dict(url=URL, archiveBytes=SIZE, archiveEtag=ETAG, frameCount=len(records),
                  transferredBytesThisRun=transferred, entries=records,
                  scope='七段训练序列完整画面，仅本地评测；不读取GT；原图不分发。')
    (WORK / 'media.lock.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('媒体清单已完成', flush=True)


if __name__ == '__main__':
    main()
