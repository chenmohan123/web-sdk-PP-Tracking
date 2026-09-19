import { expect, test } from 'vitest';
import { createTracker } from '../src/index';
import { directionDifferenceRadians, interpolateObservationBox, observationCentres, ocmAssociationScore } from '../src/ocsort';

const detection = (score = 0.9, x = 20, classId = 0) => ({ box: { x, y: 20, width: 40, height: 40 }, score, classId });
const frame = (timestampMs: number, detections = [detection()]) => ({ timestampMs, imageSize: { width: 640, height: 480 }, detections });

test('工厂默认 ByteTrack、OC-SORT 身份和未知算法拒绝', () => {
  expect(createTracker({ minHits: 1 }).update(frame(0))).toMatchObject({ algorithm: 'bytetrack' });
  expect(createTracker({ algorithm: 'ocsort', minHits: 1 }).update(frame(0))).toMatchObject({ algorithm: 'ocsort' });
  expect(() => createTracker({ algorithm: 'unknown' as never })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
});

test('两种算法的专属参数互斥，OC-SORT 不接受 ByteTrack 低分续接参数', () => {
  expect(() => createTracker({ algorithm: 'ocsort', lowScoreThreshold: 0.1 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', lowMatchIouThreshold: 0.2 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'bytetrack', ocmWeight: 0.2 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', ocmWeight: 1.01 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', ocmHistoryLength: 1 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'ocsort', oruMaxReplaySteps: 61 })).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
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

test('OCR 用最后真实观测二轮恢复，虚拟观测不增加 hits 或 score', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, matchIouThreshold: 0.3 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  tracker.update(frame(100, [detection(0.9, 120)]));
  tracker.update(frame(200, []));
  expect(tracker.update(frame(300, [detection(0.9, 125)])).tracks).toMatchObject([
    { id: 1, state: 'tracked', hits: 3, observed: true, score: 0.9 },
  ]);
});

test('ORU 按实际缺失时间戳插值，缺失上限超出后结束轨迹', () => {
  expect(interpolateObservationBox({ x: 20, y: 20, width: 40, height: 40 }, { x: 80, y: 20, width: 40, height: 40 }, 250, 100, 400)).toEqual({ x: 50, y: 20, width: 40, height: 40 });
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, oruMaxReplaySteps: 2 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  tracker.update(frame(100, []));
  tracker.update(frame(275, []));
  expect(tracker.update(frame(400, []))).toMatchObject({ tracks: [], removed: [{ id: 1, state: 'removed' }] });
});

test('OC-SORT 恢复过程中的异常保持下一帧可提交', () => {
  const tracker = createTracker({ algorithm: 'ocsort', minHits: 1, oruMaxReplaySteps: 2 });
  tracker.update(frame(0, [detection(0.9, 100)]));
  tracker.update(frame(100, []));
  tracker.update(frame(200, []));
  expect(tracker.update(frame(300, [detection(0.9, 105)])).tracks[0]).toMatchObject({ id: 1, hits: 2 });
  expect(tracker.update(frame(400, [detection(0.9, 110)])).tracks[0]).toMatchObject({ id: 1, hits: 3 });
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
