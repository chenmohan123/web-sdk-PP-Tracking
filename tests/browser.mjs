import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

await mkdir('.tmp/browser', { recursive: true });
const demo = await preview({ configFile: 'demo/vite.config.ts', preview: { host: '127.0.0.1', port: 4198, strictPort: true } });
const vanilla = await preview({ configFile: false, root: 'examples/vanilla', preview: { host: '127.0.0.1', port: 4197, strictPort: true } });
let browser;
const checks = [], errors = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const frame = () => page.getByTestId('frame').textContent();
  const waitFrame = n => page.waitForFunction(n => document.querySelector('[data-testid="frame"]').textContent.includes(`${n}/`), n);
  const upload = async value => {
    await page.getByTestId('import').setInputFiles({ name: 'sequence.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    await page.waitForFunction(() => document.querySelector('input[type=file]').disabled === false);
  };
  const exportResult = async () => {
    const downloadPromise = page.waitForEvent('download');
    await click('导出本轮结果');
    const download = await downloadPromise;
    const path = await download.path();
    return JSON.parse(await readFile(path, 'utf8'));
  };
  await page.goto('http://127.0.0.1:4198');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.equal(await page.locator('.stage rect').count(), 2);
  assert.match(await frame(), /0\/40/);
  await page.screenshot({ path: '.tmp/browser/desktop.png', fullPage: true });
  await click('单步'); await waitFrame(1); await click('单步');
  assert.equal(await page.locator('[data-track-state=tracked]').count(), 1);
  const beforeLanguage = await exportResult();
  await page.getByTestId('language').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.match(await frame(), /2\/40/);
  assert.match(await page.locator('.track').textContent(), /#1/);
  await page.screenshot({ path: '.tmp/browser/english.png', fullPage: true });
  await page.getByTestId('language').click();
  assert.deepEqual((await exportResult()).results, beforeLanguage.results);
  checks.push('中文默认、英文切换不改变帧/ID/结果');

  await click('播放'); await waitFrame(4); await click('暂停');
  const paused = await frame(); await page.waitForTimeout(250); assert.equal(await frame(), paused);
  await click('播放'); await waitFrame(8); await click('暂停');
  await click('重新开始'); assert.match(await frame(), /0\/40/);
  assert.equal(await page.locator('[data-track-state]').count(), 0);
  assert.equal(await page.getByRole('button', { name: '导出本轮结果', exact: true }).isDisabled(), true);
  checks.push('单步、播放、暂停继续、重播清空轨迹和历史');

  for (const sample of ['straight', 'low', 'occlusion', 'crossing']) {
    await page.locator('#sample').selectOption(sample);
    await click('播放'); await waitFrame(40);
    await page.waitForFunction(() => document.querySelector('.status').dataset.state !== 'running');
    assert.equal(await page.getByRole('button', { name: '播放', exact: true }).isDisabled(), true);
    const output = await exportResult();
    assert.equal(output.results.length, 40);
    assert.deepEqual(output.results.map(r => r.timestampMs), Array.from({ length: 40 }, (_, i) => i * 100));
    if (sample === 'low') assert.equal(output.results[8].tracks[0].score, 0.25);
    if (sample === 'occlusion') {
      assert.equal(output.results[14].tracks[0].observed, false);
      assert.equal(output.results[14].tracks[0].score, null);
      assert.equal(output.results[18].tracks[0].id, output.results[10].tracks[0].id);
    }
  }
  checks.push('四场景实际播放到末帧；低分续接和遮挡高分恢复；导出原始时间');
  await page.locator('#sample').selectOption('occlusion');
  await page.locator('#seek').focus();
  for (let i = 0; i < 14; i++) await page.locator('#seek').press('ArrowRight');
  await waitFrame(15);
  assert.equal(await page.locator('[data-track-state=lost] rect').getAttribute('stroke-dasharray'), '8 5');
  const seekResult = await exportResult(); assert.equal(seekResult.processedFrames, 15);
  assert.equal(seekResult.results[0].generation, seekResult.results[14].generation);
  await page.screenshot({ path: '.tmp/browser/occlusion.png', fullPage: true });
  checks.push('真实键盘seek复位顺序重算，lost虚线、空分数');

  const one = { frames: [{ timestampMs: 17, imageSize: { width: 100, height: 100 }, detections: [{ box: { x: 10, y: 10, width: 20, height: 20 }, score: 0.9, classId: 0 }] }] };
  await upload(one); assert.match(await frame(), /0\/1/); await click('单步');
  const single = await exportResult(); assert.equal(single.processedFrames, 1); assert.equal(single.results[0].timestampMs, 17);
  await upload(one); assert.match(await frame(), /0\/1/); await click('单步');
  const unchanged = await exportResult();
  await upload({ frames: [...one.frames, { ...one.frames[0], timestampMs: 16 }] });
  assert.match(await page.getByRole('alert').textContent(), /INVALID_SEQUENCE/);
  assert.deepEqual((await exportResult()).results, unchanged.results);
  await page.getByTestId('import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await page.getByRole('alert').waitFor();
  assert.deepEqual((await exportResult()).results, unchanged.results);
  await page.getByTestId('import').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 32) });
  await page.waitForFunction(() => document.querySelector('[role=alert]').textContent.includes('FILE_TOO_LARGE'));
  assert.deepEqual((await exportResult()).results, unchanged.results);
  checks.push('单帧导入/重复同文件/导出；逆序、坏JSON、超5MiB失败均保留原结果');

  await page.locator('.parameters summary').click();
  await page.getByTestId('highScoreThreshold').fill('0.05');
  await click('应用并重新开始');
  assert.match(await page.getByRole('alert').textContent(), /INVALID_OPTIONS/);
  assert.deepEqual((await exportResult()).results, unchanged.results);
  await page.getByTestId('highScoreThreshold').fill('0.5');
  await page.getByTestId('minHits').fill('1');
  await click('应用并重新开始'); assert.match(await frame(), /0\/1/);
  await click('单步'); assert.equal(await page.locator('[data-track-state=tracked]').count(), 1);
  assert.equal((await exportResult()).options.minHits, 1);
  checks.push('参数错误原子性；合法参数实际生效并清空本轮');
  await upload({ frames: [{ timestampMs: 0, imageSize: { width: 100, height: 100 }, detections: [] }] });
  await click('单步'); assert.equal(await page.locator('[data-track-state]').count(), 0);
  assert.match(await page.locator('.track-list').textContent(), /本帧无活动轨迹/);
  checks.push('空检测序列真实空结果');

  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 2; i++) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByTestId('language').click();
  }
  await page.screenshot({ path: '.tmp/browser/mobile.png', fullPage: true });
  checks.push('390px中英文无横向溢出');

  await page.goto('http://127.0.0.1:4197');
  await page.locator('#step').click(); await page.locator('#step').click();
  const vanillaResult = JSON.parse(await page.locator('#result').textContent());
  assert.equal(vanillaResult.tracks[0].id, 1); assert.equal(vanillaResult.tracks[0].state, 'tracked');
  assert.equal(vanillaResult.runtime.actualBackend, 'cpu');
  await page.locator('#reset').click(); assert.match(await page.locator('#result').textContent(), /Ready/);
  await page.locator('#step').click(); assert.equal(JSON.parse(await page.locator('#result').textContent()).generation, 1);
  await page.screenshot({ path: '.tmp/browser/vanilla.png', fullPage: true });
  checks.push('Vanilla构建包单步/复位/CPU实际结果');
  assert.deepEqual(errors, []);
  const report = { testedAt: new Date().toISOString(), browser: browser.version(), platform: process.platform, runtimeVersion: 'web-sdk-pp-tracking@0.1.0', checks, pageErrors: errors, screenshots: ['desktop', 'english', 'occlusion', 'mobile', 'vanilla'].map(s => resolve(`.tmp/browser/${s}.png`)) };
  await writeFile('.tmp/browser/report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await Promise.all([new Promise(resolve => demo.httpServer.close(resolve)), new Promise(resolve => vanilla.httpServer.close(resolve))]);
}
