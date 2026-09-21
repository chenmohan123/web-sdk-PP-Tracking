// 生产构建的真实模型交互；人工生成图像仅验证接口，不作为人体精度样本。
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.env.TRACKING_REID_DEMO_OUT ?? '.tmp/reid-distribution/demo';
await mkdir(out, { recursive: true });
const sources = JSON.parse(await readFile('models/pplcnet-reid/0.1.0/sources.json', 'utf8'));
const server = await preview({ configFile: 'demo/vite.config.ts', preview: { host: '127.0.0.1', port: 4206, strictPort: true } });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const report = { testedAt: new Date().toISOString(), browser: browser.version(), input: '人工生成128×192不透明PNG及人工框，非质量评测', checks: [], runs: [], errors: [] };
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(180000);
page.on('pageerror', error => report.errors.push(error.message));
const requests = [];
page.on('request', request => requests.push(request.url()));
const frame = () => page.getByTestId('reid-frame').textContent();
const status = () => page.locator('.reid-workspace .status').getAttribute('data-state');
const settled = () => page.waitForFunction(() => ['success', 'error', 'cancelled', 'ready'].includes(document.querySelector('.reid-workspace .status')?.getAttribute('data-state')) && !document.querySelector('[data-testid=reid-run]').disabled);
const run = async expected => {
  console.log(`开始模型帧${expected}`);
  await page.getByTestId('reid-run').click();
  await settled();
  assert.equal(await status(), 'success', await page.locator('[role=alert]').count() ? await page.locator('[role=alert]').textContent() : '未成功');
  assert.match(await frame(), new RegExp(`: ${expected} · ${100 * (expected - 1)} ms`));
  console.log(`模型帧${expected}通过`);
};
const ready = () => page.waitForFunction(() => !document.querySelector('[data-testid=reid-run]').disabled);
const boxes = JSON.stringify([{ box: { x: 40, y: 20, width: 48, height: 160 }, score: 0.9, classId: 0 }]);
try {
  await page.goto('http://127.0.0.1:4206/');
  await page.locator('#input-mode').waitFor();
  assert.equal(await page.locator('#input-mode').inputValue(), 'boxes');
  assert(!requests.some(url => /ort[.-]|\.wasm|\.onnx/.test(url)), '默认框工作台不应请求模型或ORT');
  report.checks.push('默认框/向量模式无模型/ORT请求');
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 192;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 128, 192);
    ctx.fillStyle = '#b77949'; ctx.beginPath(); ctx.arc(64, 35, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2563eb'; ctx.fillRect(43, 50, 42, 65);
    ctx.fillStyle = '#253348'; ctx.fillRect(43, 115, 17, 65); ctx.fillRect(68, 115, 17, 65);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await page.locator('#input-mode').selectOption('image');
  await page.getByTestId('reid-image').waitFor({ state: 'attached' });
  assert(!requests.some(url => /ort[.-]|\.wasm|\.onnx/.test(url)), '仅启用图像工作台不应加载模型');
  assert.equal(await page.locator('#reid-source').inputValue(), 'modelscope');
  assert.equal(await page.locator('#reid-backend').inputValue(), 'wasm');
  assert.equal(await page.locator('.reid-stage image').count(), 0);
  await page.getByTestId('reid-image').setInputFiles({ name: 'generated.png', mimeType: 'image/png', buffer: png });
  await ready(); await page.locator('#reid-boxes').fill(boxes);
  await run(1); await run(2);
  assert.match(await page.locator('.reid-workspace .track-list').textContent(), /#1/);
  await page.locator('[data-sdk-runtime-info] summary').click();
  const runtime = await page.locator('[data-sdk-runtime-info]').textContent();
  assert.match(runtime, /actualBackend=wasm/); assert.match(runtime, /DeepSORT: requestedBackend=cpu · actualBackend=cpu/);
  assert(requests.includes(sources[0].downloadUrl)); assert(requests.some(url => /\.wasm/.test(url)));
  report.runs.push({ source: 'modelscope', backend: 'wasm', frames: 2, trackId: 1, runtime });
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  const beforeLanguage = await frame(); await page.getByTestId('language').click();
  assert.equal((await frame()).split(':')[1], beforeLanguage.split(':')[1]);
  await page.screenshot({ path: `${out}/desktop-en.png`, fullPage: true });
  await page.locator('#reid-boxes').fill('{invalid'); await page.getByTestId('reid-run').click();
  assert.equal(await status(), 'error'); assert.match(await frame(), /: 2 · 100 ms/);
  await page.locator('#reid-boxes').fill(boxes);
  await page.getByTestId('reid-image').setInputFiles({ name: 'same-size.png', mimeType: 'image/png', buffer: png });
  await ready(); await run(3);
  assert.match(await page.locator('.reid-workspace .track-list').textContent(), /#1/);
  report.checks.push('真实MS/WASM生产会话、同尺寸换图保持ID、语言不复位、非法JSON不推进');
  for (const language of ['en', 'zh-CN']) {
    if (await page.locator('html').getAttribute('lang') !== language) await page.getByTestId('language').click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `390px ${language}溢出`);
    await page.screenshot({ path: `${out}/mobile-${language}.png`, fullPage: true });
  }
  report.checks.push('390px中英文无横向溢出（桌面视口）');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('reid-clear').click(); await ready();
  assert.match(await frame(), /: 0 · — ms/);
  let releaseRequest, requestSeen;
  const gate = new Promise(resolve => { releaseRequest = resolve; });
  const seen = new Promise(resolve => { requestSeen = resolve; });
  await page.route(sources[0].downloadUrl, async route => { requestSeen(); await gate; await route.continue().catch(() => {}); });
  await page.getByTestId('reid-run').click(); await seen;
  assert.equal(await page.getByTestId('reid-run').isDisabled(), true);
  await page.getByTestId('reid-cancel').click(); releaseRequest(); await ready();
  assert.equal(await status(), 'cancelled'); assert.match(await frame(), /: 0 · — ms/);
  await page.unroute(sources[0].downloadUrl);
  report.checks.push('模型下载挂起时取消，失败任务不推进，重复开始禁用');
  await page.locator('#reid-source').selectOption('huggingface'); await ready();
  await page.locator('#reid-backend').selectOption('webgpu'); await ready();
  assert.match(await frame(), /: 0 · — ms/);
  await run(1); await run(2);
  const gpuRuntime = await page.locator('[data-sdk-runtime-info]').textContent();
  assert.match(gpuRuntime, /actualBackend=webgpu/); assert(requests.includes(sources[1].downloadUrl));
  assert.match(await page.locator('.reid-workspace .track-list').textContent(), /#1/);
  report.runs.push({ source: 'huggingface', backend: 'webgpu', frames: 2, trackId: 1, runtime: gpuRuntime });
  await page.screenshot({ path: `${out}/desktop-webgpu.png`, fullPage: true });
  await page.getByTestId('reid-reset').click(); await ready(); assert.match(await frame(), /: 0 · — ms/);
  await run(1);
  await page.evaluate(async () => { const unrelated = await caches.open('unrelated-demo-evidence'); await unrelated.put('/unrelated', new Response('keep')); });
  await page.getByTestId('reid-clear').click(); await ready(); assert.match(await frame(), /: 0 · — ms/);
  assert(await page.evaluate(async () => Boolean(await (await caches.open('unrelated-demo-evidence')).match('/unrelated'))));
  await page.evaluate(() => caches.delete('unrelated-demo-evidence'));
  report.checks.push('真实HF/WebGPU生产会话、来源/后端切换复位、复位后可重跑、清理保留其他缓存');
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ checks: report.checks, runs: report.runs.map(({ source, backend, frames }) => ({ source, backend, frames })) }, null, 2));
} catch (error) { report.errors.push(String(error)); throw error; }
finally {
  // 不保存模型托管重定向的临时签名URL。
  report.modelRequests = sources.map(source => ({ kind: source.kind, revision: source.revision, count: requests.filter(url => url === source.downloadUrl).length }));
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
