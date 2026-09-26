import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { serializeYoloxDetections } from './yolox-serialization.mjs';
import {
  DETECTOR_OPTIONS,
  FIXTURE_HEIGHT,
  FIXTURE_WIDTH,
  SAMPLE_COUNT,
  SEQUENCE_FRAME_COUNT,
  SEQUENCE_SERIALIZERS,
  SEQUENCE_VARIANTS,
  TRACKER_OPTIONS,
  sequenceContract,
} from './yolox-candidate-config.mjs';
import { createYoloxSyntheticSequence } from './yolox-sequence.mjs';
import { runYoloxTrackingSequence } from './yolox-tracking-sequence.mjs';

const WORK_DIR = resolve('.tmp/yolox-module');
const CANDIDATE_PATH = resolve(WORK_DIR, 'dist/yolox.js');
const CANDIDATE_CJS_PATH = resolve(WORK_DIR, 'dist/yolox.cjs');
const TRACKER_ENTRY_PATH = resolve('dist/index.js');
const MODEL_PATH = resolve(
  process.env.TRACKING_YOLOX_MODEL ??
    '.tmp/yolox-reference/yolox_tiny_416_opset17.onnx',
);
const MODEL_MANIFEST_PATH = resolve(
  'models/yolox-tiny/0.1.0/model.json',
);
const FIXTURE_PATH = resolve(WORK_DIR, 'fixture-rgba.bin');
const RESULT_PATH = resolve(WORK_DIR, 'node-result.json');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value) {
  return sha256(typeof value === 'string' ? Buffer.from(value, 'utf8') : value);
}

// 每帧保留集合里相邻分数的最小间隔；用于解释零阈值组的跨运行时取舍差异。
function minimumAdjacentScoreGap(detections) {
  let gap = null;
  for (let index = 1; index < detections.length; index += 1) {
    const delta = detections[index - 1].score - detections[index].score;
    if (delta > 0 && (gap === null || delta < gap)) gap = delta;
  }
  return gap;
}

function createFixture() {
  const data = new Uint8Array(FIXTURE_WIDTH * FIXTURE_HEIGHT * 4);
  for (let y = 0; y < FIXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < FIXTURE_WIDTH; x += 1) {
      const offset = (y * FIXTURE_WIDTH + x) * 4;
      data[offset] = (x * 29 + y * 17 + (x * y) % 251) & 0xff;
      data[offset + 1] = (x * 7 + y * 31 + (x ^ y)) & 0xff;
      data[offset + 2] = (x * 19 + y * 11 + (x + y) ** 2) & 0xff;
      data[offset + 3] = (x + y) % 13 === 0 ? 96 : 255;
    }
  }
  return data;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function summarize(values) {
  return {
    minMs: Math.min(...values),
    meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: Math.max(...values),
  };
}

function summarizeTimings(samples) {
  const stages = [
    'validationMs',
    'preprocessMs',
    'inferenceMs',
    'postprocessMs',
    'totalMs',
  ];
  return Object.fromEntries(
    stages.map(stage => [stage, summarize(samples.map(sample => sample[stage]))]),
  );
}

await mkdir(WORK_DIR, { recursive: true });
const manifest = JSON.parse(await readFile(MODEL_MANIFEST_PATH, 'utf8'));
const model = await readFile(MODEL_PATH);
assert.equal(model.byteLength, manifest.bytes, 'ONNX 字节数必须匹配锁定身份');
assert.equal(sha256(model), manifest.sha256, 'ONNX SHA-256 必须匹配锁定身份');

const fixture = createFixture();
await writeFile(FIXTURE_PATH, fixture);
const fixtureSha256 = sha256(fixture);
const candidate = await import(pathToFileURL(CANDIDATE_PATH).href);
assert.equal(
  typeof candidate.createYoloxDetector,
  'function',
  '候选 bundle 必须导出 createYoloxDetector',
);

const detector = candidate.createYoloxDetector({
  modelId: manifest.id,
  backend: 'wasm',
  modelBytes: Uint8Array.from(model).buffer,
  ...DETECTOR_OPTIONS,
});

let load;
let loadWallMs;
let warmup;
const samples = [];
const serializations = [];
try {
  const loadStart = performance.now();
  load = await detector.load();
  loadWallMs = performance.now() - loadStart;
  assert.deepEqual(
    load.runtime,
    {
      requestedBackend: 'wasm',
      actualBackend: 'wasm',
      executionMode: 'main',
      runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.2',
      ortVersion: '1.27.0',
    },
    'Node 冷加载必须报告 WASM/main 和锁定 ORT 版本',
  );

  const input = {
    image: {
      width: FIXTURE_WIDTH,
      height: FIXTURE_HEIGHT,
      data: fixture,
    },
  };
  warmup = await detector.detect(input);
  assert.equal(warmup.generation, 0, '预热推理必须是 generation 0');
  assert.ok(warmup.detections.length > 0, '零阈值夹具必须覆盖非空检测序列');

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const result = await detector.detect(input);
    assert.equal(result.generation, index + 1, '成功推理 generation 必须连续递增');
    assert.deepEqual(result.runtime, load.runtime, '逐帧运行时身份必须稳定');
    samples.push(result.timings);
    serializations.push(serializeYoloxDetections(result));
  }
} finally {
  await detector.dispose();
}

assert.equal(serializations.length, SAMPLE_COUNT);
assert.ok(
  serializations.every(serialized => serialized === serializations[0]),
  'Node 重复推理必须产生逐字节一致的 detection 序列化结果',
);

const sequenceFrames = createYoloxSyntheticSequence();
assert.equal(sequenceFrames.length, SEQUENCE_FRAME_COUNT, '合成序列必须固定七帧');
// 证据必须绑定被测产物：两端各自核对同一批 bundle 的哈希，才能声明跨运行时等值。
const artifacts = {
  candidateEsmSha256: sha256(await readFile(CANDIDATE_PATH)),
  candidateCjsSha256: sha256(await readFile(CANDIDATE_CJS_PATH)),
  trackerEntrySha256: sha256(await readFile(TRACKER_ENTRY_PATH)),
};
const rootEntry = await import(pathToFileURL(TRACKER_ENTRY_PATH).href);
assert.equal(
  typeof rootEntry.createTracker,
  'function',
  '正式根入口必须导出 createTracker',
);
const sequences = [];
for (const variant of SEQUENCE_VARIANTS) {
  const serializeDetections = SEQUENCE_SERIALIZERS[variant.hashing];
  assert.ok(serializeDetections, `${variant.hashing} 没有对应的检测序列化器`);
  const sequenceDetector = candidate.createYoloxDetector({
    modelId: manifest.id,
    backend: 'wasm',
    modelBytes: Uint8Array.from(model).buffer,
    ...variant.detectorOptions,
  });
  try {
    const sequenceLoad = await sequenceDetector.load();
    assert.deepEqual(
      sequenceLoad.runtime,
      load.runtime,
      `${variant.id} 变体的序列检测器运行时身份必须与单帧一致`,
    );
    const runSequence = async () => runYoloxTrackingSequence({
      frames: sequenceFrames,
      detector: sequenceDetector,
      tracker: rootEntry.createTracker({ ...TRACKER_OPTIONS }),
      digest: async value => digest(value),
      serializeDetections,
    });
    const first = await runSequence();
    const repeat = await runSequence();
    assert.deepEqual(
      first.frames.map(frame => frame.id),
      sequenceFrames.map(frame => frame.id),
      `${variant.id} 变体的序列证据必须逐帧保留原始帧身份`,
    );
    assert.equal(
      repeat.sequence.detectionSha256,
      first.sequence.detectionSha256,
      `${variant.id} 变体重放序列必须复现逐字节一致的 detection 序列哈希`,
    );
    assert.equal(
      repeat.sequence.trackingSha256,
      first.sequence.trackingSha256,
      `${variant.id} 变体重放序列必须复现逐字节一致的 tracking 序列哈希`,
    );
    sequences.push({
      id: variant.id,
      purpose: variant.purpose,
      hashing: variant.hashing,
      detectsRealBoxes: variant.detectsRealBoxes,
      detectorOptions: variant.detectorOptions,
      trackerEntry: 'dist/index.js',
      runtime: sequenceLoad.runtime,
      frames: first.frames,
      summary: first.sequence,
      repeat: {
        detectionSha256: repeat.sequence.detectionSha256,
        trackingSha256: repeat.sequence.trackingSha256,
      },
    });
  } finally {
    await sequenceDetector.dispose();
  }
}

const canonicalDetections = serializations[0];
// 防止整套组合证据退化为"两端都是空"：必须至少一个变体真的把检测框送进跟踪器。
assert.ok(
  sequences.some(variant =>
    variant.detectsRealBoxes && variant.frames.every(frame => frame.detectionCount > 0)),
  '至少一个序列变体必须每帧都有真实检测框进入跟踪器',
);
const nullGaps = sequences
  .filter(variant => variant.detectsRealBoxes)
  .flatMap(variant => variant.frames.filter(frame => frame.minimumAdjacentScoreGap === null));
assert.deepEqual(nullGaps, [], '有框的帧必须记录最小相邻分数间隔');
const result = {
  schemaVersion: '1.0',
  kind: 'yolox-node-wasm-runtime',
  generatedAt: new Date().toISOString(),
  model: {
    id: manifest.id,
    path: '.tmp/yolox-reference/yolox_tiny_416_opset17.onnx',
    bytes: model.byteLength,
    sha256: manifest.sha256,
  },
  fixture: {
    path: '.tmp/yolox-module/fixture-rgba.bin',
    generator: 'rgba-pattern-v1: r=x*29+y*17+(x*y)%251; g=x*7+y*31+(x^y); b=x*19+y*11+(x+y)^2; a=((x+y)%13===0?96:255)',
    width: FIXTURE_WIDTH,
    height: FIXTURE_HEIGHT,
    bytes: fixture.byteLength,
    sha256: fixtureSha256,
  },
  configuration: {
    ...DETECTOR_OPTIONS,
    warmupRuns: 1,
    measuredRuns: SAMPLE_COUNT,
  },
  runtime: load.runtime,
  coldLoad: {
    wallMs: loadWallMs,
    timings: load.timings,
  },
  warmup: {
    generation: warmup.generation,
    timings: warmup.timings,
  },
  warmDetection: {
    samples,
    summary: summarizeTimings(samples),
  },
  detection: {
    count: warmup.detections.length,
    droppedDetections: warmup.droppedDetections,
    serializedBytes: Buffer.byteLength(canonicalDetections),
    sha256: sha256(canonicalDetections),
  },
  canonicalDetections,
  artifacts,
  contract: sequenceContract(),
  sequence: {
    frameCount: SEQUENCE_FRAME_COUNT,
    variants: sequences,
  },
  verification: {
    modelIdentityMatch: true,
    fixtureWritten: true,
    runtimeIdentityMatch: true,
    repeatedOutputStable: true,
    sequenceRepeatedOutputStable: true,
    passed: true,
  },
};

await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  runtime: result.runtime,
  fixtureSha256,
  detectionCount: result.detection.count,
  detectionSha256: result.detection.sha256,
  coldLoadMs: result.coldLoad.wallMs,
  warmP50Ms: result.warmDetection.summary.totalMs.p50Ms,
  warmP95Ms: result.warmDetection.summary.totalMs.p95Ms,
  sequences: result.sequence.variants.map(variant => ({
    id: variant.id,
    hashing: variant.hashing,
    detectionCounts: variant.frames.map(frame => frame.detectionCount),
    trackStates: variant.frames.map(frame => ({
      active: frame.activeTrackIds.length,
      observed: frame.observedTrackIds.length,
      lost: frame.lostTrackIds.length,
      removed: frame.removedTrackIds.length,
    })),
    detectionSha256: variant.summary.detectionSha256,
    trackingSha256: variant.summary.trackingSha256,
  })),
  passed: true,
}));
