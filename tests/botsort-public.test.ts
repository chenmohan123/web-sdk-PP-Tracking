import { expect, test } from 'vitest';
import { createTracker, type BoTSortTracker, type Tracker } from '../src/index.js';

// 仅供 tsc 验证：不能用旧 Tracker 注解绕过运动帧的必填契约。
function checkTrackerAssignment(tracker: BoTSortTracker) {
  // @ts-expect-error 普通 Tracker 接受无 motion 帧，不能接收 BoT-SORT 实例。
  const ordinary: Tracker = tracker;
  void ordinary;
}
void checkTrackerAssignment;

test('根入口公开创建 BoT-SORT 并拒绝普通帧契约', () => {
  const tracker = createTracker({ algorithm: 'botsort', minHits: 1 });
  const frame = { frameId: 0, timestampMs: 0, imageSize: { width: 640, height: 360 }, detections: [], motion: { status: 'initial' as const, from: null, to: { frameId: 0, timestampMs: 0 } } };
  expect(tracker.update(frame).algorithm).toBe('botsort');
  expect(() => tracker.update({ ...frame, frameId: 1, timestampMs: 100 })).toThrow();
});

test('根工厂分派三种旧算法并拒绝非法工厂输入', () => {
  for (const algorithm of ['bytetrack', 'ocsort', 'deepsort'] as const) {
    const options = algorithm === 'deepsort' ? { algorithm, featureSpace: { id: 'x', dimension: 2 }, minHits: 1 } : { algorithm, minHits: 1 };
    const frame = { timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [], ...(algorithm === 'deepsort' ? { featureSpaceId: 'x' } : {}) };
    expect(createTracker(options).update(frame).algorithm).toBe(algorithm);
  }
  expect(() => createTracker([] as never)).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  expect(() => createTracker({ algorithm: 'unknown' } as never)).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  const hidden = { algorithm: 'botsort' } as Record<string, unknown>;
  Object.defineProperty(hidden, 'typo', { value: true });
  expect(() => createTracker(hidden as never)).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
});

test('BoT-SORT 平移、外观选项和错误帧不推进状态', () => {
  const tracker = createTracker({ algorithm: 'botsort', minHits: 1 });
  const first = { frameId: 0, timestampMs: 0, imageSize: { width: 640, height: 360 }, detections: [{ box: { x: 10, y: 10, width: 20, height: 20 }, score: 1, classId: 0 }], motion: { status: 'initial' as const, from: null, to: { frameId: 0, timestampMs: 0 } } };
  expect(tracker.update(first).tracks[0].id).toBe(1);
  expect(() => tracker.update({ ...first, frameId: 1, timestampMs: 100 })).toThrow();
  const moved = { ...first, frameId: 1, timestampMs: 100, motion: { status: 'estimated' as const, from: { frameId: 0, timestampMs: 0 }, to: { frameId: 1, timestampMs: 100 }, matrix: [1, 0, 2, 0, 1, 0] as const, source: 'test', confidence: 1 } };
  expect(tracker.update(moved).tracks[0].id).toBe(1);
  const appearance = createTracker({ algorithm: 'botsort', minHits: 1, appearance: { featureSpace: { id: 'reid', dimension: 2 } } });
  const appearanceFrame = { ...first, featureSpaceId: 'reid', detections: [{ ...first.detections[0], embedding: [1, 0] }] };
  appearance.update(appearanceFrame);
  expect(appearance.update({ ...appearanceFrame, frameId: 1, timestampMs: 100, motion: { status: 'identity' as const, from: { frameId: 0, timestampMs: 0 }, to: { frameId: 1, timestampMs: 100 } } }).tracks[0].id).toBe(1);
});
