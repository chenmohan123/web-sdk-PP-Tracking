// 固定输入的两次候选回放；输出到新的研究目录，拒绝覆盖已有证据。
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { createBoTSortTracker } from '../../../.tmp/botsort-core/build/index.js';
import { createTracker } from '../../../dist/index.js';
import { adaptDetections, parseSequenceInfo, exportMot, withoutTiming } from '../mot17/adapter.mjs';
import { validateFeatureFrame } from '../mot17-reid/core.mjs';
import { hashFile } from '../mot17-reid/io.mjs';
import { candidateFrame } from './adapter.mjs';
const output='.tmp/botsort-core/run';
await mkdir(output);
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const history=await json('reports/2026-09-21-botsort-feasibility/run-summary.json');
const provenance=await json('reports/2026-09-21-botsort-feasibility/provenance.json');
const {algorithm,...common}=history.options;
assert.equal(algorithm,'bytetrack');
const configs={identity:{...common,motionFailure:'identity'},cmc:{...common,motionFailure:'identity'},'cmc-reid':{...common,motionFailure:'identity',appearance:{featureSpace:provenance.frozenFeatures.featureSpace}}};
const summary={testedAt:new Date().toISOString(),node:process.version,candidateVersion:'0.2.0-rc.0+botsort-core.1',configurations:configs,sequences:{},inputs:provenance.inputHashes,hashes:{candidate:await hashFile('.tmp/botsort-core/build/index.js'),baseline:await hashFile('dist/index.js'),adapter:await hashFile('scripts/evaluation/botsort-core/adapter.mjs')},scope:'冻结矩阵与向量；仅CPU跟踪，未重跑图像估计/ReID/检测'};
for(const [name,pin] of Object.entries(history.sequences)) {
  const labelroot='.tmp/mot17-ocsort-c036be8/input/'+name;
  for(const relative of ['seqinfo.ini','det/det.txt'])assert.equal(await hashFile(labelroot+'/'+relative),provenance.inputHashes[name][relative].sha256);
  const sequence=adaptDetections(await readFile(labelroot+'/det/det.txt','utf8'),parseSequenceInfo(await readFile(labelroot+'/seqinfo.ini','utf8')));
  const motionPath='.tmp/botsort-feasibility/motion/'+name+'.jsonl';assert.equal(await hashFile(motionPath),pin.motionSha256);
  const motions=(await readFile(motionPath,'utf8')).trim().split('\n').map(JSON.parse);
  const featurePath=`.tmp/mot17-reid-official-${name.split('-')[1]}-0194ea5/features/${name}.jsonl`;assert.equal(await hashFile(featurePath),pin.featureSha256);
  const records=[];
  for await(const line of createInterface({input:createReadStream(featurePath),crlfDelay:Infinity}))records.push(JSON.parse(line));
  assert.equal(records.length,pin.frames);assert.equal(motions.length,pin.frames);
  for(let i=0;i<records.length;i++) {
    assert.equal(records[i].frameNumber,i+1);assert.equal(records[i].sequence,name);assert.equal(records[i].inputSha256,hash(JSON.stringify(sequence.frames[i])));
    assert.equal(motions[i].frameNumber,i+1);assert.equal(motions[i].fromFrame,i?i:null);
    validateFeatureFrame(records[i].features,sequence.frames[i],provenance.frozenFeatures.featureSpace);
  }
  const results={};
  for(let repeat=0;repeat<2;repeat++)for(const [key,options] of Object.entries(configs)) {
    const tracker=createBoTSortTracker(options),base=key==='identity'?createTracker(common):null;
    let mot='',nonTiming=createHash('sha256'),previous=null,capacityDrops=0;const times=[];
    for(let i=0;i<records.length;i++) {
      const frame=candidateFrame(records[i].features,motions[i],previous,key==='cmc-reid',key==='identity'?'identity':'full');
      const result=tracker.update(frame);
      if(base){const original=base.update(sequence.frames[i]);assert.deepEqual(result.tracks,original.tracks);assert.deepEqual(result.removed,original.removed);assert.equal(result.generation,original.generation);}
      mot+=exportMot(i+1,result);nonTiming.update(JSON.stringify(withoutTiming(result))+'\n');times.push(result.timings.totalMs);capacityDrops+=result.droppedDetections;previous=frame;
    }
    tracker.dispose();base?.dispose();
    const motSha256=hash(mot),nonTimingSha256=nonTiming.digest('hex');
    assert.equal(capacityDrops,0);
    assert.equal(motSha256,pin.results[key==='identity'?'base':key].motSha256,'候选轨迹偏离固定研究探针');
    const sorted=[...times].sort((a,b)=>a-b);
    const row={motSha256,nonTimingSha256,capacityDrops,totalMs:times.reduce((a,b)=>a+b,0),p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)]};
    if(!repeat){results[key]=[row];await mkdir(`${output}/trackers/${key}/data`,{recursive:true});await writeFile(`${output}/trackers/${key}/data/${name}.txt`,mot);}else{assert.equal(row.nonTimingSha256,results[key][0].nonTimingSha256);results[key].push(row);}
  }
  summary.sequences[name]={frames:records.length,detections:sequence.statistics.accepted,motionSha256:pin.motionSha256,featureSha256:pin.featureSha256,results};
  console.log(name,records.length,'三配置两次非耗时一致、MOT对齐研究、0容量丢弃');
  await writeFile(output+'/summary.json',JSON.stringify(summary,null,2));
}
summary.complete=true;await writeFile(output+'/summary.json',JSON.stringify(summary,null,2));
