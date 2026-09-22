// 只读复核归档与绑定；--local额外读取本机输入/构建/轨迹，不重新执行模型或评分。
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const report=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(report,'../..');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const hash=async file=>{const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');};
const lock=await read(path.join(report,'evidence.lock.json'));
for(const [relative,pin] of Object.entries(lock.files)) {
  const file=path.resolve(report,relative);assert(file.startsWith(report+path.sep));
  assert.equal((await stat(file)).size,pin.bytes,relative);assert.equal(await hash(file),pin.sha256,relative);
}
const run=await read(path.join(report,'run-summary.json')),metrics=await read(path.join(report,'metrics.json'));
const browser=await read(path.join(report,'browser.json')),build=await read(path.join(report,'build-result.json'));
const ablation=await read(path.join(report,'ablation-summary.json')),ablationMetrics=await read(path.join(report,'ablation-metrics.json'));
const sources=await read(path.join(report,'provenance.json'));
const oldRun=await read(path.join(report,'../2026-09-21-botsort-feasibility/run-summary.json'));
const oldMetrics=await read(path.join(report,'../2026-09-21-botsort-feasibility/metrics.json'));
assert.equal(run.complete,true);assert.equal(ablation.complete,true);assert.equal(run.hashes.candidate,build.hashes['index.js']);assert.equal(ablation.candidateSha256,run.hashes.candidate);
assert.equal(Object.keys(run.sequences).length,7);
assert.equal(Object.values(run.sequences).reduce((sum,row)=>sum+row.frames,0),5316);
assert.equal(Object.values(run.sequences).reduce((sum,row)=>sum+row.detections,0),67639);
assert.equal(browser.frames,837);assert.deepEqual(browser.errors,[]);
assert.equal(metrics.scorer.commit,'12c8791b303e0a0b50f753af204249e622d0281a');
for(const [name,row] of Object.entries(run.sequences)) {
  assert.equal(row.featureSha256,oldRun.sequences[name].featureSha256);assert.equal(row.motionSha256,oldRun.sequences[name].motionSha256);
  for(const [config,repetitions] of Object.entries(row.results)) {
    assert.equal(repetitions.length,2);assert.equal(repetitions[0].motSha256,repetitions[1].motSha256);assert.equal(repetitions[0].nonTimingSha256,repetitions[1].nonTimingSha256);
    assert.equal(repetitions[0].motSha256,oldRun.sequences[name].results[config==='identity'?'base':config].motSha256);
    for(const repetition of repetitions)assert.equal(repetition.capacityDrops,0);
  }
}
for(const config of Object.keys(run.configurations)) {
  assert.deepEqual(metrics[config],oldMetrics[config==='identity'?'base':config]);
  for(const key of ['motSha256','nonTimingSha256'])assert.equal(browser.rows[config][key],run.sequences[browser.sequence].results[config][0][key]);
}
for(const mode of ['identity','full'])assert.deepEqual(ablationMetrics[mode].sequences['MOT17-09-FRCNN'],metrics[mode==='full'?'cmc':'identity'].sequences['MOT17-09-FRCNN']);
for(const kind of [metrics,ablationMetrics])for(const [key,record]of Object.entries(kind)) {
  if(key==='scorer'||key==='protocol')continue;
  const row=record.combined;
  assert(Math.abs(row.IDF1-2*row.IDTP/(2*row.IDTP+row.IDFP+row.IDFN))<1e-12);
  assert(Math.abs(row.MOTA-(1-(row.FP+row.FN+row.IDSW)/row.GT))<1e-12);
}
if(process.argv.includes('--local')) {
  for(const [file,expected]of Object.entries(sources.sourceHashes))assert.equal(await hash(path.join(repo,file)),expected,file);
  assert.equal(await hash(path.join(repo,'.tmp/botsort-core/build/index.js')),run.hashes.candidate);
  assert.equal(await hash(path.join(repo,'.tmp/botsort-core/build/index.cjs')),build.hashes['index.cjs']);
  assert.equal(await hash(path.join(repo,'dist/index.js')),run.hashes.baseline);
  for(const [name,row]of Object.entries(run.sequences)) {
    for(const [file,pin]of Object.entries(run.inputs[name])){
      const target=path.join(repo,'.tmp/mot17-ocsort-c036be8/input',name,file);assert.equal((await stat(target)).size,pin.bytes);assert.equal(await hash(target),pin.sha256);
    }
    assert.equal(await hash(path.join(repo,'.tmp/botsort-feasibility/motion',name+'.jsonl')),row.motionSha256);
    assert.equal(await hash(path.join(repo,`.tmp/mot17-reid-official-${name.split('-')[1]}-0194ea5/features`,name+'.jsonl')),row.featureSha256);
    for(const [config,results]of Object.entries(row.results))assert.equal(await hash(path.join(repo,'.tmp/botsort-core/run/trackers',config,'data',name+'.txt')),results[0].motSha256);
  }
  for(const [config,results]of Object.entries(ablation.sequences['MOT17-09-FRCNN'].results))assert.equal(await hash(path.join(repo,'.tmp/botsort-core/ablation-verified/trackers',config,'data/MOT17-09-FRCNN.txt')),results[0].motSha256);
}
console.log(JSON.stringify({status:'通过',files:Object.keys(lock.files).length,sequences:7,frames:5316,configurations:3,repetitions:2,browserFrames:837,local:process.argv.includes('--local')}));
