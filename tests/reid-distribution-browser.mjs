// 真实匿名双源验收：每个来源/后端独立冷缓存，从正式包子入口提取固定RGBA特征。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const work=resolve('.tmp/reid-distribution/browser');
await mkdir(work,{recursive:true});
await build({entryPoints:['dist/reid/index.js'],outfile:join(work,'reid.mjs'),bundle:true,format:'esm',platform:'browser',external:['onnxruntime-web','onnxruntime-web/*']});
const reference=JSON.parse(gunzipSync(await readFile('reports/2026-09-20-reid-preprocessing/evidence/python-result.json.gz')));
const fixture=reference.fixtures.find(f=>f.real);
assert(fixture);
const raw=await readFile(resolve('.tmp/reid-preprocessing-20260920/assets',fixture.rgba.path));
assert.equal(createHash('sha256').update(raw).digest('hex'),fixture.rgba.sha256);
const sources=JSON.parse(await readFile('models/pplcnet-reid/0.1.0/sources.json','utf8'));
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>真实双源验证</title><script type="importmap">{"imports":{"onnxruntime-web/all":"/ort/ort.all.min.mjs"}}</script>');return;}
    const name=basename(path);
    let data;
    if(path==='/reid.mjs') data=await readFile(join(work,'reid.mjs'));
    else if(path==='/tracking.mjs') data=await readFile('dist/index.js');
    else if(path==='/fixture.rgba') data=raw;
    else if(path.startsWith('/ort/')&&path.split('/').length===3) data=await readFile(join('node_modules/onnxruntime-web/dist',name));
    else {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',{'.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm'}[extname(name)]??'application/octet-stream');res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chromium',headless:true});
const report={testedAt:new Date().toISOString(),browser:browser.version(),scope:'真实匿名固定revision双源，正式dist/reid/index.js',runs:[],errors:[]};
try {
  for(const source of sources) for(const backend of ['wasm','webgpu']) {
    const page=await browser.newPage();
    page.setDefaultTimeout(180000);
    const requests=[];
    page.on('request',r=>requests.push(r.url()));
    page.on('pageerror',e=>report.errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async()=>{const {createTracker}=await import('/tracking.mjs');const t=createTracker();t.update({timestampMs:0,imageSize:{width:1,height:1},detections:[]});t.dispose();await import('/reid.mjs');});
    assert(!requests.some(u=>u.includes('/ort/')||u.includes('.onnx')));
    const run=await page.evaluate(async({kind,backend,fixture})=>{
      const api=await import('/reid.mjs');
      await api.clearReIdCache();
      const ort=await import('onnxruntime-web/all');ort.env.wasm.wasmPaths='/ort/';
      // ModelScope使用省略source的默认选择，HF必须显式指定。
      const instance=api.createReIdExtractor({modelId:'pplcnet-reid-fp32',backend,...(kind==='huggingface'?{source:kind}:{})});
      const progress=[];
      try {
        const loaded=await instance.load({onProgress:event=>progress.push(event)});
        const rgba=new Uint8Array(await(await fetch('/fixture.rgba')).arrayBuffer());
        const result=await instance.extract({image:{width:fixture.width,height:fixture.height,data:rgba},detections:[{box:fixture.box,score:0.9,classId:0}]});
        const vector=Array.from(result.detections[0].embedding),norm=Math.hypot(...vector),refNorm=Math.hypot(...fixture.reference);
        const expected=fixture.reference.map(v=>Math.fround(v/refNorm));
        const maxAbs=Math.max(...vector.map((v,i)=>Math.abs(v-expected[i])));
        const cosineDistance=1-vector.reduce((s,v,i)=>s+v*expected[i],0)/norm/Math.hypot(...expected);
        const adapter=backend==='webgpu'?(await ort.env.webgpu.device).adapterInfo:null;
        return {kind,backend,loaded,featureSpace:result.featureSpace,fixtureId:fixture.id,vector,maxAbs,cosineDistance,norm,timings:result.timings,progress,adapter:adapter?{vendor:adapter.vendor,architecture:adapter.architecture,isFallbackAdapter:adapter.isFallbackAdapter}:null};
      }finally{await instance.dispose();await api.clearReIdCache();}
    },{kind:source.kind,backend,fixture});
    assert.equal(run.loaded.source.kind,source.kind);assert.equal(run.loaded.source.revision,source.revision);
    assert.equal(run.loaded.runtime.actualBackend,backend);assert.equal(run.loaded.cache.status,'stored');
    assert.equal(requests.filter(u=>u===source.downloadUrl).length,1);
    assert(run.maxAbs<1e-3&&run.cosineDistance<1e-5&&Math.abs(run.norm-1)<1e-6);
    if(backend==='webgpu') assert.equal(run.adapter.isFallbackAdapter,false);
    report.runs.push({...run,rootImportNetworkClean:true,anonymousCorsDownload:true});
    console.log(JSON.stringify({source:source.kind,backend,maxAbs:run.maxAbs,cache:run.loaded.cache.status}));
    await page.close();
  }
  assert.equal(report.errors.length,0);
}catch(error){report.errors.push(String(error));throw error;}
finally{await writeFile(join(work,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
