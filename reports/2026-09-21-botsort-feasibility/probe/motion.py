"""一次性离线 CMC 探针：公开检测排除前景，不读取 GT。"""
from pathlib import Path
import hashlib, json, math, time
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
WORK=Path(__file__).resolve().parent
PROTOCOL=json.loads((WORK/'protocol.json').read_text(encoding='utf-8'))
P=PROTOCOL['motion']
IDENTITY=np.array([[1.,0,0],[0,1.,0]])
cv2.setNumThreads(1)
cv2.setRNGSeed(1234)
orb=cv2.ORB_create(nfeatures=P['orbFeatures'])
matcher=cv2.BFMatcher(cv2.NORM_HAMMING)
def features(gray, boxes):
    h,w=gray.shape
    mask=np.full((h,w),255,np.uint8)
    for x,y,bw,bh in boxes:
        cv2.rectangle(mask,(max(0,int(x)),max(0,int(y))),(min(w-1,math.ceil(x+bw)),min(h-1,math.ceil(y+bh))),0,-1)
    return orb.detectAndCompute(gray,mask)
def estimate(previous,current,size):
    kp1,d1=previous;kp2,d2=current
    stat={'matches':0,'inliers':0,'inlierRatio':0.,'gridCells':0}
    if d1 is None or d2 is None or len(d1)<12 or len(d2)<12:return IDENTITY.copy(),'insufficient_features',stat
    pairs=[a for pair in matcher.knnMatch(d1,d2,k=2) if len(pair)==2 for a,b in [pair] if a.distance<P['ratio']*b.distance]
    # 一个目标描述子只保留距离最小匹配，避免重复背景点提高内点数。
    unique={}
    for a in sorted(pairs,key=lambda a:(a.distance,a.queryIdx,a.trainIdx)): unique.setdefault(a.trainIdx,a)
    pairs=list(unique.values());stat['matches']=len(pairs)
    if len(pairs)<P['minMatches']:return IDENTITY.copy(),'insufficient_matches',stat
    a=np.float32([kp1[m.queryIdx].pt for m in pairs]);b=np.float32([kp2[m.trainIdx].pt for m in pairs])
    cv2.setRNGSeed(1234)
    matrix,mask=cv2.estimateAffinePartial2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=P['ransacThreshold'],maxIters=2000,confidence=.99,refineIters=10)
    if matrix is None or not np.isfinite(matrix).all():return IDENTITY.copy(),'fit_failed',stat
    inside=mask.ravel().astype(bool);stat['inliers']=int(inside.sum());stat['inlierRatio']=float(inside.mean())
    w,h=size
    stat['gridCells']=len({(min(3,max(0,int(x*4/w))),min(3,max(0,int(y*4/h)))) for x,y in a[inside]})
    scale=float(math.hypot(matrix[0,0],matrix[1,0]));angle=math.degrees(math.atan2(matrix[1,0],matrix[0,0]))
    stat.update(scale=scale,angle=angle,translation=float(np.linalg.norm(matrix[:,2])))
    if stat['inliers']<P['minInliers'] or stat['inlierRatio']<P['minInlierRatio'] or stat['gridCells']<P['minGridCells']:return IDENTITY.copy(),'low_support',stat
    if not .8<=scale<=1.25 or abs(angle)>15 or stat['translation']>.25*math.hypot(w,h):return IDENTITY.copy(),'out_of_range',stat
    return matrix,'estimated',stat
def main():
    out=WORK/'motion'
    out.mkdir(exist_ok=False)
    rng=np.random.default_rng(7)
    image=rng.integers(0,256,(480,640),np.uint8)
    moved=cv2.warpAffine(image,np.array([[1.,0,12.],[0,1.,-8.]]),(640,480))
    result,status,stat=estimate(features(image,[]),features(moved,[]),(640,480))
    assert status=='estimated' and np.max(np.abs(result-np.array([[1,0,12],[0,1,-8]])))<.7
    _,empty,_=estimate(features(np.zeros_like(image),[]),features(np.zeros_like(image),[]),(640,480))
    assert empty=='insufficient_features'
    (out/'synthetic.json').write_text(json.dumps({'knownTranslation':result.tolist(),'blankFallback':empty,'support':stat},indent=2),encoding='utf-8')
    pins=json.loads((ROOT/'reports/2026-09-21-mot-reid/media.lock.json').read_text(encoding='utf-8'))
    hashes={x['path']:x for x in pins['entries']}
    labels=json.loads((ROOT/'reports/2026-09-19-mot17/summary.json').read_text(encoding='utf-8'))['inputHashes']
    report={'opencv':cv2.__version__,'numpy':np.__version__,'threads':cv2.getNumThreads(),'protocolSha256':hashlib.sha256((WORK/'protocol.json').read_bytes()).hexdigest(),'sequences':{}}
    for name in labels:
        labelroot=ROOT/'.tmp/mot17-ocsort-c036be8/input'/name
        for f in ['seqinfo.ini','det/det.txt']:
            data=(labelroot/f).read_bytes();pin=labels[name][f]
            assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
        info=dict(x.split('=',1) for x in (labelroot/'seqinfo.ini').read_text().splitlines() if '=' in x)
        w,h=int(info['imWidth']),int(info['imHeight']);n=int(info['seqLength'])
        factor=min(1.,P['maxWidth']/w);sw,sh=round(w*factor),round(h*factor)
        sx,sy=sw/w,sh/h;dets=[[] for _ in range(n)]
        for line in (labelroot/'det/det.txt').read_text().splitlines():
            row=list(map(float,line.split(',')));frame,_,x,y,bw,bh=row[:6]
            dets[int(frame)-1].append(((x-1)*sx,(y-1)*sy,bw*sx,bh*sy))
        rows=[];prev=None
        for i in range(n):
            start=time.perf_counter()
            rel=f'{name}/img1/{i+1:06d}.jpg';data=(ROOT/'.tmp/mot17-reid-media/data'/rel).read_bytes();pin=hashes[rel]
            assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
            readend=time.perf_counter()
            gray=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_GRAYSCALE)
            assert gray.shape==(h,w)
            gray=cv2.resize(gray,(sw,sh),interpolation=cv2.INTER_AREA) if factor!=1 else gray
            decoded=time.perf_counter();cur=features(gray,dets[i])
            matrix,status,stat=(IDENTITY.copy(),'first_frame',{}) if prev is None else estimate(prev,cur,(sw,sh))
            # 原图变换 = S^-1 * M_small * S，不能只缩放 t 而忽略舍入导致的非等比例缩放。
            M=np.diag([1/sx,1/sy])@matrix[:,:2]@np.diag([sx,sy]);t=np.diag([1/sx,1/sy])@matrix[:,2]
            transform=np.column_stack([M,t]).ravel().tolist();end=time.perf_counter()
            rows.append({'frameNumber':i+1,'fromFrame':i if i else None,'matrix':transform,'status':status,'support':stat,'imageSha256':pin['sha256'],'timings':{'readIntegrityMs':(readend-start)*1000,'decodeResizeMs':(decoded-readend)*1000,'estimateMs':(end-decoded)*1000,'totalMs':(end-start)*1000}})
            prev=cur
        payload=''.join(json.dumps(x,separators=(',',':'))+'\n' for x in rows).encode()
        (out/f'{name}.jsonl').write_bytes(payload)
        report['sequences'][name]={'frames':n,'sha256':hashlib.sha256(payload).hexdigest(),'statuses':{s:sum(x['status']==s for x in rows) for s in sorted({x['status'] for x in rows})},'timings':{k:{'sumMs':sum(x['timings'][k] for x in rows),'p50Ms':float(np.median([x['timings'][k] for x in rows])),'p95Ms':float(np.percentile([x['timings'][k] for x in rows],95))} for k in rows[0]['timings']}}
        print(name,report['sequences'][name]['statuses'],flush=True)
        (out/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if __name__=='__main__':main()
