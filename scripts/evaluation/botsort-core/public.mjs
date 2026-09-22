// 公开根入口对齐验收：复用固定输入，只写新目录，不重跑检测/估计/模型或读取GT。
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { createTracker } from '../../../dist/index.js';
import { adaptDetections, parseSequenceInfo, exportMot, withoutTiming } from '../mot17/adapter.mjs';
import { validateFeatureFrame } from '../mot17-reid/core.mjs';
import { hashFile } from '../mot17-reid/io.mjs';
import { candidateFrame } from './adapter.mjs';

const output='.tmp/botsort-integration/run';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const prior=await json('reports/2026-09-22-botsort-core/run-summary.json');
const metadata=await json('reports/2026-09-21-botsort-feasibility/provenance.json');
const pkg=await json('package.json');
assert.equal(pkg.version,'0.2.0-rc.1');
const configurations=Object.fromEntries(Object.entries(prior.configurations).map(([key,value])=>[key,{algorithm:'botsort',...value}]));
const summary={testedAt:new Date().toISOString(),node:process.version,version:pkg.version,complete:false,configurations,inputs:prior.inputs,sequences:{},hashes:{candidate:await hashFile('dist/index.js'),adapter:await hashFile('scripts/evaluation/botsort-core/adapter.mjs'),script:await hashFile('scripts/evaluation/botsort-core/public.mjs')},scope:'公开根入口；冻结矩阵和向量；不含图像估计、ReID与检测'};
await mkdir(output);
for(const [name,pin] of Object.entries(prior.sequences)) {
  const labelRoot='.tmp/mot17-ocsort-c036be8/input/'+name;
  for(const file of ['seqinfo.ini','det/det.txt'])assert.equal(await hashFile(labelRoot+'/'+file),prior.inputs[name][file].sha256);
  const sequence=adaptDetections(await readFile(labelRoot+'/det/det.txt','utf8'),parseSequenceInfo(await readFile(labelRoot+'/seqinfo.ini','utf8')));
  const motionPath='.tmp/botsort-feasibility/motion/'+name+'.jsonl';
  const featurePath=`.tmp/mot17-reid-official-${name.split('-')[1]}-0194ea5/features/${name}.jsonl`;
  assert.equal(await hashFile(motionPath),pin.motionSha256);assert.equal(await hashFile(featurePath),pin.featureSha256);
  const motions=(await readFile(motionPath,'utf8')).trim().split('\n').map(JSON.parse);
  const records=[];
  for await(const line of createInterface({input:createReadStream(featurePath),crlfDelay:Infinity}))records.push(JSON.parse(line));
  assert.equal(records.length,pin.frames);assert.equal(motions.length,pin.frames);
  for(let i=0;i<records.length;i++) {
    assert.equal(records[i].sequence,name);assert.equal(records[i].frameNumber,i+1);
    assert.equal(records[i].inputSha256,hash(JSON.stringify(sequence.frames[i])));
    assert.equal(motions[i].frameNumber,i+1);assert.equal(motions[i].fromFrame,i?i:null);
    validateFeatureFrame(records[i].features,sequence.frames[i],metadata.frozenFeatures.featureSpace);
  }
  const results={};
  for(let repeat=0;repeat<2;repeat++)for(const [config,options]of Object.entries(configurations)) {
    const tracker=createTracker(options);let previous=null,mot='',totalMs=0,capacityDrops=0;
    const nonTiming=createHash('sha256'),historical=createHash('sha256');
    for(let i=0;i<records.length;i++) {
      const frame=candidateFrame(records[i].features,motions[i],previous,config==='cmc-reid',config==='identity'?'identity':'full');
      const result=tracker.update(frame);
      assert.equal(result.algorithm,'botsort');assert.equal(result.runtime.runtimeVersion,'web-sdk-pp-tracking@'+pkg.version);
      mot+=exportMot(i+1,result);const stripped=withoutTiming(result);nonTiming.update(JSON.stringify(stripped)+'\n');
      // 仅归一化预期改变的版本字符串，其他非耗时字段必须与旧核心逐字一致。
      const old={...stripped,runtime:{...stripped.runtime,runtimeVersion:'web-sdk-pp-tracking@0.2.0-rc.0+botsort-core.1'}};
      historical.update(JSON.stringify(old)+'\n');totalMs+=result.timings.totalMs;capacityDrops+=result.droppedDetections;previous=frame;
    }
    tracker.dispose();
    const row={motSha256:hash(mot),nonTimingSha256:nonTiming.digest('hex'),normalizedHistoricalSha256:historical.digest('hex'),totalMs,capacityDrops};
    assert.equal(capacityDrops,0);assert.equal(row.motSha256,pin.results[config][0].motSha256);
    assert.equal(row.normalizedHistoricalSha256,pin.results[config][0].nonTimingSha256);
    if(repeat){assert.equal(row.nonTimingSha256,results[config][0].nonTimingSha256);results[config].push(row);}
    else {results[config]=[row];await mkdir(`${output}/trackers/${config}/data`,{recursive:true});await writeFile(`${output}/trackers/${config}/data/${name}.txt`,mot);}
  }
  summary.sequences[name]={frames:pin.frames,detections:pin.detections,motionSha256:pin.motionSha256,featureSha256:pin.featureSha256,results};
  await writeFile(output+'/summary.json',JSON.stringify(summary,null,2)+'\n');
  console.log(name,'公开入口三配置两次一致；MOT和除版本外所有非耗时输出对齐旧核心');
}
summary.complete=true;await writeFile(output+'/summary.json',JSON.stringify(summary,null,2)+'\n');
