"""归档脚本与机器证据，不提交权重、原图或完整GT。"""
import argparse
import gzip
import json
from pathlib import Path
import shutil
import statistics
from data import identity

parser=argparse.ArgumentParser()
parser.add_argument('--work',type=Path,required=True)
work=parser.parse_args().work
root=Path(__file__).resolve().parent.parent
evidence=root/'evidence';evidence.mkdir(exist_ok=True)
for name in ['data.lock.json','sources.lock.json']:shutil.copyfile(work/name,root/name)
for name in ['python-result.json.gz','browser-result.json.gz','node-result.json','decode-diagnostics.json','preprocess-red.log','preprocess-green.log','python-evaluate.log','sdk-verify.log','sdk-browser.json','validation.json']:
    shutil.copyfile(work/name,evidence/name)
p=json.loads(gzip.decompress((work/'python-result.json.gz').read_bytes()))
b=json.loads(gzip.decompress((work/'browser-result.json.gz').read_bytes()))
summary={'date':'2026-09-20','model':p['model'],'samples':len(p['samples']),'fixtures':len(p['fixtures']),
         'quality':{m:{k:v for k,v in q.items() if k!='records'} for m,q in p['quality'].items()},
         'browser':[{ 'backend':r['backend'],'passed':sum(x['passed'] for x in r['validation']),
                     'maxTensorError':max(x['tensor']['maxAbs'] for x in r['validation']),
                     'maxVectorError':max(x['error']['maxAbs'] for x in r['validation']),
                     'timingMedian':{k:statistics.median(t[k] for t in r['timed']) for k in ['preprocessMs','inferenceMs','postprocessMs','totalMs']}}
                    for r in b['results']]}
(evidence/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
paths=[p for p in evidence.rglob('*') if p.is_file()]+list((root/'probe').glob('*.*'))+[root/name for name in ['protocol.md','verify_archive.py','sources.lock.json','data.lock.json']]
lock=[{'path':p.relative_to(root).as_posix(),**identity(p)} for p in sorted(paths) if p.is_file()]
(root/'evidence.lock.json').write_text(json.dumps(lock,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('归档文件',len(lock))
