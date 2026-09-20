// 图像输入一次性验收；服务仅绑定 localhost，研究结果不混入 SDK Demo。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const work = resolve(process.argv[2] ?? '.tmp/reid-preprocessing-20260920');
const probe = dirname(fileURLToPath(import.meta.url));
const ortDist = process.env.TRACKING_REID_ORT_DIST ?? 'F:/git/00_chenmohan/github/web-sdk-PP-Detection/node_modules/.pnpm/onnxruntime-web@1.27.0/node_modules/onnxruntime-web/dist';
const modelSha = '24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><title>ReID 图像输入本地验证</title><script src="/ort/ort.all.min.js"></script>'); return; }
    const base = url.startsWith('/ort/') ? ortDist : url.startsWith('/assets/') ? join(work, 'assets') : url === '/probe/preprocess.mjs' ? probe : null;
    assert(base && url.split('/').length === 3);
    const name = join(base, basename(url));
    res.setHeader('Content-Type', {'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'}[extname(name)] ?? 'application/octet-stream');
    res.end(await readFile(name));
  } catch (error) { res.writeHead(404); res.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [], errors = [];
try {
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  for (const backend of ['wasm', 'webgpu']) {
    const page = await browser.newPage();
    const messages = [];
    page.on('console', msg => { if (['warning','error'].includes(msg.type())) messages.push({type:msg.type(),text:msg.text()}); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async ({ backend, modelSha }) => {
      const {preprocessRgba, PREPROCESSING_ID} = await import('/probe/preprocess.mjs');
      const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
      const get = async entry => {
        const response = await fetch(`/assets/${entry.path}`);
        if (!response.ok) throw new Error('资源无法获取');
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== entry.bytes || await sha(buffer) !== entry.sha256) throw new Error('输入资产身份不符');
        return buffer;
      };
      const compare = (a,b, vector=false) => {
        if (a.length!==b.length || !a.length) throw new Error('比较维度错误');
        let maxAbs=0, different=0, dot=0, na=0, nb=0;
        for(let i=0;i<a.length;i++) {
          if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('非有限值');
          maxAbs=Math.max(maxAbs,Math.abs(a[i]-b[i])); different+=a[i]!==b[i];
          if(vector) { dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i]; }
        }
        if(vector && (!na||!nb)) throw new Error('零范数');
        return {maxAbs,different,...(vector?{cosineDistance:1-dot/Math.sqrt(na*nb)}:{})};
      };
      const decode = async (entry, mime) => {
        const bitmap = await createImageBitmap(new Blob([await get(entry)],{type:mime}), {premultiplyAlpha:'none',colorSpaceConversion:'none'});
        try {
          const canvas = document.createElement('canvas'); canvas.width=bitmap.width;canvas.height=bitmap.height;
          const context=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
          context.drawImage(bitmap,0,0);
          return context.getImageData(0,0,bitmap.width,bitmap.height,{colorSpace:'srgb'});
        } finally { bitmap.close(); }
      };
      ort.env.wasm.wasmPaths='/ort/';ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      const model = await (await fetch('/assets/model.onnx')).arrayBuffer();
      if(await sha(model)!==modelSha) throw new Error('模型身份不符');
      let session;
      const validation=[], diagnostics=[];
      try {
        session=await ort.InferenceSession.create(model,{executionProviders:[backend],graphOptimizationLevel:'basic',...(backend==='webgpu'?{extra:{session:{disable_cpu_ep_fallback:'1'}}}:{})});
        const info=backend==='webgpu'?(await ort.env.webgpu.device).adapterInfo:null;
        const actualAdapter=info?{vendor:info.vendor,architecture:info.architecture,isFallbackAdapter:info.isFallbackAdapter}:null;
        if(backend==='webgpu'&&(!actualAdapter||actualAdapter.isFallbackAdapter)) throw new Error('没有实际硬件GPU证据');
        const run=async tensor=>{
          const input=new ort.Tensor('float32',tensor,[1,3,192,64]);
          let output;
          try {
            output=await session.run({crops:input});
            const result=output[session.outputNames[0]];
            if(result.dims.join(',')!=='1,512') throw new Error('输出维度错误');
            return Array.from(result.data);
          } finally { input.dispose(); if(output) for(const t of Object.values(output)) t.dispose(); }
        };
        const fixtures=await (await fetch('/assets/fixtures.json')).json();
        let performanceInput;
        for(const fixture of fixtures) {
          const image={width:fixture.width,height:fixture.height,data:new Uint8ClampedArray(await get(fixture.rgba))};
          const referenceTensor=new Float32Array(await get(fixture.tensor));
          const raw=preprocessRgba(image,fixture.box);
          const tensorError=compare(referenceTensor,raw.tensor);
          if(raw.tensor.length!==36864 || tensorError.maxAbs>2e-6) throw new Error(`张量对齐失败: ${fixture.name}`);
          const output=await run(raw.tensor);
          const error=compare(fixture.reference,output,true);
          let png=null;
          if(fixture.png) {
            const decoded=await decode(fixture.png,'image/png');
            const pixels=compare(image.data,decoded.data);
            if(pixels.maxAbs!==0 || decoded.width!==image.width || decoded.height!==image.height) throw new Error(`PNG像素不一致: ${fixture.name}`);
            const actual=preprocessRgba(decoded,fixture.box);
            const pngTensor=compare(referenceTensor,actual.tensor);
            const pngOutput=await run(actual.tensor);
            png={pixels,tensor:pngTensor,output:pngOutput,error:compare(fixture.reference,pngOutput,true)};
          }
          const passed=error.maxAbs<1e-3&&error.cosineDistance<1e-5&&(!png||(png.tensor.maxAbs<=2e-6&&png.error.maxAbs<1e-3&&png.error.cosineDistance<1e-5));
          validation.push({id:fixture.id,name:fixture.name,tensor:tensorError,tensorSha256:await sha(raw.tensor.buffer),output,error,png,passed});
          if(fixture.jpeg) {
            const decoded=await decode(fixture.jpeg,'image/jpeg');
            const actual=preprocessRgba(decoded,fixture.box);
            const jpegOutput=await run(actual.tensor);
            diagnostics.push({id:fixture.id,name:fixture.name,pixels:compare(image.data,decoded.data),tensor:compare(referenceTensor,actual.tensor),output:jpegOutput,error:compare(fixture.reference,jpegOutput,true)});
          }
          if(fixture.real&&!performanceInput) performanceInput={image,box:fixture.box};
        }
        const timed=[];
        for(let i=0;i<35;i++) {
          const start=performance.now();
          const tensor=preprocessRgba(performanceInput.image,performanceInput.box).tensor;
          const pre=performance.now();
          const vector=await run(tensor);
          const inference=performance.now();
          const norm=Math.hypot(...vector);
          if(!norm || !Number.isFinite(norm)) throw new Error('特征归一化失败');
          const normalized=Float32Array.from(vector,x=>x/norm);
          const end=performance.now();
          if(i>=5) timed.push({preprocessMs:pre-start,inferenceMs:inference-pre,postprocessMs:end-inference,totalMs:end-start,normalizedNorm:Math.hypot(...normalized)});
        }
        return {backend,status:'ran',modelSha256:modelSha,preprocessingId:PREPROCESSING_ID,actualAdapter,disableCpuEpFallback:backend==='webgpu',ortVersion:ort.env.versions,userAgent:navigator.userAgent,crossOriginIsolated,wasmThreads:1,validation,diagnostics,timed};
      } catch(error) { return {backend,status:'failed',error:String(error),validation,diagnostics}; }
      finally {await session?.release();}
    }, {backend,modelSha});
    result.consoleMessages=messages;results.push(result);
    console.log(JSON.stringify({backend,status:result.status,passed:result.validation.filter(x=>x.passed).length,total:result.validation.length,maxTensor:Math.max(...result.validation.map(x=>x.tensor.maxAbs)),maxVector:Math.max(...result.validation.map(x=>x.error.maxAbs)),error:result.error}));
    await page.close();
  }
  await writeFile(join(work,'browser-result.json.gz'),gzipSync(JSON.stringify({date:'2026-09-20',browserVersion:browser.version(),headless:true,results,errors})));
  assert(!errors.length && results.every(r=>r.status==='ran'&&r.validation.every(x=>x.passed)), '图像输入验证失败，保留原始结果');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
