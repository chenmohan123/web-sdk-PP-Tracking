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
assert(files.includes('dist/motion/index.js') && files.includes('dist/motion/index.cjs') && files.includes('dist/motion/index.d.ts'), '缺少运动估计子入口双格式或类型');
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
  botsort: { options: { minHits: 1 }, frame: { frameId: 0, timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [{ box: { x: 0, y: 0, width: 2, height: 2 }, score: 1, classId: 0 }], motion: { status: 'initial', from: null, to: { frameId: 0, timestampMs: 0 } } } },
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
  if (algorithm === 'botsort') {
    assert.equal(result.motion.status, 'initial');
    assert.throws(() => tracker.update({ ...frame, frameId: 1, timestampMs: 100 }), { code: 'INVALID_INPUT' });
    const next = tracker.update({ ...frame, frameId: 1, timestampMs: 100, motion: { status: 'identity', from: frame.motion.to, to: { frameId: 1, timestampMs: 100 } } });
    assert.equal(next.tracks[0].id, 1);
  }
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
  const motionCode = `${format === 'esm' ? "import * as api from 'web-sdk-pp-tracking/motion';" : "const api = require('web-sdk-pp-tracking/motion');"}
const assert = ${format === 'esm' ? "(await import('node:assert/strict')).default" : "require('node:assert/strict')"};
assert.deepEqual(Object.keys(api).sort(), ['MotionEstimateError', 'estimateMotion']);
const image = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(127) };
api.estimateMotion({ previous: { image, frameId: 0, timestampMs: 0 }, current: { image, frameId: 1, timestampMs: 33 }, imageSize: { width: 8, height: 8 } }, { identityWhenStatic: true }).then(result => {
  assert.equal(result.status, 'identity'); assert.deepEqual(result.matrix, [1, 0, 0, 0, 1, 0]);
}).catch(error => { console.error(error); process.exitCode = 1; });`;
  const motionPath = join(consumer, `motion-consumer.${format === 'esm' ? 'mjs' : 'cjs'}`);
  await writeFile(motionPath, motionCode);
  const motionResult = spawnSync(process.execPath, [motionPath], { encoding: 'utf8' });
  assert.equal(motionResult.status, 0, motionResult.stderr);
}
for (const extension of ['mts', 'cts']) {
  await writeFile(join(consumer, `consumer.${extension}`), "import { createTracker, type FeatureSpace, type Tracker, type TrackerAlgorithm, type TrackingResult } from 'web-sdk-pp-tracking';\nconst byteAlgorithm: TrackerAlgorithm = 'bytetrack';\nconst byteTracker: Tracker = createTracker({ algorithm: byteAlgorithm });\nconst byteResult: TrackingResult = byteTracker.update({ timestampMs: 0, imageSize: { width: 1, height: 1 }, detections: [] });\nconst byteActual: TrackerAlgorithm = byteResult.algorithm;\nif (byteActual !== byteAlgorithm) throw new Error('ByteTrack 类型消费失败');\nbyteTracker.dispose();\nconst ocAlgorithm: TrackerAlgorithm = 'ocsort';\nconst ocTracker: Tracker = createTracker({ algorithm: ocAlgorithm, ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 });\nconst ocResult: TrackingResult = ocTracker.update({ timestampMs: 0, imageSize: { width: 1, height: 1 }, detections: [] });\nconst ocActual: TrackerAlgorithm = ocResult.algorithm;\nif (ocActual !== ocAlgorithm) throw new Error('OC-SORT 类型消费失败');\nocTracker.dispose();\nconst featureSpace: FeatureSpace = { id: 'typed-consumer-v1', dimension: 2 };\nconst deepAlgorithm: TrackerAlgorithm = 'deepsort';\nconst deepTracker: Tracker = createTracker({ algorithm: deepAlgorithm, featureSpace, maxCosineDistance: 0.2, gallerySize: 30 });\nconst deepResult: TrackingResult = deepTracker.update({ timestampMs: 0, imageSize: { width: 2, height: 2 }, featureSpaceId: featureSpace.id, detections: [{ box: { x: 0, y: 0, width: 1, height: 1 }, score: 1, classId: 0, embedding: new Float32Array([1, 0]) }] });\nconst deepActual: TrackerAlgorithm = deepResult.algorithm;\nif (deepActual !== deepAlgorithm) throw new Error('DeepSORT 类型消费失败');\ndeepTracker.dispose();\n");
  const typed = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(consumer, `consumer.${extension}`)], { encoding: 'utf8' });
  assert.equal(typed.status, 0, typed.stdout + typed.stderr);
  await writeFile(join(consumer, `botsort-consumer.${extension}`), `import { createTracker, type AnyTrackerOptions, type BoTSortTrackerOptions, type BoTSortTracker, type BoTSortResult, type BoTSortFrame, type CameraMotion } from 'web-sdk-pp-tracking';
const options: BoTSortTrackerOptions = { algorithm: 'botsort', motionFailure: 'identity' };
const general: AnyTrackerOptions = options;
const tracker: BoTSortTracker = createTracker(options);
const motion: CameraMotion = { status: 'initial', from: null, to: { frameId: 0, timestampMs: 0 } };
const frame: BoTSortFrame = { frameId: 0, timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [], motion };
const result: BoTSortResult = tracker.update(frame);
const actual: 'botsort' = result.algorithm;
// @ts-expect-error 旧 Tracker 注解不能抹掉 BoT-SORT 必需的运动帧契约。
const ordinary: import('web-sdk-pp-tracking').Tracker = tracker;
// @ts-expect-error BoT-SORT 必需 frameId 和 motion。
tracker.update({ timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [] });
// @ts-expect-error 不允许 DeepSORT 图库参数混入 BoT-SORT。
createTracker({ algorithm: 'botsort', gallerySize: 30 });
tracker.dispose(); void general; void actual;
`);
  const botTyped = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(consumer, `botsort-consumer.${extension}`)], { encoding: 'utf8' });
  assert.equal(botTyped.status, 0, botTyped.stdout + botTyped.stderr);
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
  await writeFile(join(consumer, `motion-consumer.${extension}`), `import { estimateMotion, MotionEstimateError, type MotionEstimateInput, type MotionEstimateResult } from 'web-sdk-pp-tracking/motion';
const image = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) } as ImageData;
const input: MotionEstimateInput = { previous: { image, frameId: 0, timestampMs: 0 }, current: { image, frameId: 1, timestampMs: 33 }, imageSize: { width: 8, height: 8 } };
const result: Promise<MotionEstimateResult> = estimateMotion(input);
const error: MotionEstimateError = new MotionEstimateError('INVALID_INPUT', 'test');
void result; void error;
// @ts-expect-error 运动估计不从包根导出。
import { estimateMotion as invalidRootImport } from 'web-sdk-pp-tracking';
void invalidRootImport;
`);
  const motionTyped = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(consumer, `motion-consumer.${extension}`)], { encoding: 'utf8' });
  assert.equal(motionTyped.status, 0, motionTyped.stdout + motionTyped.stderr);
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0, '生产依赖必须为空');
assert.equal(packageJson.peerDependencies['onnxruntime-web'], '1.27.0');
assert.equal(packageJson.peerDependenciesMeta['onnxruntime-web'].optional, true);
await writeFile('.tmp/package-check.json', JSON.stringify({ filename: info.filename, integrity: info.integrity, sha256: createHash('sha256').update(tarballBytes).digest('hex'), size: info.size, unpackedSize: info.unpackedSize, files, checks: ['四算法、ReID 与运动估计实际包 ESM', '四算法、ReID 与运动估计实际包 CommonJS', '三个入口 NodeNext ESM/CJS 类型消费', '未安装 ORT 的根入口与 ReID 工厂和释放', 'ORT 1.27.0 可选 peer', '无生产依赖', '发行文件白名单与模型/原图排除'] }, null, 2) + '\n');
console.log(JSON.stringify({ filename: info.filename, size: info.size, unpackedSize: info.unpackedSize, files }, null, 2));
console.log('四算法与 ReID 实际 npm pack、双格式导入、独立类型消费、可选 ORT 与发行文件检查通过。');
