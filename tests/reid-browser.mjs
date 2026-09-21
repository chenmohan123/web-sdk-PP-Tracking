// 本地候选验收：从归档的 Paddle 向量取参考，不分发模型或原图。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const work = resolve('.tmp/reid-module');
const assets = resolve(process.env.TRACKING_REID_FIXTURES ?? '.tmp/reid-preprocessing-20260920/assets');
const ortDist = resolve(process.env.TRACKING_REID_ORT_DIST ?? 'node_modules/onnxruntime-web/dist');
const reference = JSON.parse(gunzipSync(await readFile('reports/2026-09-20-reid-preprocessing/evidence/python-result.json.gz')));
const model = await readFile(join(assets, 'model.onnx'));
assert.equal(model.length, reference.model.bytes);
assert.equal(createHash('sha256').update(model).digest('hex'), reference.model.sha256);
await mkdir(join(work, 'browser'), { recursive: true });
const output = join(work, 'browser/reid.mjs');
const built = await build({ entryPoints: ['src/reid/index.ts'], outfile: output, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', external: ['onnxruntime-web', 'onnxruntime-web/*'], logLevel: 'silent' }).then(() => true, () => false);
assert.equal(built, true, '候选 ReID 模块须可构建为独立浏览器入口');
const rootBuilt = join(work, 'browser/tracking.mjs');
await build({ entryPoints: ['src/index.ts'], outfile: rootBuilt, bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
const allowed = new Map(reference.fixtures.map(f => [f.rgba.path, f.rgba]));
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><title>ReID 候选本地验收</title><script type="importmap">{"imports":{"onnxruntime-web":"/ort/ort.all.min.mjs","onnxruntime-web/all":"/ort/ort.all.min.mjs","onnxruntime-web/webgpu":"/ort/ort.all.min.mjs","onnxruntime-web/wasm":"/ort/ort.all.min.mjs"}}</script>'); return;
    }
    const name = basename(path);
    let data;
    if (path === '/reid.mjs') data = await readFile(output);
    else if (path === '/tracking.mjs') data = await readFile(rootBuilt);
    else if (path === '/model.onnx') data = model;
    else if (path.startsWith('/ort/') && path.split('/').length === 3) data = await readFile(join(ortDist, name));
    else if (path.startsWith('/assets/') && allowed.has(name) && path.split('/').length === 3) {
      data = await readFile(join(assets, name));
      assert.equal(data.length, allowed.get(name).bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), allowed.get(name).sha256);
    } else throw new Error('未知验收资源');
    res.setHeader('Content-Type', { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm' }[extname(name)] ?? 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end('验收资源不可用'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser, compressedServer;
const report = { date: new Date().toISOString(), model: reference.model, browser: '', runs: [], errors: [] };
try {
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  report.browser = browser.version();
  for (const backend of ['wasm', 'webgpu']) {
    const page = await browser.newPage();
    const requests = [], messages = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => report.errors.push(String(error)));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) messages.push({ type: message.type(), text: message.text() }); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      const { createTracker } = await import('/tracking.mjs');
      const tracker = createTracker();
      const result = tracker.update({ timestampMs: 0, imageSize: { width: 1, height: 1 }, detections: [] });
      if (result.runtime.actualBackend !== 'cpu') throw new Error('根入口实际后端错误');
      tracker.dispose();
      const api = await import('/reid.mjs');
      if (typeof api.createReIdExtractor !== 'function') throw new Error('缺少候选工厂');
      const idle = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', modelBytes: new ArrayBuffer(33704835) });
      await idle.dispose();
    });
    assert(!requests.some(url => /\/ort\/|\.onnx(?:$|\?)/.test(url)), '仅导入和运行根算法不得加载 ORT 或模型');
    const run = await page.evaluate(async ({ backend, fixtures, modelIdentity }) => {
      const api = await import('/reid.mjs');
      const { createTracker } = await import('/tracking.mjs');
      const ort = await import('onnxruntime-web/all');
      ort.env.wasm.wasmPaths = '/ort/';
      const check = (value, message) => { if (!value) throw new Error(message); };
      const reject = async (promise, code) => { try { await promise; } catch (error) { check(error.code === code, `错误码期望 ${code}，实际 ${error.code}`); return; } throw new Error(`未拒绝 ${code}`); };
      const bytes = await (await fetch('/model.onnx')).arrayBuffer();
      const extractor = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend, modelBytes: bytes });
      const progress = [], rows = [], timings = [];
      let load, adapter, firstReal;
      try {
        load = await extractor.load({ onProgress: event => progress.push(event) });
        check(load.runtime.actualBackend === backend && load.runtime.requestedBackend === backend, '加载后端报告错误');
        check(extractor.featureSpace.dimension === 512 && extractor.featureSpace.id.includes(modelIdentity.sha256), '特征空间未绑定模型身份');
        if (backend === 'webgpu') {
          const info = (await ort.env.webgpu.device).adapterInfo;
          adapter = { vendor: info.vendor, architecture: info.architecture, isFallbackAdapter: info.isFallbackAdapter };
          check(adapter.isFallbackAdapter === false, 'GPU不是实际硬件');
        }
        for (const fixture of fixtures) {
          const raw = await (await fetch(`/assets/${fixture.rgba.path}`)).arrayBuffer();
          const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))].map(v => v.toString(16).padStart(2, '0')).join('');
          check(raw.byteLength === fixture.rgba.bytes && sha === fixture.rgba.sha256, '像素身份错误');
          const image = { width: fixture.width, height: fixture.height, data: new Uint8Array(raw) };
          let box = { ...fixture.box };
          if (fixture.name === 'clipped') {
            await reject(extractor.extract({ image, detections: [{ box, score: 0.9, classId: 0 }] }), 'INVALID_INPUT');
            const x = Math.max(0, box.x), y = Math.max(0, box.y);
            box = { x, y, width: Math.min(image.width, box.x + box.width) - x, height: Math.min(image.height, box.y + box.height) - y };
          }
          const input = { image, detections: [{ box, score: 0.9, classId: 0 }] };
          const result = await extractor.extract(input);
          const detection = result.detections[0];
          check(result.detections.length === 1 && ['x', 'y', 'width', 'height'].every(key => detection.box[key] === box[key]) && detection.score === 0.9 && detection.classId === 0, '框与向量绑定不完整');
          check(result.featureSpace.id === extractor.featureSpace.id && result.runtime.actualBackend === backend && result.runtime.executionMode === 'main', '结果身份错误');
          const vector = Array.from(detection.embedding), norm = Math.hypot(...vector), refNorm = Math.hypot(...fixture.reference);
          const expected = fixture.reference.map(v => Math.fround(v / refNorm));
          check(vector.length === 512 && vector.every(Number.isFinite) && Math.abs(norm - 1) < 1e-6, '向量不是有效单位向量');
          const maxAbs = Math.max(...vector.map((v, i) => Math.abs(v - expected[i])));
          const cosineDistance = 1 - vector.reduce((sum, v, i) => sum + v * expected[i], 0) / norm / Math.hypot(...expected);
          check(maxAbs < 1e-3 && cosineDistance < 1e-5, `特征偏差超过门槛 ${fixture.name}`);
          rows.push({ id: fixture.id, name: fixture.name, equivalentClippedBox: fixture.name === 'clipped', maxAbs, cosineDistance, norm, vector });
          timings.push(result.timings);
          if (fixture.real && !firstReal) firstReal = { input, result };
        }
        const tracker = createTracker({ algorithm: 'deepsort', featureSpace: extractor.featureSpace, minHits: 1 });
        const frame = { timestampMs: 0, imageSize: { width: firstReal.input.image.width, height: firstReal.input.image.height }, featureSpaceId: extractor.featureSpace.id, detections: firstReal.result.detections };
        const one = tracker.update(frame);
        const controller = new AbortController();
        const pending = extractor.extract(firstReal.input, { signal: controller.signal });
        controller.abort();
        await reject(pending, 'ABORTED');
        const next = await extractor.extract(firstReal.input);
        const two = tracker.update({ ...frame, timestampMs: 33, detections: next.detections });
        check(one.tracks.length === 1 && two.tracks[0].id === one.tracks[0].id && two.runtime.actualBackend === 'cpu', '重复帧跟踪接口不一致');
        tracker.dispose();
        return { backend, load, adapter, progress, rows, timings, cancelledThenRecovered: true, repeatedFrameId: two.tracks[0].id, ortVersions: ort.env.versions, userAgent: navigator.userAgent };
      } finally { await extractor.dispose(); }
    }, { backend, fixtures: reference.fixtures, modelIdentity: reference.model });
    report.runs.push({ ...run, importOnlyNetworkClean: true, consoleMessages: messages });
    console.log(JSON.stringify({ backend, validated: run.rows.length, maxAbs: Math.max(...run.rows.map(row => row.maxAbs)), cancelledThenRecovered: run.cancelledThenRecovered }));
    await page.close();
  }
  // HTTPS 来源由本进程拦截，使用真实 CacheStorage，绝不请求真实 hub。
  const cachePage = await browser.newPage({ ignoreHTTPSErrors: true });
  let remoteRequests = 0, responseMode = 'valid';
  const sourceUrl = 'https://modelscope.cn/test-only-reid/pplcnet/model.onnx';
  await cachePage.route(sourceUrl, async route => {
    remoteRequests++;
    const body = responseMode === 'valid' ? model : Buffer.alloc(16, 7);
    await route.fulfill({ status: 200, body, headers: { 'content-type': 'application/octet-stream', 'content-length': String(body.length), 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' } });
  });
  cachePage.on('pageerror', error => report.errors.push(String(error)));
  await cachePage.goto(`http://127.0.0.1:${server.address().port}/`);
  const source = { kind: 'modelscope', repository: 'test-only/reid', revision: 'a'.repeat(40), path: 'model.onnx', downloadUrl: sourceUrl, ...reference.model };
  const cacheChecks = await cachePage.evaluate(async source => {
    const api = await import('/reid.mjs');
    const ort = await import('onnxruntime-web/all'); ort.env.wasm.wasmPaths = '/ort/';
    const unrelated = await caches.open('reid-test-unrelated');
    await unrelated.put('/unrelated', new Response('retain'));
    await api.clearReIdCache();
    const initial = await api.estimateReIdCache();
    const extractor = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    let first;
    try { first = await extractor.load(); } finally { await extractor.dispose(); }
    const populated = await api.estimateReIdCache();
    const cached = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    let second;
    try { second = await cached.load(); } finally { await cached.dispose(); }
    const entries = [];
    for (const name of await caches.keys()) {
      if (name === 'reid-test-unrelated') continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) entries.push({ cache: name, url: request.url });
    }
    if (entries.length !== 1) throw new Error('模型缓存条目应为一份');
    const cache = await caches.open(entries[0].cache);
    await cache.put(entries[0].url, new Response(new Uint8Array([1, 2, 3])));
    const corrupt = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    let corruptCode;
    try { await corrupt.load(); } catch (error) { corruptCode = error.code; } finally { await corrupt.dispose(); }
    if (corruptCode !== 'INTEGRITY_FAILED') throw new Error(`错误缓存未拒绝 ${corruptCode}`);
    await api.clearReIdCache();
    const cleared = await api.estimateReIdCache();
    const preserved = await (await unrelated.match('/unrelated'))?.text();
    if (initial.bytes !== 0 || populated.bytes !== source.bytes || populated.entries !== 1 || cleared.bytes !== 0 || preserved !== 'retain') throw new Error('缓存大小或隔离范围错误');
    await caches.delete('reid-test-unrelated');
    return { initial, first, populated, second, corruptCode, cleared, unrelatedPreserved: true };
  }, source);
  assert.equal(remoteRequests, 1, '缓存命中和错误缓存不应静默重新下载');
  responseMode = 'short';
  const remoteError = await cachePage.evaluate(async source => {
    const { createReIdExtractor } = await import('/reid.mjs');
    const instance = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    try { await instance.load(); return null; } catch (error) { return error.code; } finally { await instance.dispose(); }
  }, source);
  assert.equal(remoteError, 'INTEGRITY_FAILED');
  assert.equal(remoteRequests, 2, '显式来源失败不应重试其他来源');
  // route.fulfill 不执行浏览器网络解压，因此此项必须使用真实本机 TLS 响应。
  const compressedBody = gzipSync(model);
  let compressedRequests = 0;
  compressedServer = createHttpsServer({
    key: await readFile(process.env.TRACKING_REID_TLS_KEY ?? join(work, 'localhost-test.key')),
    cert: await readFile(process.env.TRACKING_REID_TLS_CERT ?? join(work, 'localhost-test.crt')),
  }, (req, res) => {
    compressedRequests++;
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': compressedBody.length, 'content-encoding': 'gzip', 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' });
    res.end(compressedBody);
  });
  await new Promise(resolve => compressedServer.listen(0, '127.0.0.1', resolve));
  const compressed = await cachePage.evaluate(async source => {
    const api = await import('/reid.mjs');
    const instance = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    try { return await instance.load(); } finally { await instance.dispose(); await api.clearReIdCache(); }
  }, { ...source, downloadUrl: `https://127.0.0.1:${compressedServer.address().port}/model.onnx` });
  assert.equal(compressed.cache.status, 'stored', '真实 gzip 传输经浏览器解压后应通过固定模型 SHA');
  assert.equal(remoteRequests, 2);
  assert.equal(compressedRequests, 1);
  report.cache = { scope: '本机 HTTPS 路由拦截、真实本机 TLS gzip 与 CacheStorage，未访问实际模型源', ...cacheChecks, remoteError, compressed, compressedTransferBytes: compressedBody.length, compressedRequests, remoteRequests };
  await cachePage.close();
  assert.equal(report.runs.length, 2);
  assert.equal(report.errors.length, 0);
} catch (error) { report.errors.push(String(error)); throw error; }
finally {
  await writeFile(join(work, 'browser-result.json.gz'), gzipSync(JSON.stringify(report)));
  await browser?.close();
  if (compressedServer?.listening) await new Promise(resolve => compressedServer.close(resolve));
  await new Promise(resolve => server.close(resolve));
}
