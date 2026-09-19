import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { options, writeReport, sdkRoot as defaultRoot, archiveRoot } from './options.mjs';
const args = options({ sdk: defaultRoot, input: path.join(archiveRoot, 'inputs.json'), out: path.join(defaultRoot, '.tmp/evaluation-api.json') });
const sdkRoot = args.sdk;
const {createTracker}=await import(pathToFileURL(sdkRoot+'/dist/index.js').href);
const inputPath = args.input;
const inputBytes=await fs.readFile(inputPath);
const scenes=JSON.parse(inputBytes);
const convert=f=>({timestampMs:f.timestamp_ms,imageSize:{width:640,height:480},detections:f.detections.map(d=>({classId:d.class_id,score:d.score,box:{x:d.box[0],y:d.box[1],width:d.box[2]-d.box[0],height:d.box[3]-d.box[1]}}))});
const clean=result=>{const {timings,...rest}=result;return rest;};
const reports=[];
for(const scene of scenes){
  const tracker=createTracker({maxLostMs:5*1000/30});
  const uninterrupted=createTracker({maxLostMs:5*1000/30});
  const noise=createTracker();
  const outputs=[];
  for(const raw of scene.frames){
    const frame=convert(raw);
    const result=tracker.update(frame);
    assert.deepEqual(clean(result),clean(uninterrupted.update(frame)),'其他实例改变了状态');
    noise.reset();noise.update({timestampMs:0,imageSize:{width:10,height:10},detections:[{box:{x:0,y:0,width:1,height:1},score:0.9,classId:9}]});
    assert.equal(new Set(result.tracks.map(x=>x.id)).size,result.tracks.length,'轨迹ID重复');
    for(const t of result.tracks){
      assert.ok(t.box.width>0&&t.box.height>0);
      assert.ok(Object.values(t.box).every(Number.isFinite));
      if(!t.observed)assert.equal(t.score,null,'预测轨迹残留检测分数');
    }
    outputs.push(result);
  }
  if(['translation','low_score','short_occlusion'].includes(scene.name)){
    const ids=outputs.flatMap(x=>x.tracks.filter(t=>t.observed).map(t=>t.id));
    assert.equal(new Set(ids).size,1,scene.name+'出现不必要ID变化');
  }
  if(scene.name==='low_score')assert.ok(outputs.slice(3,6).every(x=>x.tracks.some(t=>t.observed&&t.score===0.2)));
  if(scene.name==='multi_class'){
    const first=outputs[0].tracks[0].id;
    assert.ok(outputs.slice(5).every(x=>x.tracks.filter(t=>t.classId===1).every(t=>t.id!==first)),'跨类复用ID');
  }
  if(scene.name==='long_loss')assert.notEqual(outputs.at(-1).tracks.find(t=>t.observed).id,outputs[0].tracks[0].id);
  reports.push({name:scene.name,config:{maxLostMs:5*1000/30},sourceNote:scene.note,outputs});
  tracker.dispose();uninterrupted.dispose();noise.dispose();
}
const report={verifiedAt:new Date().toISOString(),sdkRoot,sdkCommit:execFileSync('git',['-C',sdkRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),entrySha256:createHash('sha256').update(await fs.readFile(sdkRoot+'/dist/index.js')).digest('hex'),inputPath,inputSha256:createHash('sha256').update(inputBytes).digest('hex'),scope:'先前原创合成序列上的独立公开API复核；不是官方逐值一致性或MOT精度',scenes:reports};
await writeReport(args.out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scenes:reports.length,updates:reports.reduce((n,s)=>n+s.outputs.length,0),assertions:'通过',evidence:args.out}));
