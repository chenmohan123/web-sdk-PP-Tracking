// 从固定 Paddle 参考独立复算归一化向量误差，不执行候选模块。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root = new URL('./', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const lock = await read('evidence.lock.json');
for (const item of lock) {
  const bytes = await readFile(new URL(item.path, root));
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
}
const reference = JSON.parse(gunzipSync(await readFile(new URL('../2026-09-20-reid-preprocessing/evidence/python-result.json.gz', root))));
const browser = JSON.parse(gunzipSync(await readFile(new URL('evidence/browser-result.json.gz', root))));
const validation = await read('evidence/validation.json');
for (const [path, sha256] of Object.entries(validation.candidateSourceSha256)) {
  const source = (await readFile(new URL(`../../${path}`, root), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(source).digest('hex'), sha256, path);
}
assert.deepEqual(browser.model, reference.model);
assert.deepEqual(browser.errors, []);
assert.deepEqual(browser.runs.map(run => run.backend), ['wasm', 'webgpu']);
const near = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
for (const run of browser.runs) {
  assert.equal(run.rows.length, 34);
  assert.equal(run.load.runtime.actualBackend, run.backend);
  assert.equal(run.load.runtime.requestedBackend, run.backend);
  assert.equal(run.importOnlyNetworkClean, true);
  assert.equal(run.cancelledThenRecovered, true);
  assert.equal(run.repeatedFrameId, 1);
  if (run.backend === 'webgpu') assert.equal(run.adapter.isFallbackAdapter, false);
  for (let i = 0; i < 34; i++) {
    const row = run.rows[i], fixture = reference.fixtures[i];
    assert.equal(row.id, fixture.id);
    assert.equal(row.name, fixture.name);
    assert.equal(row.equivalentClippedBox, fixture.name === 'clipped');
    assert.equal(row.vector.length, 512);
    assert(row.vector.every(Number.isFinite));
    const norm = Math.hypot(...row.vector), referenceNorm = Math.hypot(...fixture.reference);
    const expected = fixture.reference.map(value => Math.fround(value / referenceNorm));
    const maxAbs = Math.max(...row.vector.map((value, index) => Math.abs(value - expected[index])));
    const cosine = 1 - row.vector.reduce((sum, value, index) => sum + value * expected[index], 0) / norm / Math.hypot(...expected);
    near(norm, row.norm); near(maxAbs, row.maxAbs); near(cosine, row.cosineDistance);
    assert(Math.abs(norm - 1) < 1e-6 && maxAbs < 1e-3 && cosine < 1e-5);
  }
}
assert.equal(browser.cache.remoteRequests, 2);
assert.equal(browser.cache.compressedRequests, 1);
assert(browser.cache.compressedTransferBytes < browser.model.bytes);
assert.equal(browser.cache.compressed.cache.status, 'stored');
assert.equal(browser.cache.first.cache.status, 'stored');
assert.equal(browser.cache.second.cache.status, 'hit');
assert.equal(browser.cache.corruptCode, 'INTEGRITY_FAILED');
assert.equal(browser.cache.remoteError, 'INTEGRITY_FAILED');
assert.equal(browser.cache.unrelatedPreserved, true);
assert.equal(browser.cache.initial.bytes, 0);
assert.equal(browser.cache.populated.bytes, reference.model.bytes);
assert.equal(browser.cache.populated.entries, 1);
assert.equal(browser.cache.cleared.bytes, 0);
console.log(JSON.stringify({ evidenceFiles: lock.length, backends: 2, fixturesEach: 34, normalizedVectors: '复算通过', cache: '受控下载与浏览器缓存记录通过' }));
