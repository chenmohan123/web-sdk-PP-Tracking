// 一次性探针：固定检测/冻结特征，评分前不读取 GT。
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {createTracker as baseFactory} from '../../dist/index.js';
import {createTracker as probeFactory} from './probe.js';
import {parseSequenceInfo,adaptDetections,exportMot,withoutTiming} from '../../scripts/evaluation/mot17/adapter.mjs';
import {validateFeatureFrame} from '../../scripts/evaluation/mot17-reid/core.mjs';
import {hashFile} from '../../scripts/evaluation/mot17-reid/io.mjs';
const work='.tmp/botsort-feasibility';
const out=work+'/run-2';
await mkdir(out);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const historical=await read('reports/2026-09-19-mot17/summary.json');
const raw=await read('reports/2026-09-21-mot-reid/raw/summary.json');
const configs={base:{motion:false,appearance:false},cmc:{motion:true,appearance:false},'cmc-reid':{motion:true,appearance:true}};
const defaults=raw.configurations.bytetrack;
const summary={testedAt:new Date().toISOString(),node:process.version,probe:'固定已有滤波/生命周期 + CMC及门控最小距离/EMA；非完整官方BoT-SORT',configurations:configs,options:defaults,sequences:{},hashes:{probe:await hashFile(work+'/probe.js'),protocol:await hashFile(work+'/protocol.json')},timingScope:'Node仅关联+补偿，冻结已有向量；不包含图像估计、ReID提取、检测器、浏览器传输/渲染/评分'};
for(const [name,pins] of Object.entries(historical.inputHashes)){
  const number=name.split('-')[1],labelroot='.tmp/mot17-ocsort-c036be8/input/'+name;
  for(const rel of ['seqinfo.ini','det/det.txt']){const b=await readFile(labelroot+'/'+rel);assert.equal(b.length,pins[rel].bytes);assert.equal(hash(b),pins[rel].sha256);}
  const sequence=adaptDetections(await readFile(labelroot+'/det/det.txt','utf8'),parseSequenceInfo(await readFile(labelroot+'/seqinfo.ini','utf8')));
  const motionSummary=await read(work+'/motion/summary.json');
  const motionBytes=await readFile(work+'/motion/'+name+'.jsonl');assert.equal(hash(motionBytes),motionSummary.sequences[name].sha256);
  const motion=motionBytes.toString().trim().split('\n').map(JSON.parse);assert.equal(motion.length,sequence.info.length);
  const featureRoot=`.tmp/mot17-reid-official-${number}-0194ea5`;
  const featurePath=featureRoot+'/features/'+name+'.jsonl';
  const previous=(await read('reports/2026-09-21-mot-reid/raw/sequences/'+name+'-summary.json')).sequences[name];
  assert.equal(await hashFile(featurePath),previous.featureSha256);
  const space=raw.configurations.deepsort.featureSpace;
  const trackers=Object.fromEntries(Object.entries(configs).map(([key,p])=>[key,key==='base'?baseFactory(defaults):probeFactory(defaults,p)]));
  const identity=probeFactory(defaults,{motion:true,appearance:false});
  const outputs=Object.fromEntries(Object.keys(configs).map(k=>[k,{mot:'',hash:createHash('sha256'),timings:[],capacityDrops:0}]));
  let index=0;
  const stream=createInterface({input:createReadStream(featurePath),crlfDelay:Infinity});
  for await(const line of stream){
    const rec=JSON.parse(line),input=sequence.frames[index];assert(input);assert.equal(rec.frameNumber,index+1);assert.equal(rec.sequence,name);assert.equal(rec.inputSha256,hash(JSON.stringify(input)));
    validateFeatureFrame(rec.features,input,space);
    assert.equal(motion[index].frameNumber,index+1);assert.equal(motion[index].fromFrame,index?index:null);
    const frame={...rec.features,motionMatrix:motion[index].matrix};
    const baseline=trackers.base.update(input);
    assert.deepEqual(withoutTiming(identity.update({...input,motionMatrix:[1,0,0,0,1,0]})),withoutTiming(baseline));
    for(const [key,tracker] of Object.entries(trackers)){
      const result=key==='base'?baseline:tracker.update(frame),o=outputs[key];
      o.mot+=exportMot(index+1,result);o.hash.update(JSON.stringify(withoutTiming(result))+'\n');o.timings.push(result.timings.totalMs);o.capacityDrops+=result.droppedDetections;
    }
    index++;
  }
  assert.equal(index,sequence.info.length);
  const row={frames:index,detections:sequence.statistics.accepted,motionSha256:hash(motionBytes),featureSha256:previous.featureSha256,results:{}};
  for(const [key,o] of Object.entries(outputs)){
    assert.equal(o.capacityDrops,0);await mkdir(`${out}/trackers/${key}/data`,{recursive:true});
    await writeFile(`${out}/trackers/${key}/data/${name}.txt`,o.mot);
    const sorted=[...o.timings].sort((a,b)=>a-b);
    row.results[key]={motSha256:hash(o.mot),nonTimingSha256:o.hash.digest('hex'),capacityDrops:o.capacityDrops,totalMs:o.timings.reduce((a,b)=>a+b,0),p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)]};
    if(key==='base')assert.equal(hash(o.mot),previous.node.bytetrack[0].motSha256,'本轮基线偏离历史');
  }
  summary.sequences[name]=row;await writeFile(out+'/summary.json',JSON.stringify(summary,null,2));
  console.log(name,index,'identity逐帧一致、基线MOT哈希一致、0容量丢弃');
}
summary.complete=true;await writeFile(out+'/summary.json',JSON.stringify(summary,null,2));
