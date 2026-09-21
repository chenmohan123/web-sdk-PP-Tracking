// 一次性研究页面；完整 MOT17-05 冻结输入回放，不代表图像运动估计已在浏览器实现。
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const work='.tmp/botsort-feasibility',name='MOT17-05-FRCNN';
const routes=new Map([
  ['/probe.js',work+'/probe.js'],['/baseline.js','dist/index.js'],
  ['/adapter.js','scripts/evaluation/mot17/adapter.mjs'],['/compensate.js',work+'/compensate.mjs'],
  ['/features.jsonl',`.tmp/mot17-reid-official-05-0194ea5/features/${name}.jsonl`],
  ['/motion.jsonl',`${work}/motion/${name}.jsonl`],['/summary.json',work+'/run-2/summary.json']
]);
const server=createServer(async(req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>BoT-SORT 本地研究探针</title><p>一次性冻结输入回放；不是产品 Demo。</p>');return;}
  const file=routes.get(req.url);if(!file){res.writeHead(404).end();return;}
  try{const bytes=await readFile(file);res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'application/json');res.end(bytes);}catch{res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chromium',headless:true});const errors=[];
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result=await page.evaluate(async()=>{
    const [{createTracker:probe},{createTracker:base},{exportMot,withoutTiming},{compensate}]=await Promise.all([import('/probe.js'),import('/baseline.js'),import('/adapter.js'),import('/compensate.js')]);
    const summary=await(await fetch('/summary.json')).json();
    const frames=(await(await fetch('/features.jsonl')).text()).trim().split('\n').map(x=>JSON.parse(x).features);
    const motion=(await(await fetch('/motion.jsonl')).text()).trim().split('\n').map(JSON.parse);
    const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const rows={};
    for(const [key,config] of Object.entries(summary.configurations)){
      const tracker=key==='base'?base(summary.options):probe(summary.options,config);
      let mot='',nonTiming='',totalMs=0;
      for(let i=0;i<frames.length;i++){
        const r=tracker.update({...frames[i],motionMatrix:motion[i].matrix});
        mot+=exportMot(i+1,r);nonTiming+=JSON.stringify(withoutTiming(r))+'\n';totalMs+=r.timings.totalMs;
        if(r.droppedDetections)throw Error('容量丢弃');
      }
      rows[key]={motSha256:await hash(mot),nonTimingSha256:await hash(nonTiming),totalMs};
    }
    const state={mean:[50,80,20,100,3,4,1,2],covariance:Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>+(i===j)))};
    const moved=compensate(state,[1,0,12,0,1,-8]);
    if(JSON.stringify(moved.mean)!==JSON.stringify([62,72,20,100,3,4,1,2]))throw Error('平移矩阵不一致');
    return {sequence:'MOT17-05-FRCNN',frames:frames.length,rows};
  });
  const summary=JSON.parse(await readFile(work+'/run-2/summary.json','utf8'));
  for(const [key,row] of Object.entries(result.rows)){
    const expected=summary.sequences[name].results[key];
    assert.equal(row.motSha256,expected.motSha256);assert.equal(row.nonTimingSha256,expected.nonTimingSha256);
  }
  assert.deepEqual(errors,[]);
  await writeFile(work+'/browser-result.json',JSON.stringify({testedAt:new Date().toISOString(),browser:browser.version(),...result,errors,scope:'浏览器CPU关联+矩阵应用；运动矩阵离线Python生成，外观向量为旧归档，未重测模型速度'},null,2));
  console.log(JSON.stringify({browser:browser.version(),frames:result.frames,status:'三配置MOT和非耗时结果与Node完全一致',errors},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
