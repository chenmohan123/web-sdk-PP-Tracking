// 用真实缓存和可控响应顺序验证生产页面，不下载模型或加载 ORT。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ configFile: 'demo/vite.config.ts', preview: { host: '127.0.0.1', port: 4208, strictPort: true } });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:4208/');
  await page.locator('#input-mode').selectOption('image');
  const refresh = page.getByRole('button', { name: '刷新用量', exact: true });
  await refresh.waitFor();
  await page.evaluate(async () => {
    const cache = await caches.open('web-sdk-pp-tracking-reid-ui-test');
    const key = new URL('/ui-test-bytes', location.href).href;
    const gates = [];
    window.cacheTest = {
      gates, holdKeys: false, holdMatch: false,
      put: bytes => cache.put(key, new Response(new Uint8Array(bytes))),
      release: index => gates[index](),
    };
    const keys = CacheStorage.prototype.keys;
    CacheStorage.prototype.keys = async function () {
      const result = await keys.call(this);
      if (window.cacheTest.holdKeys) await new Promise(resolve => gates.push(resolve));
      return result;
    };
    const match = Cache.prototype.match;
    Cache.prototype.match = async function (...args) {
      const response = await match.apply(this, args);
      if (window.cacheTest.holdMatch) {
        window.cacheTest.holdMatch = false;
        await new Promise(resolve => gates.push(resolve));
      }
      return response;
    };
    await window.cacheTest.put(1048576);
    window.cacheTest.holdKeys = true;
  });
  const gates = count => page.waitForFunction(count => window.cacheTest.gates.length === count, count);
  const release = index => page.evaluate(index => window.cacheTest.release(index), index);
  // 旧估算先结束时，新估算仍挂起，不能提前恢复清理按钮。
  await refresh.click(); await gates(1);
  await page.getByTestId('reid-reset').click(); await gates(2);
  await release(0);
  // 等待真实异步缓存读取及 React 提交，不用完成顺序相同的同步桩。
  await page.waitForTimeout(150);
  assert.equal(await refresh.isDisabled(), true, '旧估算不得清除新估算的忙碌状态');
  await page.evaluate(() => { window.cacheTest.holdKeys = false; });
  await release(1);
  await page.waitForFunction(() => !document.querySelector('.reid-workspace button.compact').disabled);
  const usage = () => refresh.locator('..').textContent();
  assert.match(await usage(), /1\.00 MiB/);

  // 捕获旧的一 MiB 响应，切源后的新估算必须持续显示二 MiB。
  await page.evaluate(() => { window.cacheTest.holdMatch = true; });
  await refresh.click(); await gates(3);
  await page.evaluate(() => window.cacheTest.put(2097152));
  await page.locator('#reid-source').selectOption('huggingface');
  await page.waitForFunction(() => document.querySelector('.reid-workspace button.compact').parentElement.textContent.includes('2.00 MiB'));
  await release(2);
  await page.waitForTimeout(150);
  assert.match(await usage(), /2\.00 MiB/, '迟到旧响应不得覆盖新用量');

  // 另一个旧响应在清理后才返回，不能把已清零用量恢复。
  await page.evaluate(() => { window.cacheTest.holdMatch = true; });
  await refresh.click(); await gates(4);
  await page.getByTestId('reid-reset').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid=reid-clear]').disabled);
  await page.getByTestId('reid-clear').click();
  await page.waitForFunction(() => document.querySelector('.reid-workspace button.compact').parentElement.textContent.includes('0.00 MiB'));
  await release(3);
  await page.waitForTimeout(150);
  assert.match(await usage(), /0\.00 MiB/, '清理后不得回写旧用量');

  // 卸载后旧响应不能污染重新挂载的工作台。
  await page.evaluate(() => { window.cacheTest.holdKeys = true; });
  await refresh.click(); await gates(5);
  await page.locator('#input-mode').selectOption('boxes');
  await page.evaluate(() => { window.cacheTest.holdKeys = false; });
  await page.locator('#input-mode').selectOption('image');
  await refresh.waitFor();
  await release(4);
  await page.waitForTimeout(150);
  assert.match(await usage(), /模型缓存: —/);
  assert.equal(await refresh.isDisabled(), false);
  assert.deepEqual(errors, []);
  await mkdir('.tmp/reid-distribution', { recursive: true });
  await writeFile('.tmp/reid-distribution/final-fix-cache-ui.json', JSON.stringify({
    testedAt: new Date().toISOString(), browser: browser.version(),
    checks: ['旧估算不解锁新请求', '迟到旧响应不覆盖新用量', '清理后旧响应不能恢复缓存用量', '卸载后旧响应不污染重新挂载的工作台'], errors,
  }, null, 2) + '\n');
  console.log('通过：旧估算不解锁新请求、不覆盖新用量，清理与卸载后迟到响应无效；浏览器错误 0。');
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
