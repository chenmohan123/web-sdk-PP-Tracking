import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { options, sdkRoot, archiveRoot } from './options.mjs';

// 固定原始证据摘要，不提供“重新封装摘要”命令。变更数据须另建日期化测量。
const hashes = {
  'benchmark.json': '4e979c8a347cbad88e86b3c1de4fa5bb9025609339cbfe61b3b1ad43ab3987b7',
  'independent-api.json': '3f5d5554cece7407a0c45d8a60067dcb9a2cc09ff5e1779c15608ef93e1a5d10',
  'inputs.json': '714aea989ae3d4d4e88288cc74f3db893186353935774db72ebd8897e2ee2ebc',
  'browser.json': '08a0e8892a647f31d4cf8de9abf1e7438a6b245e0332916083562f0b75010ff8',
  'package-check.json': 'c90f5be5384a410d287af50e0d2d8ed1836f817a7eb66263302fe81d237fea4f',
  'task-3-verify.log': '4f40206bd784d277b37729f6c33adc0187c475f6f6af95cac7ffa0314bc1b9ca',
  'provenance/tracking-desktop-benchmark.mjs': 'f5c456223b9afb26af204e1e8a6a100d10dd272ca12d9032b4b3c34b8a17048a',
  'provenance/tracking-independent-check.mjs': '35624fd33853c4b76a956a18a5b4e9f9914c5202ba2f7f1e79bb704ddc05102f',
  'build-inventory.json': '5794aaca3bc68d7970dc3440691f0c4e0e26e40f17891230950ed90d6f476238',
};
const args = options({ sdk: sdkRoot, archive: archiveRoot });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async name => JSON.parse(await fs.readFile(path.join(args.archive, name), 'utf8'));
for (const [name, hash] of Object.entries(hashes)) {
  assert.equal(digest(await fs.readFile(path.join(args.archive, name))), hash, `原始证据已变更：${name}`);
}
const benchmark = await read('benchmark.json');
const api = await read('independent-api.json');
const browser = await read('browser.json');
const inventory = await read('build-inventory.json');
assert.equal(benchmark.commit, inventory.coreCommit);
assert.equal(api.sdkCommit, inventory.coreCommit);
assert.equal(api.inputSha256, hashes['inputs.json']);
assert.equal(api.entrySha256, benchmark.entrySha256);
assert.equal(benchmark.entrySha256, inventory.files['dist/index.js']);
for (const [name, hash] of Object.entries(inventory.files)) {
  assert.equal(digest(await fs.readFile(path.join(args.sdk, name))), hash, `构建已变更：${name}`);
}
// 核心代码和构建入口双重核对；文档归档提交不冒充历史测量提交。
const changed = execFileSync('git', ['-C', args.sdk, 'diff', inventory.coreCommit, '--', 'src', 'scripts/build.mjs'], { encoding: 'utf8' });
assert.equal(changed, '', '核心源码或构建脚本已经偏离测量提交');
assert.equal(benchmark.browser, '151.0.7922.34');
assert.equal(browser.browser, '153.0.8010.12');
assert.equal(browser.checks.length, 9);
assert.deepEqual(browser.pageErrors, []);
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values.length, p50: sorted[Math.floor((sorted.length - 1) * .5)], p95: sorted[Math.ceil((sorted.length - 1) * .95)], min: sorted[0], max: sorted.at(-1) };
};
assert.deepEqual(benchmark.measurements.map(x => x.count), [10, 50, 100]);
for (const m of benchmark.measurements) {
  assert.equal(m.cold.length, 3);
  assert.equal(m.warm.length, 600);
  for (const [i, sample] of m.warm.entries()) {
    assert.equal(sample.repetition, Math.floor(i / 200));
    assert.equal(sample.frame, i % 200 + 1);
  }
  for (const sample of [...m.cold, ...m.warm]) {
    for (const value of Object.values(sample.timings)) assert.ok(Number.isFinite(value) && value >= 0);
  }
  assert.deepEqual(m.summary.cold, summarize(m.cold.map(x => x.totalWithCreationMs)));
  assert.deepEqual(m.summary.warm, summarize(m.warm.map(x => x.timings.totalMs)));
  assert.deepEqual(m.summary.outer, summarize(m.warm.map(x => x.outerMs)));
}
// 新入口与原脚本的浏览器测量函数逐字核对，防止参数化时改变采样口径。
const original = await fs.readFile(path.join(args.archive, 'provenance/tracking-desktop-benchmark.mjs'), 'utf8');
const runnable = await fs.readFile(new URL('./benchmark.mjs', import.meta.url), 'utf8');
const measurement = text => text.replaceAll('\r\n', '\n').split('const result=await page.evaluate(async()=>{')[1].split('  const report=')[0];
assert.ok(measurement(original));
assert.equal(measurement(runnable), measurement(original));
const replayPath = path.join(sdkRoot, '.tmp/evaluation-api.json');
execFileSync(process.execPath, [path.join(sdkRoot, 'scripts/evaluation/independent-api.mjs'), '--sdk', args.sdk, '--input', path.join(args.archive, 'inputs.json'), '--out', replayPath], { stdio: 'inherit' });
const replay = JSON.parse(await fs.readFile(replayPath, 'utf8'));
const withoutTimings = report => report.scenes.map(scene => ({ ...scene, outputs: scene.outputs.map(({ timings, ...result }) => result) }));
assert.deepEqual(withoutTimings(replay), withoutTimings(api), '当前公开 API 的轨迹结果与历史独立复核不同');
assert.equal(api.scenes.length, 10);
assert.equal(api.scenes.reduce((sum, scene) => sum + scene.outputs.length, 0), 129);
const pkg = JSON.parse(await fs.readFile(path.join(args.sdk, 'package.json'), 'utf8'));
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
console.log(JSON.stringify({ status: '通过', rawFiles: Object.keys(hashes).length, buildFiles: Object.keys(inventory.files).length, scenes: 10, updates: 129, warmSamples: 1800, coldSamples: 9, measurementCommit: benchmark.commit, entrySha256: benchmark.entrySha256, note: '已复跑公开 API 并校验原始性能样本；没有重新测量性能。' }, null, 2));
