import { expect, test } from 'vitest';
import { createTracker } from '../src/index';

type Vector = readonly number[] | Float32Array;
const detection = (embedding: Vector, x = 10, score = 0.9, classId = 0) => ({
  box: { x, y: 10, width: 20, height: 40 }, score, classId, embedding,
});
const frame = (timestampMs: number, detections = [detection([1, 0])], featureSpaceId = 'synthetic-v1') => ({
  timestampMs, imageSize: { width: 400, height: 200 }, featureSpaceId, detections,
});
const options = { algorithm: 'deepsort' as const, featureSpace: { id: 'synthetic-v1', dimension: 2 }, minHits: 1 };

test('DeepSORT 最小契约可运行，空间不符失败后同时间重试保持 ID', () => {
  const tracker = createTracker(options);
  expect(tracker.update(frame(0)).algorithm).toBe('deepsort');
  expect(() => tracker.update(frame(100, undefined, 'other'))).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(tracker.update(frame(100)).tracks[0]).toMatchObject({ id: 1, hits: 2 });
});

test('DeepSORT 专属选项严格校验且与其他算法互斥', () => {
  const invalid = [
    { algorithm: 'deepsort' },
    { ...options, featureSpace: { id: '', dimension: 2 } },
    { ...options, featureSpace: { id: ' padded', dimension: 2 } },
    { ...options, featureSpace: { id: 'x'.repeat(257), dimension: 2 } },
    { ...options, featureSpace: { id: 'x', dimension: 0 } },
    { ...options, featureSpace: { id: 'x', dimension: 2049 } },
    { ...options, featureSpace: { id: 'x', dimension: 1.5 } },
    { ...options, featureSpace: { id: 'x', dimension: 2, extra: true } },
    { ...options, maxCosineDistance: -1 },
    { ...options, maxCosineDistance: 2.01 },
    { ...options, maxCosineDistance: undefined },
    { ...options, gallerySize: 0 },
    { ...options, gallerySize: 101 },
    { ...options, gallerySize: 1.5 },
    { ...options, lowScoreThreshold: 0.1 },
    { ...options, lowMatchIouThreshold: 0.2 },
    { ...options, ocmWeight: 0.2 },
    { ...options, featureSpace: { id: 'x', dimension: 2048 }, gallerySize: 100, maxTracks: 20 },
    { algorithm: 'bytetrack', featureSpace: { id: 'x', dimension: 2 } },
    { algorithm: 'bytetrack', maxCosineDistance: 0.2 },
    { algorithm: 'ocsort', gallerySize: 30 },
  ];
  for (const value of invalid) expect(() => createTracker(value as never)).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(createTracker({ ...options, maxCosineDistance: 0, gallerySize: 1 })).toBeDefined();
  expect(createTracker({ ...options, maxCosineDistance: 2, gallerySize: 100 })).toBeDefined();
  expect(createTracker({ ...options, featureSpace: { id: 'x', dimension: 2000 }, gallerySize: 100, maxTracks: 20 })).toBeDefined();
});

test('ByteTrack 与 OC-SORT 忽略可选外观字段并保持旧输入行为', () => {
  for (const algorithm of ['bytetrack', 'ocsort'] as const) {
    const tracker = createTracker({ algorithm, minHits: 1 });
    const input = { ...frame(0, [detection([NaN, Infinity])]), featureSpaceId: 'ignored' };
    expect(tracker.update(input)).toMatchObject({ algorithm, tracks: [{ id: 1, state: 'tracked' }] });
  }
});

test('每个检测都严格校验向量类型、维度、有限性、非零范数与稀疏槽位', () => {
  const sparse = Array(2) as number[];
  sparse[0] = 1;
  const invalid: unknown[] = [
    undefined, [1], [1, 0, 0], [0, 0], [NaN, 0], [Infinity, 0], sparse,
    new Float64Array([1, 0]), { 0: 1, 1: 0, length: 2 },
  ];
  for (const embedding of invalid) {
    const tracker = createTracker(options);
    expect(() => tracker.update(frame(0, [detection(embedding as Vector)]))).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  }
  const low = createTracker(options);
  expect(() => low.update(frame(0, [detection([NaN, 0], 10, 0.01)]))).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(() => createTracker(options).update({ ...frame(0, []), featureSpaceId: undefined } as never)).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(createTracker(options).update(frame(0, [])).tracks).toEqual([]);
});

test('普通数组和 Float32Array 均深复制，配置对象也不保留引用', () => {
  for (const embedding of [[1, 0], new Float32Array([1, 0])] as (number[] | Float32Array)[]) {
    const featureSpace = { id: 'synthetic-v1', dimension: 2 };
    const tracker = createTracker({ algorithm: 'deepsort', featureSpace, minHits: 1 });
    tracker.update(frame(0, [detection(embedding)]));
    embedding[0] = -1;
    featureSpace.id = 'mutated';
    tracker.update(frame(100, []));
    expect(tracker.update(frame(200, [detection([1, 0])])).tracks.find(track => track.id === 1)).toMatchObject({ state: 'tracked', hits: 2 });
  }
});

test('超大与极小有限向量经稳健归一化后保持同一外观', () => {
  const tracker = createTracker(options);
  tracker.update(frame(0, [detection([Number.MAX_VALUE, 0])]));
  tracker.update(frame(100, []));
  expect(tracker.update(frame(200, [detection([Number.MIN_VALUE, 0])])).tracks).toMatchObject([{ id: 1, state: 'tracked', hits: 2 }]);
});

test('相同位置的相反外观交换输入顺序后仍保持各自 ID', () => {
  const tracker = createTracker(options);
  tracker.update(frame(0, [detection([1, 0], 10, 0.81), detection([-1, 0], 10, 0.91)]));
  const out = tracker.update(frame(100, [detection([-1, 0], 10, 0.92), detection([1, 0], 10, 0.82)]));
  expect(out.tracks.find(track => track.id === 1)).toMatchObject({ score: 0.82, hits: 2 });
  expect(out.tracks.find(track => track.id === 2)).toMatchObject({ score: 0.92, hits: 2 });
});

test('lost 轨迹不能以 IoU 绕过外观门限恢复', () => {
  const tracker = createTracker(options);
  tracker.update(frame(0));
  tracker.update(frame(100, []));
  const out = tracker.update(frame(200, [detection([-1, 0])]));
  expect(out.tracks).toMatchObject([{ id: 1, state: 'lost', hits: 1 }, { id: 2, state: 'tracked', hits: 1 }]);
});

test('同向量的远位移受运动门控，不能仅凭外观恢复', () => {
  const tracker = createTracker({ ...options, maxCosineDistance: 2 });
  tracker.update(frame(0));
  const out = tracker.update(frame(100, [detection([1, 0], 300)]));
  expect(out.tracks).toMatchObject([{ id: 1, state: 'lost' }, { id: 2, state: 'tracked' }]);
});

test('最大外观门限和零 IoU 门限仍严格隔离类别', () => {
  const tracker = createTracker({ ...options, maxCosineDistance: 2, matchIouThreshold: 0 });
  tracker.update(frame(0, [detection([1, 0], 10, 0.9, 0)]));
  const out = tracker.update(frame(100, [detection([1, 0], 10, 0.9, 1)]));
  expect(out.tracks).toMatchObject([{ id: 1, classId: 0, state: 'lost' }, { id: 2, classId: 1, state: 'tracked' }]);
});

test('tentative 轨迹只在 IoU 后备路径匹配并按命中数确认', () => {
  const tracker = createTracker({ ...options, minHits: 2 });
  expect(tracker.update(frame(0)).tracks[0]).toMatchObject({ id: 1, state: 'tentative' });
  expect(tracker.update(frame(100, [detection([-1, 0])])).tracks).toMatchObject([{ id: 1, state: 'tracked', hits: 2 }]);
});

test('已确认轨迹按 lastSeenMs 新鲜组优先关联', () => {
  const tracker = createTracker({ ...options, maxCosineDistance: 2 });
  tracker.update(frame(0, [detection([1, 0])]));
  tracker.update(frame(100, [detection([1, 0]), detection([-1, 0])]));
  tracker.update(frame(200, [detection([-1, 0])]));
  const out = tracker.update(frame(300, [detection([1, 0])]));
  expect(out.tracks.find(track => track.id === 2)).toMatchObject({ state: 'tracked', hits: 3, score: 0.9 });
  expect(out.tracks.find(track => track.id === 1)).toMatchObject({ state: 'lost', hits: 2 });
});

test('图库保留旧样本可恢复，容量淘汰后旧样本不能恢复', () => {
  const run = (gallerySize: number) => {
    const tracker = createTracker({ ...options, gallerySize });
    tracker.update(frame(0, [detection([1, 0])]));
    tracker.update(frame(100, [detection([0, 1])]));
    tracker.update(frame(200, [detection([-1, 0])]));
    tracker.update(frame(300, []));
    return tracker.update(frame(400, [detection([1, 0])]));
  };
  expect(run(3).tracks).toMatchObject([{ id: 1, state: 'tracked', hits: 4 }]);
  expect(run(2).tracks).toMatchObject([{ id: 1, state: 'lost', hits: 3 }, { id: 2, state: 'tracked', hits: 1 }]);
});

test('取消、reset、dispose 与实例状态保持 DeepSORT 生命周期契约', () => {
  const first = createTracker(options), second = createTracker(options);
  const controller = new AbortController(); controller.abort();
  expect(() => first.update(frame(0), { signal: controller.signal })).toThrowError(expect.objectContaining({ code: 'ABORTED' }));
  expect(first.update(frame(0)).tracks[0].id).toBe(1);
  expect(second.update(frame(0)).tracks[0].id).toBe(1);
  first.reset();
  expect(first.update(frame(0))).toMatchObject({ generation: 1, tracks: [{ id: 1 }] });
  first.dispose(); first.dispose();
  expect(() => first.update(frame(100))).toThrowError(expect.objectContaining({ code: 'DISPOSED' }));
  expect(() => first.reset()).toThrowError(expect.objectContaining({ code: 'DISPOSED' }));
  expect(second.update(frame(100, [])).tracks[0]).toMatchObject({ id: 1, state: 'lost' });
});

test('巨大有限运动创新溢出时整帧失败且不提交状态', () => {
  const tracker = createTracker({ ...options, maxLostMs: 1e300, largeGapMs: 1e300 });
  tracker.update({
    timestampMs: 0,
    imageSize: { width: Number.MAX_VALUE, height: 200 },
    featureSpaceId: 'synthetic-v1',
    detections: [detection([1, 0], 10)],
  });
  const huge = {
    timestampMs: 100,
    imageSize: { width: Number.MAX_VALUE, height: 200 },
    featureSpaceId: 'synthetic-v1',
    detections: [detection([1, 0], Number.MAX_VALUE / 2)],
  };
  expect(() => tracker.update(huge)).toThrowError(expect.objectContaining({ code: 'NUMERICAL_FAILURE' }));
  expect(tracker.update({ ...frame(100), imageSize: { width: Number.MAX_VALUE, height: 200 } })).toMatchObject({ tracks: [{ id: 1, hits: 2 }] });
});
