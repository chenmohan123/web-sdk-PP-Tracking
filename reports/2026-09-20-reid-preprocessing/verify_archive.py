"""从已归档原始向量独立复算；不依赖推理、图片或准备脚本。"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import statistics

ROOT=Path(__file__).resolve().parent


def load(name):
    data=(ROOT/name).read_bytes()
    return json.loads(gzip.decompress(data) if name.endswith('.gz') else data.decode('utf-8-sig'))


def near(a,b):
    assert math.isclose(a,b,abs_tol=1e-12,rel_tol=1e-9),(a,b)


def distance(a,b):
    assert len(a)==len(b)==512 and all(math.isfinite(v) for v in a+b)
    na,nb=math.hypot(*a),math.hypot(*b)
    assert min(na,nb)>0
    return 1-math.fsum(x*y for x,y in zip(a,b))/na/nb


def numerical(reference,actual,record):
    error=max(abs(a-b) for a,b in zip(reference,actual))
    cosine=distance(reference,actual)
    near(error,record['maxAbs']);near(cosine,record['cosineDistance'])
    assert error<1e-3 and cosine<1e-5


def main():
    lock=load('evidence.lock.json')
    for item in lock:
        data=(ROOT/item['path']).read_bytes()
        assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
    p=load('evidence/python-result.json.gz');b=load('evidence/browser-result.json.gz');n=load('evidence/node-result.json')
    previous=json.loads((ROOT.parent/'2026-09-19-pplcnet-reid/evidence/conversion.json').read_text(encoding='utf-8'))
    assert p['model']==previous['assets']['pplcnet-fp32.onnx']
    assert all(v==previous['assets'][k] for k,v in p['paddleAssets'].items())
    assert len(p['fixtures'])==len(n['rows'])==34
    assert sum(f['real'] for f in p['fixtures'])==26 and len(p['samples'])==103
    assert {r['backend'] for r in b['results']}=={'wasm','webgpu'} and not b['errors']
    for fixture,node in zip(p['fixtures'],n['rows']):
        assert fixture['id']==node['id'] and fixture['tensor']['sha256']==node['tensorSha256']
        assert node['maxAbs']==node['different']==0
        numerical(fixture['reference'],fixture['pythonOutput'],fixture['pythonError'])
    for backend in b['results']:
        assert backend['status']=='ran' and len(backend['validation'])==34
        assert backend['modelSha256']==p['model']['sha256']
        if backend['backend']=='webgpu':
            assert backend['disableCpuEpFallback'] and backend['actualAdapter']['isFallbackAdapter'] is False
        for f,row in zip(p['fixtures'],backend['validation']):
            assert row['id']==f['id'] and row['name']==f['name'] and row['passed']
            assert row['tensor']['maxAbs']==0 and row['tensorSha256']==f['tensor']['sha256']
            numerical(f['reference'],row['output'],row['error'])
            assert bool(row['png'])==bool(f['png'])
            if row['png']:
                assert row['png']['pixels']['maxAbs']==row['png']['tensor']['maxAbs']==0
                numerical(f['reference'],row['png']['output'],row['png']['error'])
        assert sum(x['png'] is not None for x in backend['validation'])==33
        assert len(backend['diagnostics'])==5
        for diagnostic in backend['diagnostics']:
            fixture=next(f for f in p['fixtures'] if f['id']==diagnostic['id'])
            assert fixture['jpeg'] and diagnostic['pixels']['maxAbs']==diagnostic['tensor']['maxAbs']==0
            numerical(fixture['reference'],diagnostic['output'],diagnostic['error'])
        assert len(backend['timed'])==30
        for timing in backend['timed']:
            assert all(math.isfinite(timing[k]) and timing[k]>=0 for k in ['preprocessMs','inferenceMs','postprocessMs','totalMs'])
            near(timing['totalMs'],sum(timing[k] for k in ['preprocessMs','inferenceMs','postprocessMs']))
            assert abs(timing['normalizedNorm']-1)<1e-6
    samples=p['samples']
    for mode,q in p['quality'].items():
        vectors=p['vectors'][mode]
        assert len(vectors)==len(samples)
        indices=[i for i,r in enumerate(samples) if r['frame']>1]
        assert indices==[r['sampleIndex'] for r in q['records']]
        positive=[];negative=[];correct=0;sequence_correct={seq:0 for seq in q['bySequence']}
        for row in q['records']:
            i=row['sampleIndex'];sample=samples[i]
            gallery=[j for j,r in enumerate(samples) if r['frame']==1 and r['sequence']==sample['sequence']]
            distances=[distance(vectors[i],vectors[j]) for j in gallery]
            own=next(j for j,g in enumerate(gallery) if samples[g]['person']==sample['person'])
            best=min(range(len(distances)),key=distances.__getitem__)
            assert row['bestPerson']==samples[gallery[best]]['person'] and row['correct']==(best==own)
            near(row['positiveDistance'],distances[own])
            neg=[v for j,v in enumerate(distances) if j!=own]
            assert len(neg)==len(row['negativeDistances'])
            for a,bv in zip(neg,row['negativeDistances']):near(a,bv)
            correct+=best==own;sequence_correct[sample['sequence']]+=best==own
            positive.append(distances[own]);negative.extend(neg)
        assert q['correct']==correct and q['queries']==len(positive)==67 and len(negative)==555
        near(q['rank1'],correct/len(positive))
        ranks=[]
        for seq,record in q['bySequence'].items():
            gallery=sum(s['sequence']==seq and s['frame']==1 for s in samples)
            queries=sum(s['sequence']==seq and s['frame']>1 for s in samples)
            assert record['gallery']==gallery and record['queries']==queries and record['correct']==sequence_correct[seq]
            near(record['rank1'],sequence_correct[seq]/queries);ranks.append(record['rank1'])
        near(q['macroRank1'],statistics.mean(ranks))
        for row in q['thresholdDiagnostics']:
            t=row['threshold'];assert row['positivePairs']==len(positive) and row['negativePairs']==len(negative)
            assert row['positiveRejected']==sum(v>t for v in positive) and row['negativeAccepted']==sum(v<=t for v in negative)
    diagnostic=load('evidence/decode-diagnostics.json')
    differences=[abs(a-b) for a,b in zip(diagnostic['rawRgba'],diagnostic['decodedRgba'])]
    assert diagnostic['maxAbs']==max(differences)==247 and diagnostic['different']==sum(v>0 for v in differences)==7
    assert diagnostic['byteExact'] is False
    print(json.dumps({'归档文件':len(lock),'张量与模型':'Node/浏览器34组通过','PNG':'33组不透明通过，透明反例保留','真实查询':67,'质量与阈值复算':'通过'},ensure_ascii=False))


if __name__=='__main__':main()
