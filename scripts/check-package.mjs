import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// 宿主 Windows 的 npm.cmd 需经 cmd 调用；命令与路径均为脚本内固定值。
const runNpm = args => spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args, { encoding: 'utf8' });
await mkdir('.tmp', { recursive: true });
const packed = runNpm(['pack', '--json', '--pack-destination', '.tmp']);
if (packed.status !== 0) throw new Error(packed.stderr || 'npm pack 失败');
const info = JSON.parse(packed.stdout)[0];
const tarballBytes = await readFile(resolve('.tmp', info.filename));
assert.equal(info.integrity, `sha512-${createHash('sha512').update(tarballBytes).digest('base64')}`);
const files = info.files.map(file => file.path).sort();
assert(files.includes('dist/index.js') && files.includes('dist/index.cjs') && files.includes('dist/index.d.ts'));
assert(files.includes('LICENSE') && files.includes('NOTICE'));
assert(files.every(file => file.startsWith('dist/') || ['package.json', 'README.md', 'README.en.md', 'LICENSE', 'NOTICE'].includes(file)), '打包混入非发行文件');
const consumer = await mkdtemp(resolve('.tmp/package-consumer-'));
await mkdir(join(consumer, 'node_modules'));
const extracted = spawnSync('tar', ['-xzf', resolve('.tmp', info.filename), '-C', join(consumer, 'node_modules')], { encoding: 'utf8' });
assert.equal(extracted.status, 0, extracted.stderr);
await rename(join(consumer, 'node_modules/package'), join(consumer, 'node_modules/web-sdk-pp-tracking'));
for (const format of ['esm', 'cjs']) {
  const code = `${format === 'esm' ? "import * as api from 'web-sdk-pp-tracking';" : "const api = require('web-sdk-pp-tracking');"}
const assert = ${format === 'esm' ? "(await import('node:assert/strict')).default" : "require('node:assert/strict')"};
assert.deepEqual(Object.keys(api).sort(), ['TrackingError', 'createTracker']);
for (const [algorithm, options] of Object.entries({ bytetrack: { minHits: 1 }, ocsort: { minHits: 1, ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 } })) {
  const tracker = api.createTracker({ algorithm, ...options });
  const result = tracker.update({ timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [{ box: { x: 0, y: 0, width: 2, height: 2 }, score: 1, classId: 0 }] });
  assert.equal(result.algorithm, algorithm);
  assert.equal(result.tracks[0].id, 1);
  assert.equal(result.runtime.actualBackend, 'cpu');
  tracker.dispose();
}`;
  const path = join(consumer, `consumer.${format === 'esm' ? 'mjs' : 'cjs'}`);
  await writeFile(path, code);
  const result = spawnSync(process.execPath, [path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
for (const extension of ['mts', 'cts']) {
  await writeFile(join(consumer, `consumer.${extension}`), "import { createTracker, type Tracker, type TrackerAlgorithm, type TrackingResult } from 'web-sdk-pp-tracking';\nconst algorithm: TrackerAlgorithm = 'ocsort';\nconst tracker: Tracker = createTracker({ algorithm, ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 });\nconst result: TrackingResult = tracker.update({ timestampMs: 0, imageSize: { width: 1, height: 1 }, detections: [] });\nconst actual: TrackerAlgorithm = result.algorithm;\nvoid actual;\n");
  const typed = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(consumer, `consumer.${extension}`)], { encoding: 'utf8' });
  assert.equal(typed.status, 0, typed.stdout + typed.stderr);
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0, '生产依赖必须为空');
await writeFile('.tmp/package-check.json', JSON.stringify({ filename: info.filename, integrity: info.integrity, sha256: createHash('sha256').update(tarballBytes).digest('hex'), size: info.size, unpackedSize: info.unpackedSize, files, checks: ['ByteTrack 与 OC-SORT 实际包 ESM', 'ByteTrack 与 OC-SORT 实际包 CommonJS', '两算法 TypeScript 类型', '无生产依赖', '发行文件白名单'] }, null, 2) + '\n');
console.log(JSON.stringify({ filename: info.filename, size: info.size, unpackedSize: info.unpackedSize, files }, null, 2));
console.log('两算法实际 npm pack、双格式导入、类型与发行文件检查通过。');
