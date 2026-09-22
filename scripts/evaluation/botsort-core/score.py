"""独立评分：先核对标签和实际MOT输出SHA，再调用固定官方TrackEval。"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--trackeval', type=Path, required=True)
parser.add_argument('--run', choices=['run','ablation','ablation-verified'], default='run')
args = parser.parse_args()
OUT = ROOT / '.tmp/botsort-core' / args.run
read = lambda p: json.loads(p.read_text(encoding='utf-8'))
summary = read(OUT / 'summary.json')
assert summary['complete']
labels = ROOT / '.tmp/mot17-ocsort-c036be8/input'
for name, pins in summary['inputs'].items():
    for path, pin in pins.items():
        data = (labels/name/path).read_bytes()
        assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256']
    for config in summary['configurations']:
        data = (OUT/'trackers'/config/'data'/f'{name}.txt').read_bytes()
        assert hashlib.sha256(data).hexdigest() == summary['sequences'][name]['results'][config][0]['motSha256']
spec = importlib.util.spec_from_file_location('scoring', ROOT/'scripts/evaluation/mot17/evaluator.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
result = module.score(args.trackeval, labels, OUT/'trackers', {name:row['frames'] for name,row in summary['sequences'].items()}, list(summary['configurations']))
previous = read(ROOT/'reports/2026-09-21-botsort-feasibility/metrics.json')
if args.run == 'run':
    for config in summary['configurations']:
        assert result[config] == previous['base' if config == 'identity' else config]
else:
    for config in ['identity','full']:
        assert result[config]['sequences']['MOT17-09-FRCNN'] == previous['base' if config == 'identity' else 'cmc']['sequences']['MOT17-09-FRCNN']
with (OUT/'metrics.json').open('x',encoding='utf-8') as file:
    json.dump(result,file,ensure_ascii=False,indent=2)
print(json.dumps({config:result[config]['combined'] for config in summary['configurations']},ensure_ascii=False,indent=2))
