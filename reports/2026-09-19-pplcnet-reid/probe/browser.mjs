// 一次性 PPLCNet 数值与成本探针；不属于 SDK 或 Demo。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, extname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const work = resolve(process.argv[2] ?? '.tmp/pplcnet-reid');
const ortDist = process.env.TRACKING_REID_ORT_DIST ?? 'F:/git/00_chenmohan/github/web-sdk-PP-Detection/node_modules/.pnpm/onnxruntime-web@1.27.0/node_modules/onnxruntime-web/dist';
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><meta charset="utf-8"><title>PPLCNet 本地研究探针</title><script src="/ort/ort.all.min.js"></script>');
      return;
    }
    const base = path.startsWith('/ort/') ? ortDist : path.startsWith('/assets/') ? join(work, 'assets') : null;
    assert(base && path.split('/').length === 3);
    const file = join(base, basename(path));
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.writeHead(404); res.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [], errors = [];
try {
  browser = await chromium.launch({ headless: true, channel: 'chromium' });
  for (const backend of ['wasm', 'webgpu']) {
    const page = await browser.newPage();
    const messages = [];
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) messages.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(async backend => {
      const compare = (a, b) => {
        if (a.length !== 512 || b.length !== 512) throw new Error('输出长度错误');
        let maxAbs = 0, dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
          if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('非有限输出');
          maxAbs = Math.max(maxAbs, Math.abs(a[i] - b[i]));
          dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2;
        }
        if (!normA || !normB) throw new Error('零范数输出');
        const cosineDistance = 1 - dot / Math.sqrt(normA * normB);
        return { maxAbs, cosineDistance, outputNorm: Math.sqrt(normB), passed: maxAbs < 1e-3 && cosineDistance < 1e-5 };
      };
      const stats = rawMs => {
        const sorted = [...rawMs].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return { medianMs: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], rawMs };
      };
      const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      const adapter = await navigator.gpu?.requestAdapter();
      const adapterInfo = adapter ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description, isFallbackAdapter: adapter.info.isFallbackAdapter } : null;
      ort.env.wasm.wasmPaths = '/ort/';
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const fixtures = await (await fetch('/assets/fixtures.json')).json();
      const tensors = [];
      for (const fixture of fixtures) {
        const bytes = await (await fetch(`/assets/${fixture.input.path}`)).arrayBuffer();
        if (await digest(bytes) !== fixture.input.sha256) throw new Error('输入哈希不符');
        tensors.push(new ort.Tensor('float32', new Float32Array(bytes), [1, 3, 192, 64]));
      }
      const loadStart = performance.now();
      const model = await (await fetch('/assets/pplcnet-fp32.onnx')).arrayBuffer();
      const localFetchMs = performance.now() - loadStart;
      const modelSha256 = await digest(model);
      let session;
      const validation = [];
      const start = performance.now();
      try {
        if (backend === 'webgpu' && (!adapter || adapterInfo.isFallbackAdapter)) throw new Error('没有可用的硬件 WebGPU 适配器');
        session = await ort.InferenceSession.create(model, { executionProviders: [backend], graphOptimizationLevel: 'basic', ...(backend === 'webgpu' ? { extra: { session: { disable_cpu_ep_fallback: '1' } } } : {}) });
        const sessionMs = performance.now() - start;
        // 从 ORT 实际使用的 GPUDevice 回读，避免把能力探测当作运行后端证明。
        const actualInfo = backend === 'webgpu' ? (await ort.env.webgpu.device).adapterInfo : null;
        const runtimeAdapterInfo = actualInfo ? { vendor: actualInfo.vendor, architecture: actualInfo.architecture, device: actualInfo.device, description: actualInfo.description, isFallbackAdapter: actualInfo.isFallbackAdapter } : null;
        if (backend === 'webgpu' && (!runtimeAdapterInfo || runtimeAdapterInfo.isFallbackAdapter)) throw new Error('无法确认 ORT 实际使用硬件 GPU');
        const run = async tensor => {
          const output = await session.run({ crops: tensor });
          const result = output[session.outputNames[0]];
          if (result.dims.join(',') !== '1,512') throw new Error('输出形状错误');
          // 明确访问 CPU 数据，包含 GPU 回读，并及时释放输出。
          const data = Array.from(result.data);
          for (const tensor of Object.values(output)) tensor.dispose();
          return data;
        };
        const firstStart = performance.now();
        const first = await run(tensors[0]);
        const firstInferenceMs = performance.now() - firstStart;
        for (let i = 0; i < fixtures.length; i++) {
          const output = i === 0 ? first : await run(tensors[i]);
          validation.push({ id: fixtures[i].id, name: fixtures[i].name, ...compare(fixtures[i].reference, output), output });
        }
        // 成本使用真实裁剪；不把黑白边界输入作为性能样本。
        const real = tensors.slice(8);
        for (let i = 0; i < 5; i++) await run(real[i % real.length]);
        const times = [];
        for (let i = 0; i < 30; i++) {
          const begin = performance.now();
          await run(real[i % real.length]);
          times.push(performance.now() - begin);
        }
        const serialCrops = [];
        for (const count of [8, 16]) {
          const times = [];
          for (let repeat = 0; repeat < 5; repeat++) {
            const begin = performance.now();
            for (let i = 0; i < count; i++) await run(real[i % real.length]);
            times.push(performance.now() - begin);
          }
          serialCrops.push({ crops: count, iterations: 5, ...stats(times) });
        }
        return { backend, status: 'ran', userAgent: navigator.userAgent, adapterInfo, runtimeAdapterInfo, crossOriginIsolated, modelSha256,
          ortVersion: ort.env.versions, graphOptimizationLevel: 'basic', wasmThreads: 1, disableCpuEpFallback: backend === 'webgpu',
          localFetchMs, sessionMs, firstInferenceMs, validation, warm: { warmup: 5, iterations: 30, ...stats(times) }, serialCrops };
      } catch (error) { return { backend, status: 'failed', modelSha256, adapterInfo, validation, error: String(error) }; }
      finally { await session?.release(); for (const tensor of tensors) tensor.dispose(); }
    }, backend);
    result.consoleMessages = messages;
    result.validationPassed = result.status === 'ran' && result.validation.every(x => x.passed);
    results.push(result);
    console.log(JSON.stringify({ backend, status: result.status, validationPassed: result.validationPassed, maxAbs: Math.max(...result.validation.map(x => x.maxAbs)), warmMedianMs: result.warm?.medianMs, error: result.error }));
    await page.close();
  }
  const model = await readFile(join(work, 'assets/pplcnet-fp32.onnx'));
  const report = { date: '2026-09-19', browserVersion: browser.version(), headless: true,
    modelSha256: createHash('sha256').update(model).digest('hex'), tolerance: { maxAbs: 1e-3, cosineDistance: 1e-5 }, results, errors };
  await writeFile(join(work, 'browser-result.json.gz'), gzipSync(JSON.stringify(report)));
  assert.equal(errors.length, 0);
  assert(results.every(x => x.validationPassed && x.modelSha256 === report.modelSha256), '至少一个后端未通过；原样保留失败');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
