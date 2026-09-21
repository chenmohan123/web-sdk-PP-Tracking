import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { hashFile,newOutput,readJson,save,sha256 } from './io.mjs';

const root=await fs.realpath(fileURLToPath(new URL('../../../',import.meta.url)));
const {values}=parseArgs({options:{gpu:{type:'string'},wasm:{type:'string'},out:{type:'string'}},strict:true});
for(const key of ['gpu','wasm','out']) if(!values[key]) throw new Error(`缺少 --${key}`);
const out=await newOutput(root,path.resolve(values.out)), name='MOT17-02-FRCNN';
const gpu=await readJson(path.join(values.gpu,'summary.json')),wasm=await readJson(path.join(values.wasm,'summary.json'));
for(const [run,backend] of [[gpu,'webgpu'],[wasm,'wasm']]) { assert(run.complete && run.subset && run.backend===backend); assert.deepEqual(Object.keys(run.sequences),[name]); assert.equal(run.sequences[name].frames,30); }
assert.equal(gpu.identitySha256,wasm.identitySha256); assert.deepEqual(gpu.configurations,wasm.configurations);
for(const [folder,run] of [[values.gpu,gpu],[values.wasm,wasm]]) {
  assert.equal(sha256(JSON.stringify(await readJson(path.join(folder,'identity.json')))),run.identitySha256);
  assert.equal(await hashFile(path.join(folder,`features/${name}.jsonl`)),run.sequences[name].featureSha256);
}
const lines=folder=>createInterface({input:createReadStream(path.join(folder,`features/${name}.jsonl`)),crlfDelay:Infinity});
const gpuLines=lines(values.gpu),wasmLines=lines(values.wasm),gpuIterator=gpuLines[Symbol.asyncIterator](),wasmIterator=wasmLines[Symbol.asyncIterator]();
let maxAbs=0,maxCosineDistance=0,totalCosineDistance=0,count=0,frames=0;
try {
  while(true) {
    const [a,b]=await Promise.all([gpuIterator.next(),wasmIterator.next()]); assert.equal(a.done,b.done); if(a.done) break;
    const x=JSON.parse(a.value),y=JSON.parse(b.value); assert.equal(x.frameNumber,y.frameNumber); assert.equal(x.inputSha256,y.inputSha256); assert.equal(x.features.featureSpaceId,y.features.featureSpaceId); assert.equal(x.features.detections.length,y.features.detections.length);
    for(let i=0;i<x.features.detections.length;i++) {
      const p=x.features.detections[i].embedding,q=y.features.detections[i].embedding; assert.equal(p.length,q.length);
      let dot=0,pp=0,qq=0;
      for(let j=0;j<p.length;j++) { assert(Number.isFinite(p[j])&&Number.isFinite(q[j])); maxAbs=Math.max(maxAbs,Math.abs(p[j]-q[j]));dot+=p[j]*q[j];pp+=p[j]*p[j];qq+=q[j]*q[j]; }
      const distance=1-dot/Math.sqrt(pp*qq); maxCosineDistance=Math.max(maxCosineDistance,distance);totalCosineDistance+=distance;count++;
    }
    frames++;
  }
} finally { gpuLines.close();wasmLines.close(); }
assert.equal(frames,30);
const tracks={};
for(const algorithm of ['bytetrack','ocsort','deepsort']) {
  const hashes=[];
  for(const folder of [values.gpu,values.wasm]) hashes.push({json:await hashFile(path.join(folder,`browser/${algorithm}/${name}.jsonl`)),mot:await hashFile(path.join(folder,`browser/${algorithm}/${name}.txt`))});
  tracks[algorithm]={nonTimingEqual:hashes[0].json===hashes[1].json,motEqual:hashes[0].mot===hashes[1].mot,hashes};
}
await fs.mkdir(path.dirname(out),{recursive:true});await fs.mkdir(await newOutput(root,out));
await save(root,path.join(out,'comparison.json'),{testedAt:new Date().toISOString(),scope:'预先固定02前30帧补充比较，不代表全量CPU模型评测',identitySha256:gpu.identitySha256,frames,detections:count,maxAbs,maxCosineDistance,meanCosineDistance:totalCosineDistance/count,tracks,sources:{gpu:path.resolve(values.gpu),wasm:path.resolve(values.wasm)}});
console.log(`补充比较完成：${out}`);
