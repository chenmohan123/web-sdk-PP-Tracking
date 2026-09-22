// 研究证据只读复核；不生成/覆盖轨迹，也不运行模型或重新评分。
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const report = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(report, '../..');
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const hash = async file => {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest('hex');
};
const lock = await read(path.join(report, 'evidence.lock.json'));
for (const [relative, pin] of Object.entries(lock.files)) {
  const file = path.resolve(report, relative);
  assert(file.startsWith(report + path.sep), '归档路径必须位于报告内');
  assert.equal((await stat(file)).size, pin.bytes, relative);
  assert.equal(await hash(file), pin.sha256, relative);
}
const run = await read(path.join(report, 'run-summary.json'));
const motion = await read(path.join(report, 'motion-summary.json'));
const metrics = await read(path.join(report, 'metrics.json'));
const provenance = await read(path.join(report, 'provenance.json'));
const browser = await read(path.join(report, 'browser-result.json'));
const protocol = await read(path.join(report, 'protocol.json'));
const sources = await read(path.join(report, 'sources.lock.json'));
assert.equal(run.complete, true);
assert.equal(run.hashes.probe, await hash(path.join(report, 'probe/probe.js')));
assert.equal(run.hashes.protocol, await hash(path.join(report, 'protocol.json')));
assert.equal(motion.protocolSha256, run.hashes.protocol);
assert.equal(protocol.baselineCommit, provenance.baselineCommit);
assert.deepEqual(Object.keys(run.configurations), ['base', 'cmc', 'cmc-reid']);
assert.equal(Object.keys(run.sequences).length, 7);
assert.equal(Object.values(run.sequences).reduce((sum, row) => sum + row.frames, 0), 5316);
assert.equal(Object.values(run.sequences).reduce((sum, row) => sum + row.detections, 0), 67639);
assert.equal(metrics.scorer.commit, '12c8791b303e0a0b50f753af204249e622d0281a');
assert.deepEqual(browser.errors, []);
assert.equal(browser.frames, run.sequences[browser.sequence].frames);
const sameKeys = (a, b) => assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
sameKeys(run.sequences, motion.sequences);
sameKeys(run.sequences, provenance.inputHashes);
sameKeys(browser.rows, run.configurations);
const statuses = {};
for (const [name, row] of Object.entries(run.sequences)) {
  assert.equal(row.motionSha256, motion.sequences[name].sha256);
  assert.equal(row.frames, motion.sequences[name].frames);
  assert.equal(Object.values(motion.sequences[name].statuses).reduce((a, b) => a + b, 0), row.frames);
  for (const [key, count] of Object.entries(motion.sequences[name].statuses)) statuses[key] = (statuses[key] ?? 0) + count;
  const old = (await read(path.join(repo, 'reports/2026-09-21-mot-reid/raw/sequences', name + '-summary.json'))).sequences[name];
  assert.equal(row.featureSha256, old.featureSha256);
  assert.equal(row.results.base.motSha256, old.node.bytetrack[0].motSha256);
  for (const result of Object.values(row.results)) assert.equal(result.capacityDrops, 0);
}
assert.deepEqual(statuses, { estimated: 5270, first_frame: 7, low_support: 39 });
assert.deepEqual(statuses, provenance.aggregate.motionStatus);
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
for (const config of Object.keys(run.configurations)) {
  sameKeys(metrics[config].sequences, run.sequences);
  const combined = metrics[config].combined;
  for (const key of ['IDSW', 'FP', 'FN', 'TP', 'GT', 'Frag', 'IDTP', 'IDFP', 'IDFN']) {
    assert.equal(combined[key], Object.values(metrics[config].sequences).reduce((sum, row) => sum + row[key], 0));
  }
  for (const row of [...Object.values(metrics[config].sequences), combined]) {
    close(row.IDF1, 2 * row.IDTP / (2 * row.IDTP + row.IDFP + row.IDFN));
    close(row.MOTA, 1 - (row.FP + row.FN + row.IDSW) / row.GT);
  }
  for (const key of ['motSha256', 'nonTimingSha256']) assert.equal(browser.rows[config][key], run.sequences[browser.sequence].results[config][key]);
  close(provenance.aggregate.nodeTotalsMs[config], Object.values(run.sequences).reduce((sum, row) => sum + row.results[config].totalMs, 0));
}
assert.equal(sources.files.length, 9);
for (const source of sources.files) {
  assert(new URL(source.url).protocol === 'https:');
  assert(/^[a-f0-9]{64}$/.test(source.sha256));
  assert(source.bytes > 0);
}
// 路径锁引用的公共辅助代码与归档证据必须仍与评测时一致。
for (const [file, expected] of Object.entries(provenance.dependencies)) assert.equal(await hash(path.join(repo, file)), expected, file);
for (const [file, expected] of Object.entries(await read(path.join(report, 'baseline-hashes.json')))) assert.equal(await hash(path.join(repo, 'src', file)), expected, file);
if (process.argv.includes('--local')) {
  const work = path.join(repo, '.tmp/botsort-feasibility');
  for (const [name, row] of Object.entries(run.sequences)) {
    assert.equal(await hash(path.join(work, 'motion', name + '.jsonl')), row.motionSha256);
    for (const config of Object.keys(run.configurations)) assert.equal(await hash(path.join(work, 'run-2/trackers', config, 'data', name + '.txt')), row.results[config].motSha256);
    for (const [relative, pin] of Object.entries(provenance.inputHashes[name])) {
      const file = path.join(repo, '.tmp/mot17-ocsort-c036be8/input', name, relative);
      assert.equal((await stat(file)).size, pin.bytes);
      assert.equal(await hash(file), pin.sha256);
    }
    const id = name.split('-')[1];
    assert.equal(await hash(path.join(repo, `.tmp/mot17-reid-official-${id}-0194ea5/features`, name + '.jsonl')), row.featureSha256);
  }
  for (const source of sources.files) {
    const file = path.join(work, 'sources', source.path);
    assert.equal((await stat(file)).size, source.bytes);
    assert.equal(await hash(file), source.sha256);
  }
}
console.log(JSON.stringify({ status: '通过', files: Object.keys(lock.files).length, sequences: 7, frames: 5316, configurations: 3, browserFrames: browser.frames, local: process.argv.includes('--local') }));
