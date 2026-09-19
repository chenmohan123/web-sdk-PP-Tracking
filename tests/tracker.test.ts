import { expect, test } from 'vitest';
import { createTracker } from '../src/index';

const detection = (score = 0.9, x = 20, classId = 0) => ({ box: { x, y: 20, width: 40, height: 80 }, score, classId });
const frame = (timestampMs: number, detections = [detection()]) => ({ timestampMs, imageSize: { width: 640, height: 480 }, detections });

test('实例私有 ID、reset 代次与严格时间戳', () => {
  const a = createTracker({ minHits: 1 }), b = createTracker({ minHits: 1 });
  expect(a.update(frame(0)).tracks[0].id).toBe(1);
  expect(b.update(frame(0)).tracks[0].id).toBe(1);
  expect(() => a.update(frame(0))).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  a.reset();
  expect(a.update(frame(0))).toMatchObject({ generation: 1, tracks: [{ id: 1 }] });
});
test('tentative 连续命中确认，失配只报告一次移除', () => {
  const a = createTracker();
  expect(a.update(frame(0)).tracks[0]).toMatchObject({ state: 'tentative', hits: 1 });
  expect(a.update(frame(100)).tracks[0]).toMatchObject({ state: 'tracked', hits: 2 });
  const b = createTracker(); b.update(frame(0));
  expect(b.update(frame(100, [])).removed).toMatchObject([{ id: 1, state: 'removed', observed: false, score: null }]);
  expect(b.update(frame(200, [])).removed).toEqual([]);
});
test('tracked 可低分连续恢复，lost 不允许低分恢复', () => {
  const a = createTracker({ minHits: 1 }); a.update(frame(0));
  expect(a.update(frame(100, [detection(0.1)])).tracks[0]).toMatchObject({ state: 'tracked', observed: true, score: 0.1 });
  expect(a.update(frame(200, [])).tracks[0]).toMatchObject({ state: 'lost', observed: false, score: null, missedMs: 100 });
  expect(a.update(frame(300, [detection(0.4)])).tracks[0]).toMatchObject({ state: 'lost', observed: false });
  expect(a.update(frame(400)).tracks[0]).toMatchObject({ id: 1, state: 'tracked', hits: 3 });
});
test('超时在匹配前移除，等于上限仍可恢复', () => {
  const a = createTracker({ minHits: 1 }); a.update(frame(0)); a.update(frame(500, []));
  expect(a.update(frame(1000)).tracks[0].id).toBe(1);
  a.update(frame(1100, []));
  expect(a.update(frame(2001))).toMatchObject({ removed: [{ id: 1 }], tracks: [{ id: 2 }] });
});
test('大间隔直接移除且不复用同代 ID', () => {
  const a = createTracker({ minHits: 1 }); a.update(frame(0));
  expect(a.update(frame(2001))).toMatchObject({ removed: [{ id: 1 }], tracks: [{ id: 2, hits: 1, ageMs: 0 }] });
});
test('类别严格隔离且容量不足不驱逐原轨迹', () => {
  const a = createTracker({ minHits: 1, maxTracks: 1 }); a.update(frame(0));
  expect(a.update(frame(100, [detection(0.9, 20, 1)]))).toMatchObject({ droppedDetections: 1, tracks: [{ id: 1, classId: 0, state: 'lost' }] });
});
test('低分不创建，high 与 new 边界包含等号', () => {
  const a = createTracker();
  expect(a.update(frame(0, [detection(0.59)])).tracks).toEqual([]);
  expect(a.update(frame(1, [detection(0.6)])).tracks).toHaveLength(1);
  expect(a.update(frame(2, [detection(0.5)])).tracks[0].state).toBe('tracked');
});
test('配置非法值稳定拒绝', () => {
  for (const options of [{ minHits: 0 }, { minHits: 101 }, { maxTracks: 501 }, { maxDetections: 1.2 }, { lowScoreThreshold: 0.7 }, { newTrackThreshold: 0.4 }, { largeGapMs: 10 }, { maxLostMs: Infinity }, { matchIouThreshold: -1 }, { toString: 0 }, null]) {
    expect(() => createTracker(options as any)).toThrowError(expect.objectContaining({ code: 'INVALID_OPTIONS' }));
  }
});
test('所有非法输入失败不推进时钟或 ID', () => {
  const a = createTracker({ minHits: 1, maxDetections: 1 });
  const invalid = [null, frame(-1), frame(NaN), frame(0, [detection(-0.1)]), frame(0, [detection(1.1)]), frame(0, [detection(0.8, -1)]), frame(0, [detection(0.8, 620)]), frame(0, [detection(0.8, 1, 0.5)]), frame(0, [detection(), detection()]), { ...frame(0), imageSize: { width: 0, height: 480 } }, { ...frame(0), detections: [{}] }];
  for (const input of invalid) expect(() => a.update(input as any)).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(a.update(frame(0)).tracks[0].id).toBe(1);
  expect(() => a.update({ ...frame(1), imageSize: { width: 1000, height: 480 } })).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(a.update(frame(1)).tracks[0].hits).toBe(2);
});
test('输入、结果及 runtime 均与内部状态引用隔离', () => {
  const a = createTracker({ minHits: 1 }); const input = frame(0); const out = a.update(input);
  input.detections[0].box.x = 500; input.imageSize.width = 100;
  out.tracks[0].box.x = 400; out.tracks[0].id = 99; (out.runtime as any).actualBackend = 'webgpu';
  expect(a.update(frame(100, [])).tracks[0]).toMatchObject({ id: 1, box: { x: 20 } });
  expect(a.update(frame(200, [])).runtime.actualBackend).toBe('cpu');
});

test('数值失败不提交时钟、轨迹或 ID，随后正常帧仍可继续', () => {
  const a = createTracker({ minHits: 1, maxLostMs: 1e300, largeGapMs: 1e300 });
  a.update(frame(0));
  expect(() => a.update(frame(1e200))).toThrowError(expect.objectContaining({ code: 'NUMERICAL_FAILURE' }));
  expect(a.update(frame(100))).toMatchObject({ tracks: [{ id: 1, hits: 2, ageMs: 100 }] });
});

test('tentative 不使用低分确认，低于 low 的观测不能维持 tracked', () => {
  const a = createTracker(); a.update(frame(0));
  expect(a.update(frame(1, [detection(0.49)]))).toMatchObject({ tracks: [], removed: [{ id: 1 }] });
  const b = createTracker({ minHits: 1 }); b.update(frame(0));
  expect(b.update(frame(1, [detection(0.099)]))).toMatchObject({ tracks: [{ state: 'lost', observed: false }] });
});

test('图像边界框合法、500容量可接收，超限整帧拒绝', () => {
  const a = createTracker({ minHits: 1, maxDetections: 500, maxTracks: 500 });
  const detections = Array.from({ length: 500 }, (_, classId) => detection(1, 600, classId));
  expect(a.update(frame(0, detections)).tracks).toHaveLength(500);
  expect(() => a.update(frame(1, [...detections, detection()]))).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
});
test('开始前取消不改变状态，释放幂等并稳定拒绝后续操作', () => {
  const a = createTracker({ minHits: 1 }); const ctrl = new AbortController(); ctrl.abort();
  expect(() => a.update(frame(0), { signal: ctrl.signal })).toThrowError(expect.objectContaining({ code: 'ABORTED' }));
  expect(a.update(frame(0)).tracks[0].id).toBe(1);
  a.dispose(); a.dispose();
  expect(() => a.update(frame(1))).toThrowError(expect.objectContaining({ code: 'DISPOSED' }));
  expect(() => a.reset()).toThrowError(expect.objectContaining({ code: 'DISPOSED' }));
});
test('结果准确声明 CPU/main 与五项非负有限耗时', () => {
  const out = createTracker().update(frame(0));
  expect(out.runtime).toEqual({ requestedBackend: 'cpu', actualBackend: 'cpu', executionMode: 'main', runtimeVersion: 'web-sdk-pp-tracking@0.1.0' });
  expect(Object.keys(out.timings).sort()).toEqual(['associationMs', 'predictionMs', 'totalMs', 'updateMs', 'validationMs']);
  for (const value of Object.values(out.timings)) expect(Number.isFinite(value) && (value as number) >= 0).toBe(true);
});

test('IoU门限1保留相同框ID，但不会关联不同框', () => {
  const a = createTracker({ minHits: 1, matchIouThreshold: 1 });
  const input = { box: { x: 100, y: 100, width: 20, height: 20 }, score: 0.9, classId: 0 };
  expect(a.update(frame(0, [input])).tracks[0].id).toBe(1);
  expect(a.update(frame(100, [input])).tracks).toMatchObject([{ id: 1, state: 'tracked', hits: 2 }]);
  expect(a.update(frame(200, [{ ...input, box: { ...input.box, x: 101 } }])).tracks).toMatchObject([
    { id: 1, state: 'lost' }, { id: 2, state: 'tracked', hits: 1 },
  ]);
});
