import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const output = '.tmp/botsort-integration/demo';
await mkdir(output, { recursive: true });
const server = await preview({ configFile: 'demo/vite.config.ts', preview: { host: '127.0.0.1', port: 4206, strictPort: true } });
let browser;
const checks = [], errors = [], requests = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const ready = () => page.waitForFunction(() => !document.querySelector('#algorithm').disabled);
  const download = async name => {
    const event = page.waitForEvent('download'); await click(name);
    return JSON.parse(await readFile(await (await event).path(), 'utf8'));
  };
  const upload = async value => {
    await page.getByTestId('import').setInputFiles({ name: 'motion.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    await ready();
  };
  const algorithm = async value => { await page.locator('#algorithm').selectOption(value); await ready(); assert.equal(await page.locator('#algorithm').inputValue(), value); };
  await page.goto('http://127.0.0.1:4206');
  assert.equal(await page.locator('#algorithm').inputValue(), 'bytetrack');
  assert.match(await page.locator('.brand-note').textContent(), /0\.2\.0-rc\.2/);
  assert.equal(await page.locator('#algorithm option').count(), 4);
  for (const value of ['ocsort', 'deepsort', 'botsort']) { await algorithm(value); await click('单步'); assert.equal((await download('导出本轮结果')).results[0].algorithm, value); }
  await page.locator('#sample').selectOption('translation'); await ready();
  await click('播放');
  await page.waitForFunction(() => document.querySelector('[data-testid="frame"]').textContent.includes('40/40'));
  await page.waitForFunction(() => document.querySelector('.status').dataset.state !== 'running');
  const completed = await download('导出本轮结果');
  assert.equal(completed.results.length, 40);
  assert(completed.results.every(result => result.algorithm === 'botsort'));
  assert.equal(completed.results[0].motion.status, 'initial');
  assert(completed.results.slice(1).every(result => result.motion.status === 'estimated' && result.motion.applied));
  assert.match(await page.getByTestId('motion-receipt').textContent(), /estimated.*已补偿.*38 → 39/);
  checks.push('默认 ByteTrack；四算法真实切换；BoT-SORT 平移完整播放40帧及运动回执');

  await page.locator('.parameters summary').click();
  await page.getByTestId('minHits').fill('1'); await click('应用并重新开始'); await ready();
  await click('单步');
  await page.getByTestId('minHits').fill('3');
  const input = await download('导出输入序列');
  assert.equal(input.schemaVersion, 2); assert.equal(input.options.minHits, 1);
  assert.equal(input.algorithm, 'botsort'); assert.equal(input.frames[1].motion.matrix[2], 8);
  Object.assign(input.options, { matchIouThreshold: 0.85, lowMatchIouThreshold: 0.7, maxTracks: 1, maxDetections: 75, largeGapMs: 4000 });
  await algorithm('bytetrack'); await upload(input);
  assert.equal(await page.locator('#algorithm').inputValue(), 'botsort');
  assert.equal(await page.getByTestId('minHits').inputValue(), '1');
  await click('应用并重新开始'); await ready();
  assert.deepEqual((await download('导出输入序列')).options, input.options);
  await click('单步');
  const roundtrip = await download('导出本轮结果');
  assert.deepEqual(roundtrip.frames, input.frames); assert.deepEqual(roundtrip.options, input.options);
  checks.push('版本2输入保留应用参数与运动；跨算法导入恢复算法和参数，未应用草稿不污染导出');

  const invalidCases = [
    value => { delete value.frames.at(-1).motion; },
    value => { value.frames.at(-1).motion.from.frameId = 999; },
    value => { value.frames.at(-1).motion.matrix = [1, 0, 0, 0, -1, 0]; },
    value => { value.frames.at(-1).motion.extra = 1; },
  ];
  for (const mutate of invalidCases) {
    const value = structuredClone(input); mutate(value); await upload(value);
    assert.match(await page.getByRole('alert').textContent(), /INVALID_SEQUENCE/);
    assert.deepEqual((await download('导出本轮结果')).results, roundtrip.results);
  }
  await page.getByTestId('highScoreThreshold').fill('0.01'); await click('应用并重新开始'); await ready();
  assert.match(await page.getByRole('alert').textContent(), /INVALID_OPTIONS/);
  assert.deepEqual((await download('导出本轮结果')).results, roundtrip.results);
  checks.push('缺 motion、非法 from/矩阵/额外字段的末帧及非法参数均保留原结果');

  const unavailable = structuredClone(input);
  unavailable.options.motionFailure = 'identity';
  unavailable.frames[1].motion = { status: 'unavailable', from: { frameId: 0, timestampMs: 0 }, to: { frameId: 1, timestampMs: 100 }, reason: 'synthetic-test-unavailable' };
  await upload(unavailable); await click('单步'); await click('单步');
  const fallback = await download('导出本轮结果');
  assert.equal(fallback.results[1].motion.applied, false); assert.equal(fallback.results[1].motion.status, 'unavailable');
  await page.getByTestId('motion-failure').selectOption('error'); await click('应用并重新开始'); await ready();
  assert.match(await page.getByRole('alert').textContent(), /INVALID_SEQUENCE/);
  assert.deepEqual((await download('导出本轮结果')).results, fallback.results);
  checks.push('unavailable 显式恒等回退有回执；切换报错策略时验证全部帧并保留原会话');

  await page.locator('#sample').selectOption('translation'); await ready();
  await page.getByTestId('bot-appearance').selectOption('on'); await click('应用并重新开始'); await ready();
  assert.equal(await page.getByRole('alert').count(), 0);
  await click('单步');
  const appearance = await download('导出本轮结果');
  assert.equal(appearance.options.appearance.featureSpace.dimension, 4);
  assert.equal(appearance.frames[0].detections[0].embedding.length, 4);
  await page.getByTestId('bot-appearance').selectOption('off'); await click('应用并重新开始'); await ready();
  await click('单步');
  const noAppearance = await download('导出输入序列');
  assert(!Object.hasOwn(noAppearance.frames[0], 'featureSpaceId'));
  assert(!Object.hasOwn(noAppearance.frames[0].detections[0], 'embedding'));
  await algorithm('deepsort'); await click('单步');
  assert.equal((await download('导出本轮结果')).frames[0].detections[0].embedding.length, 4);
  await algorithm('botsort'); await click('单步');
  checks.push('内置平移样例显式启停外观，切回 DeepSORT 恢复合成向量；默认路径未加载 ReID');

  await page.locator('#seek').focus(); await page.locator('#seek').press('End');
  const sought = await download('导出本轮结果');
  assert.equal(sought.results.length, 40); assert.equal(sought.results[0].generation, 1);
  await page.getByTestId('language').click();
  assert.match(await page.getByTestId('motion-receipt').textContent(), /applied/);
  const english = await download('Export this run'); assert.deepEqual(english.results, sought.results);
  await page.screenshot({ path: `${output}/desktop-en.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 2; i++) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${output}/narrow-${i}.png`, fullPage: true });
    await page.getByTestId('language').click();
  }
  await click('Restart'); await click('Step');
  const reset = await download('Export this run');
  assert.equal(reset.results[0].motion.status, 'initial'); assert.equal(reset.results[0].generation, 2);
  checks.push('键盘 seek 顺序重算、reset 恢复 initial；中英文切换保留结果；390px 中英文无横向溢出');
  assert(!requests.some(url => /onnxruntime|\.onnx(?:$|\?)|ort-wasm/.test(url)));
  assert.deepEqual(errors, []);
  const report = { testedAt: new Date().toISOString(), browser: browser.version(), runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.2', checks, pageErrors: errors, scope: '桌面 Chromium 合成序列；390px 为桌面视口，非移动设备验证。未运行图像运动估计或 ReID 推理。' };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
