import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = '.tmp/deepsort-preview';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4204/');
  const algorithms = await page.locator('#algorithm option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(algorithms, ['bytetrack', 'ocsort', 'deepsort']);
  await page.locator('#algorithm').selectOption('deepsort');
  await page.locator('#sample').selectOption('crossing');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '单步', exact: true }).click();
  assert.equal(await page.locator('[data-track-state=tracked]').count(), 2);
  assert.equal(await page.getByRole('alert').count(), 0);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/narrow.png`, fullPage: true });
  await page.getByTestId('language').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('[data-track-state=tracked]').count(), 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/narrow-en.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const report = { testedAt: new Date().toISOString(), url: page.url(), browser: browser.version(), platform: process.platform, algorithms, confirmedTracks: 2, pageErrors: errors, screenshots: ['desktop.png', 'narrow.png', 'narrow-en.png'], scope: '本地预览第三算法与桌面窄屏布局；不是手机或真实 ReID 评测' };
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
