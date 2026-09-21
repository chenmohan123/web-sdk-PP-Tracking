// 汇总本轮实际记录，固定核心与候选源码身份；不重新运行模型。
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const sourceHash = async path => createHash('sha256').update((await readFile(path, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
const browser = JSON.parse(gunzipSync(await readFile('.tmp/reid-module/browser-result.json.gz')));
const pkg = await read('package.json'), packed = await read('.tmp/package-check.json');
const core = { 'dist/index.js': await hash('dist/index.js'), 'dist/index.cjs': await hash('dist/index.cjs') };
assert.deepEqual(core, {
  'dist/index.js': '8396ef79f22c6afd2690bd6413f2b32b25fd46ec67b9fabca8fcab44c9a82041',
  'dist/index.cjs': 'f9bd94a1a63e97d424891436b974aafc1dff312c6ca8c183eb7ff74953af186b',
});
assert.deepEqual(Object.keys(pkg.exports), ['.']);
assert.deepEqual(Object.keys(await import('../../dist/index.js')).sort(), ['TrackingError', 'createTracker']);
assert(packed.files.every(file => !/reid|onnx|\.wasm$/.test(file)));
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
assert.deepEqual(browser.errors, []);
assert.equal(browser.cache.first.cache.status, 'stored');
assert.equal(browser.cache.second.cache.status, 'hit');
assert.equal(browser.cache.compressed.cache.status, 'stored');
const sdkBrowser = await read('.tmp/browser/report.json');
assert.deepEqual(sdkBrowser.pageErrors, []);
assert.equal(sdkBrowser.checks.length, 12);
const verifyLog = await readFile('.tmp/reid-module/sdk-verify.log', 'utf8');
assert.match(verifyLog, /Tests\s+138 passed \(138\)/);
assert.match(await readFile('reports/2026-09-21-reid-module/fix-1-green.log', 'utf8'), /Tests\s+37 passed \(37\)/);
const code = {};
for (const name of (await readdir('src/reid')).sort()) code[`src/reid/${name}`] = await sourceHash(`src/reid/${name}`);
for (const path of ['tests/reid-browser.mjs', 'tests/reid-lifecycle.test.ts', 'tests/reid-preprocess.test.ts', 'scripts/build-reid-candidate.mjs']) code[path] = await sourceHash(path);
const result = {
  testedAt: browser.date, browser: browser.browser, sdkVersion: pkg.version,
  fullVerify: { sourceCommit: '6fc6e5a', unitTests: 138, browserChecks: 12, exitCode: 0 },
  focusedFixVerification: { sourceCommit: '5dcd2d4', lifecycleTests: 37, exitCode: 0, typecheck: '通过', candidateBuild: '通过' },
  runs: browser.runs.map(run => ({
    backend: run.backend, adapter: run.adapter, fixtures: run.rows.length,
    maxAbs: Math.max(...run.rows.map(row => row.maxAbs)),
    maxCosineDistance: Math.max(...run.rows.map(row => row.cosineDistance)),
    maxNormError: Math.max(...run.rows.map(row => Math.abs(row.norm - 1))),
    cancelledThenRecovered: run.cancelledThenRecovered, importOnlyNetworkClean: run.importOnlyNetworkClean,
  })),
  sourceScope: '本机截获HTTPS与真实本机TLS压缩资源；未验证真实模型hub',
  cache: { first: browser.cache.first.cache.status, second: browser.cache.second.cache.status, interceptedRequests: browser.cache.remoteRequests, realTlsRequests: browser.cache.compressedRequests },
  package: { bytes: packed.size, sha256: packed.sha256, core, exports: Object.keys(pkg.exports), containsModelOrEngine: false },
  candidateSourceEncoding: 'UTF-8，换行统一LF', candidateSourceSha256: code,
};
await writeFile('.tmp/reid-module/validation.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
