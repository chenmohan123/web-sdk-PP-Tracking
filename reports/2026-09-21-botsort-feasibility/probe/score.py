"""GT 仅在本评分进程核验和读取，原官方 TrackEval 不修改。"""
from pathlib import Path
import importlib.util,json,hashlib,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent/'run-2'
spec=importlib.util.spec_from_file_location('scoring',ROOT/'scripts/evaluation/mot17/evaluator.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
summary=json.loads((OUT/'summary.json').read_text(encoding='utf-8'))
assert summary['complete']
expected=json.loads((ROOT/'reports/2026-09-19-mot17/summary.json').read_text(encoding='utf-8'))['inputHashes']
labels=ROOT/'.tmp/mot17-ocsort-c036be8/input'
assert set(summary['sequences'])==set(expected)
for name,pins in expected.items():
    for path,pin in pins.items():
        data=(labels/name/path).read_bytes()
        assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
sequences={name:x['frames'] for name,x in summary['sequences'].items()}
result=mod.score(Path('F:/git/00_chenmohan/github/web-sdk-PP-Tracking/.tmp/real-sequence-research/TrackEval'),labels,OUT/'trackers',sequences,list(summary['configurations']))
with (OUT/'metrics.json').open('x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps(result,ensure_ascii=False,indent=2))
