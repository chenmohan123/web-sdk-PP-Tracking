// 完整05序列浏览器CPU回放与输入/生命周期契约；不运行图像估计或ReID模型。
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { hashFile } from '../mot17-reid/io.mjs';
const name='MOT17-05-FRCNN',work='.tmp/botsort-core';
const summary=JSON.parse(await readFile(work+'/run/summary.json','utf8'));
assert.equal(summary.complete,true);
const routes=new Map([
  ['/candidate.js',work+'/build/index.js'],['/adapter.js','scripts/evaluation/botsort-core/adapter.mjs'],
  ['/mot.js','scripts/evaluation/mot17/adapter.mjs'],['/summary.json',work+'/run/summary.json'],
  ['/motion.jsonl',`.tmp/botsort-feasibility/motion/${name}.jsonl`],
  ['/features.jsonl',`.tmp/mot17-reid-official-05-0194ea5/features/${name}.jsonl`],
]);
assert.equal(await hashFile(routes.get('/candidate.js')),summary.hashes.candidate);
assert.equal(await hashFile(routes.get('/adapter.js')),summary.hashes.adapter);
assert.equal(await hashFile(routes.get('/motion.jsonl')),summary.sequences[name].motionSha256);
assert.equal(await hashFile(routes.get('/features.jsonl')),summary.sequences[name].featureSha256);
const server=createServer(async(req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>BoT-SORT 本地核心验收</title><p>候选CPU回放</p>');return;}
  const file=routes.get(req.url);if(!file){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'application/json');res.end(await readFile(file));}catch{res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const errors=[];
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const data=await page.evaluate(async()=>{
    const [{createBoTSortTracker},{candidateFrame},{exportMot,withoutTiming}]=await Promise.all([import('/candidate.js'),import('/adapter.js'),import('/mot.js')]);
    const summary=await(await fetch('/summary.json')).json();
    const records=(await(await fetch('/features.jsonl')).text()).trim().split('\n').map(JSON.parse);
    const motion=(await(await fetch('/motion.jsonl')).text()).trim().split('\n').map(JSON.parse);
    const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const rows={};
    for(const [config,options] of Object.entries(summary.configurations)) {
      const tracker=createBoTSortTracker(options);let previous=null,mot='',nonTiming='',totalMs=0;
      for(let i=0;i<records.length;i++) {
        const frame=candidateFrame(records[i].features,motion[i],previous,config==='cmc-reid',config==='identity'?'identity':'full');
        const result=tracker.update(frame);mot+=exportMot(i+1,result);nonTiming+=JSON.stringify(withoutTiming(result))+'\n';totalMs+=result.timings.totalMs;previous=frame;
        if(result.droppedDetections)throw Error('容量丢弃');
      }
      tracker.dispose();rows[config]={motSha256:await hash(mot),nonTimingSha256:await hash(nonTiming),totalMs};
    }
    const check=(fn,code)=>{try{fn();}catch(e){if(e.code===code)return;throw e;}throw Error('预期错误未出现：'+code);};
    const first=candidateFrame(records[0].features,motion[0],null,false),tracker=createBoTSortTracker();
    check(()=>tracker.update({...first,motion:{status:'identity',from:null,to:first.motion.to}}),'INVALID_INPUT');
    tracker.update(first);
    const second=candidateFrame(records[1].features,motion[1],first,false);
    check(()=>tracker.update({...second,motion:{...second.motion,from:{frameId:999,timestampMs:0}}}),'INVALID_INPUT');
    const abort=new AbortController();abort.abort();check(()=>tracker.update(second,{signal:abort.signal}),'ABORTED');
    tracker.update(second);tracker.reset();if(tracker.update(first).generation!==1)throw Error('reset失败');
    tracker.dispose();tracker.dispose();check(()=>tracker.update(second),'DISPOSED');check(()=>tracker.reset(),'DISPOSED');
    return {frames:records.length,rows,checks:['三配置完整837帧','首帧拒绝','from身份拒绝','取消重试','reset代次','dispose幂等']};
  });
  assert.equal(data.frames,837);assert.deepEqual(errors,[]);
  for(const [key,row] of Object.entries(data.rows))for(const field of ['motSha256','nonTimingSha256'])assert.equal(row[field],summary.sequences[name].results[key][0][field]);
  const report={testedAt:new Date().toISOString(),browser:browser.version(),sequence:name,...data,errors,scope:'冻结运动矩阵与向量，CPU候选关联；不含图像估计/ReID推理'};
  await writeFile(work+'/browser-verified.json',JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report,null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
