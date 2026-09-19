import { expect, test, vi } from 'vitest';
import { createTracker } from '../src/index';
import { directionDifferenceRadians, interpolateObservationBox, observationCentres, ocmAssociationScore, replayObservationFilter } from '../src/ocsort';
import * as ocsort from '../src/ocsort';
import { initialize } from '../src/kalman';
import { iou } from '../src/assignment';

const detection = (score = 0.9, x = 20, classId = 0) => ({ box: { x, y: 20, width: 40, height: 40 }, score, classId });
const frame = (timestampMs: number, detections = [detection()]) => ({ timestampMs, imageSize: { width: 640, height: 480 }, detections });
const boxDetection = (x: number, y = 20, width = 40, height = 40, score = 0.9, classId = 0) => ({ box: { x, y, width, height }, score, classId });

test('工厂默认 ByteTrack、OC-SORT 身份和未知算法拒绝', () => {
  expect(createTracker({ minHits: 1 }).update(frame(0))).toMatchObject({ algorithm: 'bytetrack' });
  expect(createTracker({ algorithm: 'ocsort', minHits: 1 }).update(frame(0))).toMatchObject({ algorithm: 'ocsort' });
  expect(() => createTracker({ algorithm: 'unknown' as never })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
});

test('省略算法与显式 ByteTrack 在多帧轨迹上保持确定等价', () => {
  const implicit = createTracker({ minHits: 1 });
  const explicit = createTracker({ algorithm: 'bytetrack', minHits: 1 });
  const frames = [frame(0), frame(100, [detection(0.25, 22)]), frame(200, []), frame(300, [detection(0.9, 24)])];
  for (const input of frames) {
    const left = implicit.update(input);
    const right = explicit.update(input);
    expect({ ...left, algorithm: undefined, timings: undefined }).toEqual({ ...right, algorithm: undefined, timings: undefined });
  }
});

test('两种算法的专属参数互斥，OC-SORT 不接受 ByteTrack 低分续接参数', () => {
  expect(() => createTracker({ algorithm: 'ocsort', lowScoreThreshold: 0.1 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', lowMatchIouThreshold: 0.2 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'bytetrack', ocmWeight: 0.2 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', ocmWeight: 1.01 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', ocmHistoryLength: 1 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', oruMaxReplaySteps: 61 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
});

test('OC-SORT 高分阈值可以低于 ByteTrack 默认低分阈值', () => {
  expect(createTracker({ algorithm: 'ocsort', highScoreThreshold: 0.05, newTrackThreshold: 0.06 })).toBeDefined();
});

test('OCM 方向差使用弧度且零运动不制造方向惩罚', () => {
  const [a, b] = observationCentres({ x: 0, y: 0, width: 2, height: 2 }, { x: 2, y: 0, width: 2, height: 2 });
  const [c, d] = observationCentres({ x: 2, y: 0, width: 2, height: 2 }, { x: 2, y: 2, width: 2, height: 2 });
  expect(directionDifferenceRadians([a, b], [c, d])).toBeCloseTo(Math.PI / 2, 12);
  expect(directionDifferenceRadians([a, a], [c, c])).toBe(0);
  expect(ocmAssociationScore(0.8, Math.PI / 2, 0.2)).toBeCloseTo(0.7, 12);
});

test('OCM 方向分数不能越过原始 IoU 硬门限', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, matchIouThreshold: 0.5 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  expect(tracker.update(frame(100, [detection(0.9, 141)])).tracks).toMatchObject([
    { id: 1, state: 'lost' }, { id: 2, state: 'tracked' },
  ]);
});

test('OCM 在实际两轨迹方向歧义中选择各自一致的意图', () => {
  const run = (ocmWeight: number) => {
    const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, matchIouThreshold: 0.01, ocmWeight, ocmDeltaMs: 100 });
    tracker.update(frame(0, [boxDetection(266, 221), boxDetection(276, 250)]));
    tracker.update(frame(400, [boxDetection(379, 277), boxDetection(292, 227)]));
    return tracker.update(frame(800, [boxDetection(306, 254), boxDetection(89, 276)]));
  };
  const withoutDirection = run(0);
  const withDirection = run(1);
  expect(withoutDirection.tracks.find(track => track.id === 2)).toMatchObject({ hits: 1, state: 'lost' });
  expect(withDirection.tracks.find(track => track.id === 2)).toMatchObject({ hits: 2, state: 'tracked' });
  expect(withDirection.tracks.find(track => track.id === 1)?.box).not.toEqual(withoutDirection.tracks.find(track => track.id === 1)?.box);
});

test('OC-SORT 实际关联严格隔离类别', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1 });
  tracker.update(frame(0, [boxDetection(100, 100, 40, 40, 0.9, 0)]));
  const out = tracker.update(frame(100, [boxDetection(100, 100, 40, 40, 0.9, 1)]));
  expect(out.tracks).toMatchObject([{ id: 1, classId: 0, state: 'lost' }, { id: 2, classId: 1, state: 'tracked' }]);
});

test('OCR 用最后真实观测二轮恢复，虚拟观测不增加 hits 或 score', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, matchIouThreshold: 0.3 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  tracker.update(frame(100, [detection(0.9, 120)]));
  tracker.update(frame(200, []));
  expect(tracker.update(frame(300, [detection(0.9, 125)])).tracks).toMatchObject([
    { id: 1, state: 'tracked', hits: 3, observed: true, score: 0.9 },
  ]);
});

test('OCR 只有在第一轮预测 IoU 失败后才用末次真实观测恢复', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, matchIouThreshold: 0.3 });
  tracker.update(frame(0, [boxDetection(100)]));
  tracker.update(frame(100, [boxDetection(120)]));
  tracker.update(frame(200, []));
  tracker.update(frame(300, []));
  tracker.update(frame(400, []));
  const lost = tracker.update(frame(500, []));
  const out = tracker.update(frame(600, [boxDetection(120)]));
  expect(iou(lost.tracks[0].box, boxDetection(120).box)).toBeLessThan(0.3);
  expect(iou(boxDetection(120).box, boxDetection(120).box)).toBe(1);
  expect(out.tracks).toMatchObject([{ id: 1, state: 'tracked', hits: 3 }]);
  expect(out.tracks).not.toContainEqual(expect.objectContaining({ id: 2 }));
});

test('ORU 按实际缺失时间戳插值，缺失上限超出后结束轨迹', () => {
  expect(interpolateObservationBox({ x: 20, y: 20, width: 40, height: 40 }, { x: 80, y: 20, width: 40, height: 40 }, 250, 100, 400)).toEqual({ x: 50, y: 20, width: 40, height: 40 });
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, oruMaxReplaySteps: 2 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  tracker.update(frame(100, []));
  tracker.update(frame(275, []));
  expect(tracker.update(frame(400, []))).toMatchObject({ tracks: [], removed: [{ id: 1, state: 'removed' }] });
});

test('ORU 不规则重放从末次真实快照开始并只校正当前观测一次', () => {
  const initial = initialize({ x: 0, y: 0, width: 2, height: 2 });
  const replayed = replayObservationFilter(
    initial,
    { timestampMs: 100, box: { x: 0, y: 0, width: 2, height: 2 }, score: 0.9 },
    { timestampMs: 450, box: { x: 30, y: 0, width: 2, height: 2 }, score: 0.9 },
    [250],
    2,
  );
  expect(replayed.mean[0]).toBeCloseTo(30.842632869883204, 12);
  expect(replayed.mean[4]).toBeCloseTo(84.21623692, 8);
  expect(replayed.covariance[0][0]).toBeCloseTo(3.8870932388110591, 12);
  expect(replayed.covariance[0][4]).toBeCloseTo(18.364425294880864, 12);
  const before = initial.mean.slice();
  expect(() => replayObservationFilter(initial, { timestampMs: 100, box: { x: 0, y: 0, width: 2, height: 2 }, score: 0.9 }, { timestampMs: 450, box: { x: 30, y: 0, width: 2, height: 2 }, score: 0.9 }, [500], 2)).toThrowError();
  expect(initial.mean).toEqual(before);
});

test('OC-SORT 恢复过程中的异常保持下一帧可提交', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, oruMaxReplaySteps: 2 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  tracker.update(frame(100, []));
  tracker.update(frame(200, []));
  expect(tracker.update(frame(300, [detection(0.9, 105)])).tracks[0]).toMatchObject({ id: 1, hits: 2 });
  expect(tracker.update(frame(400, [detection(0.9, 110)])).tracks[0]).toMatchObject({ id: 1, hits: 3 });
});

test('真实 ORU 故障注入后恢复函数可提交与对照相同的后续帧', () => {
  const failing = createTracker({ algorithm: 'ocsort', minHits: 1 });
  const control = createTracker({ algorithm: 'ocsort', minHits: 1 });
  const setup = [frame(0, [boxDetection(100)]), frame(100, [boxDetection(120)]), frame(200, [])];
  for (const input of setup) { failing.update(input); control.update(input); }
  const recovery = frame(300, [boxDetection(125)]);
  const injected = vi.spyOn(ocsort, 'replayObservationFilter').mockImplementationOnce(() => {
    throw new Error('injected ORU failure');
  });
  expect(() => failing.update(recovery)).toThrowError('injected ORU failure');
  expect(injected).toHaveBeenCalledTimes(1);
  injected.mockRestore();
  const expected = control.update(recovery);
  const actual = failing.update(recovery);
  expect({ ...actual, timings: undefined }).toEqual({ ...expected, timings: undefined });
  const next = frame(400, [boxDetection(130)]);
  const expectedNext = control.update(next);
  const actualNext = failing.update(next);
  expect({ ...actualNext, timings: undefined }).toEqual({ ...expectedNext, timings: undefined });
});

test('OC-SORT 预取消、reset/dispose 和实例状态彼此隔离', () => {
  const first = createTracker({ algorithm: 'ocsort', minHits: 1 });
  const second = createTracker({ algorithm: 'ocsort', minHits: 1 });
  const controller = new AbortController();
  controller.abort();
  expect(() => first.update(frame(0), { signal: controller.signal })).toThrowError(expect.objectContaining({ code: 'ABORTED' }));
  expect(first.update(frame(0)).tracks[0].id).toBe(1);
  expect(second.update(frame(0)).tracks[0].id).toBe(1);
  first.reset();
  expect(first.update(frame(0))).toMatchObject({ algorithm: 'ocsort', generation: 1, tracks: [{ id: 1 }] });
  first.dispose();
  expect(() => first.update(frame(1))).toThrowError(expect.objectContaining({ code: 'DISPOSED' }));
  expect(second.update(frame(100, [])).tracks[0]).toMatchObject({ id: 1, state: 'lost' });
});

test('OC-SORT 数值失败不提交时间、缺失历史或 ID', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, maxLostMs: 1e300, largeGapMs: 1e300 });
  tracker.update(frame(0));
  expect(() => tracker.update(frame(1e200, []))).toThrowError(expect.objectContaining({ code: 'NUMERICAL_FAILURE' }));
  expect(tracker.update(frame(100))).toMatchObject({ tracks: [{ id: 1, hits: 2, ageMs: 100 }] });
});
