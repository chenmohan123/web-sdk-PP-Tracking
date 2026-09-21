// 独立复算固定向量、来源及包身份；不重新生成可信锁、不访问网络。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lock = await json('evidence.lock.json');
for (const row of lock) { const bytes = await readFile(new URL(row.path, root)); assert.equal(bytes.length, row.bytes, row.path); assert.equal(sha(bytes), row.sha256, row.path); }
const sources = await json('evidence/sources.json');
const model = await json('evidence/model.json');
assert.deepEqual((await json('distribution.json')).sources, sources);
assert.deepEqual(sources.map(row => row.kind), ['modelscope', 'huggingface']);
for (const source of sources) { assert.equal(source.bytes, model.bytes); assert.equal(source.sha256, model.sha256); assert(source.downloadUrl.includes(source.revision)); }
const report = await json('evidence/sources-browser.json');
assert.deepEqual(report.errors, []); assert.equal(report.runs.length, 4);
const fixture = (await json('evidence/reference.json')).fixture;
const referenceNorm = Math.hypot(...fixture.reference);
const expected = fixture.reference.map(value => Math.fround(value / referenceNorm));
const matrix = new Set();
for (const run of report.runs) {
  matrix.add(`${run.kind}/${run.backend}`);
  assert.equal(run.fixtureId, fixture.id); assert.equal(run.vector.length, 512); assert(run.vector.every(Number.isFinite));
  assert.deepEqual(run.loaded.source, sources.find(source => source.kind === run.kind));
  assert.equal(run.loaded.runtime.actualBackend, run.backend); assert.equal(run.loaded.runtime.requestedBackend, run.backend);
  assert.equal(run.loaded.cache.status, 'stored'); assert.equal(run.rootImportNetworkClean, true); assert.equal(run.anonymousCorsDownload, true);
  if (run.backend === 'webgpu') assert.equal(run.adapter.isFallbackAdapter, false);
  const norm = Math.hypot(...run.vector);
  const maxAbs = Math.max(...run.vector.map((value, index) => Math.abs(value - expected[index])));
  const cosine = 1 - run.vector.reduce((sum, value, index) => sum + value * expected[index], 0) / norm / Math.hypot(...expected);
  assert(Math.abs(norm - 1) < 1e-6 && maxAbs < 1e-3 && cosine < 1e-5);
  assert(Math.abs(maxAbs - run.maxAbs) < 1e-12 && Math.abs(cosine - run.cosineDistance) < 1e-12);
}
assert.deepEqual([...matrix].sort(), ['huggingface/wasm', 'huggingface/webgpu', 'modelscope/wasm', 'modelscope/webgpu']);
const demo = await json('evidence/demo-browser.json');
assert.deepEqual(demo.errors, []); assert.equal(demo.runs.length, 2); assert(demo.checks.length >= 5);
assert.deepEqual(demo.runs.map(run => [run.source, run.backend, run.trackId]), [['modelscope', 'wasm', 1], ['huggingface', 'webgpu', 1]]);
const cacheUi = await json('evidence/final-fix-cache-ui.json');
assert.deepEqual(cacheUi.errors, []); assert.equal(cacheUi.checks.length, 4);
const pkg = await json('evidence/package-check.json');
assert(pkg.files.includes('dist/reid/index.js') && pkg.files.includes('dist/reid/index.cjs'));
assert(!pkg.files.some(path => /\.(onnx|wasm|png|jpg|env)$/.test(path)));
if (process.argv.includes('--current')) {
  const identity = await json('evidence/identity.json');
  for (const [path, expected] of Object.entries(identity.sourceSha256)) assert.equal(sha((await readFile(new URL(`../../${path}`, root), 'utf8')).replace(/\r\n/g, '\n')), expected, path);
  for (const [path, expected] of Object.entries(identity.distSha256)) assert.equal(sha(await readFile(new URL(`../../${path}`, root))), expected, path);
  const bytes = await readFile(new URL(`../../.tmp/${pkg.filename}`, root));
  assert.equal(bytes.length, pkg.size); assert.equal(sha(bytes), pkg.sha256); assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, pkg.integrity);
}
console.log(JSON.stringify({ evidenceFiles: lock.length, vectors: 4, sources: 2, demoBackends: 2, currentIdentity: process.argv.includes('--current'), result: '通过' }));
