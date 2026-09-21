import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

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
assert(files.includes('dist/reid/index.js') && files.includes('dist/reid/index.cjs') && files.includes('dist/reid/index.d.ts'), '缺少 ReID 子入口双格式或类型');
assert(files.includes('LICENSE') && files.includes('NOTICE'));
assert(files.every(file => file.startsWith('dist/') || ['package.json', 'README.md', 'README.en.md', 'LICENSE', 'NOTICE'].includes(file)), '打包混入非发行文件');
assert(files.every(file => !/\.(?:onnx|wasm|png|jpe?g|webp|bin|env)$/i.test(file)), '发行包不能包含模型、引擎、原图或凭据文件');
// 系统临时目录使消费项目无法从 SDK 工作树向上解析开发依赖。
const consumer = await mkdtemp(join(tmpdir(), 'tracking-package-consumer-'));
await mkdir(join(consumer, 'node_modules'));
const extracted = spawnSync('tar', ['-xzf', resolve('.tmp', info.filename), '-C', join(consumer, 'node_modules')], { encoding: 'utf8' });
assert.equal(extracted.status, 0, extracted.stderr);
await rename(join(consumer, 'node_modules/package'), join(consumer, 'node_modules/web-sdk-pp-tracking'));
for (const format of ['esm', 'cjs']) {
  const code = `${format === 'esm' ? "import * as api from 'web-sdk-pp-tracking';" : "const api = require('web-sdk-pp-tracking');"}
const assert = ${format === 'esm' ? "(await import('node:assert/strict')).default" : "require('node:assert/strict')"};
assert.deepEqual(Object.keys(api).sort(), ['TrackingError', 'createTracker']);
const featureSpace = { id: 'package-consumer-appearance-v1', dimension: 2 };
const cases = {
  bytetrack: { options: { minHits: 1 }, frame: { timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [{ box: { x: 0, y: 0, width: 2, height: 2 }, score: 1, classId: 0 }] } },
  ocsort: { options: { minHits: 1, ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 }, frame: { timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [{ box: { x: 0, y: 0, width: 2, height: 2 }, score: 1, classId: 0 }] } },
  deepsort: { options: { minHits: 1, featureSpace, maxCosineDistance: 0.2, gallerySize: 30 }, frame: { timestampMs: 0, imageSize: { width: 10, height: 10 }, featureSpaceId: featureSpace.id, detections: [{ box: { x: 0, y: 0, width: 2, height: 2 }, score: 1, classId: 0, embedding: [1, 0] }] } },
};
for (const [algorithm, { options, frame }] of Object.entries(cases)) {
  const tracker = api.createTracker({ algorithm, ...options });
  const result = tracker.update(frame);
  assert.equal(result.algorithm, algorithm);
  assert.equal(result.tracks[0].id, 1);
  assert.equal(result.runtime.actualBackend, 'cpu');
  tracker.dispose();
}`;
  const path = join(consumer, `consumer.${format === 'esm' ? 'mjs' : 'cjs'}`);
  await writeFile(path, code);
  const result = spawnSync(process.execPath, [path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const reidCode = `${format === 'esm' ? "import * as api from 'web-sdk-pp-tracking/reid'; import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" : "const api = require('web-sdk-pp-tracking/reid');"}
const assert = require('node:assert/strict');
assert.throws(() => require.resolve('onnxruntime-web'), { code: 'MODULE_NOT_FOUND' });
assert.deepEqual(Object.keys(api).sort(), ['ReIdError', 'clearReIdCache', 'createReIdExtractor', 'estimateReIdCache', 'getReIdModelSource']);
assert.equal(api.getReIdModelSource().kind, 'modelscope');
assert.equal(api.getReIdModelSource('huggingface').kind, 'huggingface');
(async () => {
  for (const source of [undefined, 'modelscope', 'huggingface', api.getReIdModelSource()]) {
    const extractor = api.createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', ...(source ? { source } : {}) });
    assert.equal(extractor.featureSpace.dimension, 512);
    await extractor.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });`;
  const reidPath = join(consumer, `reid-consumer.${format === 'esm' ? 'mjs' : 'cjs'}`);
  await writeFile(reidPath, reidCode);
  const reidResult = spawnSync(process.execPath, [reidPath], { encoding: 'utf8' });
  assert.equal(reidResult.status, 0, reidResult.stderr);
}
for (const extension of ['mts', 'cts']) {
  await writeFile(join(consumer, `consumer.${extension}`), "import { createTracker, type FeatureSpace, type Tracker, type TrackerAlgorithm, type TrackingResult } from 'web-sdk-pp-tracking';\nconst byteAlgorithm: TrackerAlgorithm = 'bytetrack';\nconst byteTracker: Tracker = createTracker({ algorithm: byteAlgorithm });\nconst byteResult: TrackingResult = byteTracker.update({ timestampMs: 0, imageSize: { width: 1, height: 1 }, detections: [] });\nconst byteActual: TrackerAlgorithm = byteResult.algorithm;\nif (byteActual !== byteAlgorithm) throw new Error('ByteTrack 类型消费失败');\nbyteTracker.dispose();\nconst ocAlgorithm: TrackerAlgorithm = 'ocsort';\nconst ocTracker: Tracker = createTracker({ algorithm: ocAlgorithm, ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 });\nconst ocResult: TrackingResult = ocTracker.update({ timestampMs: 0, imageSize: { width: 1, height: 1 }, detections: [] });\nconst ocActual: TrackerAlgorithm = ocResult.algorithm;\nif (ocActual !== ocAlgorithm) throw new Error('OC-SORT 类型消费失败');\nocTracker.dispose();\nconst featureSpace: FeatureSpace = { id: 'typed-consumer-v1', dimension: 2 };\nconst deepAlgorithm: TrackerAlgorithm = 'deepsort';\nconst deepTracker: Tracker = createTracker({ algorithm: deepAlgorithm, featureSpace, maxCosineDistance: 0.2, gallerySize: 30 });\nconst deepResult: TrackingResult = deepTracker.update({ timestampMs: 0, imageSize: { width: 2, height: 2 }, featureSpaceId: featureSpace.id, detections: [{ box: { x: 0, y: 0, width: 1, height: 1 }, score: 1, classId: 0, embedding: new Float32Array([1, 0]) }] });\nconst deepActual: TrackerAlgorithm = deepResult.algorithm;\nif (deepActual !== deepAlgorithm) throw new Error('DeepSORT 类型消费失败');\ndeepTracker.dispose();\n");
  const typed = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(consumer, `consumer.${extension}`)], { encoding: 'utf8' });
  assert.equal(typed.status, 0, typed.stdout + typed.stderr);
  await writeFile(join(consumer, `reid-consumer.${extension}`), `import { createReIdExtractor, getReIdModelSource, type ReIdOptions, type ReIdSource, type ReIdExtractor } from 'web-sdk-pp-tracking/reid';
const source: ReIdSource = getReIdModelSource('huggingface');
const options: ReIdOptions[] = [
  { modelId: 'pplcnet-reid-fp32', backend: 'wasm' },
  { modelId: 'pplcnet-reid-fp32', backend: 'webgpu', source: 'huggingface' },
  { modelId: 'pplcnet-reid-fp32', backend: 'wasm', source },
  { modelId: 'pplcnet-reid-fp32', backend: 'wasm', modelBytes: new ArrayBuffer(0) },
];
// @ts-expect-error 模型字节与来源互斥。
const invalid: ReIdOptions = { modelId: 'pplcnet-reid-fp32', backend: 'wasm', modelBytes: new ArrayBuffer(0), source: 'modelscope' };
// @ts-expect-error 不允许未知来源。
getReIdModelSource('unknown');
for (const option of options) { const extractor: ReIdExtractor = createReIdExtractor(option); void extractor.dispose(); }
`);
  const reidTyped = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(consumer, `reid-consumer.${extension}`)], { encoding: 'utf8' });
  assert.equal(reidTyped.status, 0, reidTyped.stdout + reidTyped.stderr);
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0, '生产依赖必须为空');
assert.equal(packageJson.peerDependencies['onnxruntime-web'], '1.27.0');
assert.equal(packageJson.peerDependenciesMeta['onnxruntime-web'].optional, true);
await writeFile('.tmp/package-check.json', JSON.stringify({ filename: info.filename, integrity: info.integrity, sha256: createHash('sha256').update(tarballBytes).digest('hex'), size: info.size, unpackedSize: info.unpackedSize, files, checks: ['三算法与 ReID 实际包 ESM', '三算法与 ReID 实际包 CommonJS', '两个入口 NodeNext ESM/CJS 类型消费', '未安装 ORT 的根入口与 ReID 工厂和释放', 'ORT 1.27.0 可选 peer', '无生产依赖', '发行文件白名单与模型/原图排除'] }, null, 2) + '\n');
console.log(JSON.stringify({ filename: info.filename, size: info.size, unpackedSize: info.unpackedSize, files }, null, 2));
console.log('三算法与 ReID 实际 npm pack、双格式导入、独立类型消费、可选 ORT 与发行文件检查通过。');
