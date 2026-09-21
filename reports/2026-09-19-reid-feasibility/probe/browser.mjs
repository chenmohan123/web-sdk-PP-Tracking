// 一次性浏览器可行性探针；不属于 SDK 或 Demo，不验证行人识别质量。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(fileURLToPath(import.meta.url));
const ortDist = process.env.TRACKING_REID_ORT_DIST ?? 'F:/git/00_chenmohan/github/web-sdk-PP-Detection/node_modules/.pnpm/onnxruntime-web@1.27.0/node_modules/onnxruntime-web/dist';
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><meta charset="utf-8"><title>ReID 一次性可行性探针</title><script src="/ort/ort.all.min.js"></script>');
      return;
    }
    const base = path.startsWith('/ort/') ? ortDist : path.startsWith('/assets/') ? join(root, 'assets') : null;
    assert(base && path.split('/').length === 3);
    const file = join(base, basename(path));
    const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(404); res.end(String(error));
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [], errors = [];
try {
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  for (const backend of ['wasm', 'webgpu']) {
    const page = await browser.newPage();
    const consoleMessages = [];
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) consoleMessages.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(async backend => {
      const compare = (a, b) => {
        let maxAbs = 0, dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
          if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('非有限输出');
          maxAbs = Math.max(maxAbs, Math.abs(a[i] - b[i]));
          dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2;
        }
        if (!normA || !normB) throw new Error('零范数输出');
        return { maxAbs, cosineDistance: 1 - dot / Math.sqrt(normA * normB) };
      };
      const stats = values => {
        const sorted = [...values].sort((a, b) => a - b);
        return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], rawMs: values };
      };
      const adapter = await navigator.gpu?.requestAdapter();
      const adapterInfo = adapter ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description, isFallbackAdapter: adapter.info.isFallbackAdapter } : null;
      ort.env.wasm.wasmPaths = '/ort/';
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const fixtures = await (await fetch('/assets/fixtures.json')).json();
      const tensors = [];
      for (const fixture of fixtures) {
        const data = new Float32Array(await (await fetch(`/assets/input-${fixture.id}.f32`)).arrayBuffer());
        tensors.push(new ort.Tensor('float32', data, [1, 3, 256, 128]));
      }
      const loadStart = performance.now();
      const model = await (await fetch('/assets/reid-0288-fp32-ort.onnx')).arrayBuffer();
      const localFetchMs = performance.now() - loadStart;
      const sessionStart = performance.now();
      let session;
      try {
        session = await ort.InferenceSession.create(model, { executionProviders: [backend], graphOptimizationLevel: 'basic', ...(backend === 'webgpu' ? { extra: { session: { disable_cpu_ep_fallback: '1' } } } : {}) });
        const sessionMs = performance.now() - sessionStart;
        const start = performance.now();
        const first = await session.run({ data: tensors[0] });
        const firstInferenceMs = performance.now() - start;
        const validation = [];
        for (let i = 0; i < fixtures.length; i++) {
          const output = i === 0 ? first : await session.run({ data: tensors[i] });
          const vector = output[session.outputNames[0]];
          if (vector.dims.join(',') !== '1,256') throw new Error('输出维度不符');
          validation.push({ id: i, ...compare(fixtures[i].reference, Array.from(vector.data)), output: Array.from(vector.data) });
        }
        for (let i = 0; i < 5; i++) await session.run({ data: tensors[i % tensors.length] });
        const raw = [];
        for (let i = 0; i < 30; i++) {
          const start = performance.now();
          await session.run({ data: tensors[i % tensors.length] });
          raw.push(performance.now() - start);
        }
        const serialCrops = [];
        for (const count of [8, 16]) {
          const times = [];
          for (let repeat = 0; repeat < 5; repeat++) {
            const start = performance.now();
            for (let i = 0; i < count; i++) await session.run({ data: tensors[i % tensors.length] });
            times.push(performance.now() - start);
          }
          serialCrops.push({ crops: count, iterations: 5, ...stats(times) });
        }
        return { backend, status: 'ran', userAgent: navigator.userAgent, adapterInfo, crossOriginIsolated, ortVersion: ort.env.versions, graphOptimizationLevel: 'basic', wasmThreads: 1, disableCpuEpFallback: backend === 'webgpu', localFetchMs, sessionMs, firstInferenceMs, validation, warm: { warmup: 5, iterations: 30, ...stats(raw) }, serialCrops };
      } catch (error) {
        return { backend, status: 'failed', userAgent: navigator.userAgent, adapterInfo, error: String(error) };
      } finally {
        await session?.release();
      }
    }, backend);
    result.consoleMessages = consoleMessages;
    if (result.status === 'ran') result.validationPassed = result.validation.every(item => item.maxAbs < 1e-3 && item.cosineDistance < 1e-5);
    results.push(result);
    console.log(JSON.stringify({ backend, status: result.status, validationPassed: result.validationPassed, warmMedianMs: result.warm?.medianMs, maxAbs: result.validation && Math.max(...result.validation.map(x => x.maxAbs)), error: result.error }));
    await page.close();
  }
  const modelBytes = await readFile(join(root, 'assets/reid-0288-fp32-ort.onnx'));
  await writeFile(join(root, 'browser-result.json'), JSON.stringify({ date: '2026-09-19', browserVersion: browser.version(), headless: true, modelSha256: createHash('sha256').update(modelBytes).digest('hex'), tolerance: { maxAbs: 1e-3, cosineDistance: 1e-5 }, purpose: '合成输入的模型执行及数值探针；不含检测、裁剪、跟踪、媒体或真实身份质量', results, errors }, null, 2) + '\n');
  assert.equal(errors.length, 0);
  assert(results.every(result => result.status === 'ran' && result.validationPassed), '至少一个后端未通过；保留结果，不替换后端');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
