import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

await mkdir('.tmp/motion', { recursive: true });
const server = await preview({ configFile: 'demo/vite.config.ts', preview: { host: '127.0.0.1', port: 4207, strictPort: true } });
let browser;
const checks = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const click = name => page.getByRole('button', { name, exact: true }).click();
  await page.goto('http://127.0.0.1:4207/motion.html');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.equal(await page.locator('#motion-algorithm option').count(), 3);
  assert.match(await page.locator('.runtime-chip').textContent(), /CPU.*JavaScript.*Main/);
  assert.match(await page.locator('.experiment-note').textContent(), /不会自动接入默认跟踪/);
  await click('运行全部');
  await page.waitForFunction(() => document.querySelectorAll('[data-motion-row][data-status]').length === 3);
  assert.equal(await page.locator('[data-motion-row][data-status="estimated"]').count(), 3);
  assert.equal(await page.locator('[data-testid="motion-failure"]').count(), 0);
  const downloadPromise = page.waitForEvent('download');
  await click('导出 JSON');
  const download = await downloadPromise;
  const report = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.results.length, 3);
  checks.push('合成帧三算法运行、状态回执与 JSON 导出');
  await page.getByTestId('language').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.match(await page.locator('.experiment-note').textContent(), /not automatically connected/);
  await page.getByTestId('language').click();
  await click('重置');
  assert.equal(await page.locator('[data-motion-row][data-status]').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: '.tmp/motion/motion-390.png', fullPage: true });
  checks.push('中英文切换、状态复位和390px无横向溢出');
  await writeFile('.tmp/motion/browser-report.json', JSON.stringify({ testedAt: new Date().toISOString(), browser: browser.version(), checks }, null, 2) + '\n');
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
