import { describe, expect, it } from 'vitest';
import { DEMO_DEFAULT_OPTIONS, MAX_BYTES, optionsFrom, parseSequence, prepareSequence, samples, serializeSequence, SYNTHETIC_FEATURE_SPACE } from '../demo/src/data';
import type { TrackingFrame } from '../src/types';
import { Playback } from '../demo/src/playback';

const appearanceSequence = (count: number, dimension: number, id: string): TrackingFrame[] => {
  const embedding = Array<number>(dimension).fill(0);
  embedding[0] = 1;
  return Array.from({ length: count }, (_, timestampMs) => ({
    timestampMs,
    imageSize: { width: 100, height: 100 },
    featureSpaceId: id,
    detections: [{ box: { x: 1, y: 1, width: 20, height: 20 }, score: 0.9, classId: 0, embedding }],
  }));
};

describe('Demo 数据与回放', () => {
  it('原创示例都满足输入结构，低分和遮挡确实出现', () => {
    for (const frames of Object.values(samples)) expect(parseSequence({ frames })).toEqual(frames);
    expect(samples.low.some(f => f.detections.some(d => d.score === 0.25))).toBe(true);
    expect(samples.occlusion.some(f => f.detections.length === 0)).toBe(true);
  });
  it('拒绝结构、时钟、尺寸、分数、类别、框和配额错误', () => {
    const good = samples.straight.slice(0, 2);
    for (const bad of [null, [], {}, { frames: [] }, { frames: Array(3001).fill(good[0]) },
      { frames: [good[0], good[0]] }, { frames: [{ ...good[0], timestampMs: Infinity }] },
      { frames: [good[0], { ...good[1], imageSize: { width: 1, height: 1 } }] },
      ...[{ score: -1 }, { classId: 0.5 }, { box: { x: 639, y: 0, width: 2, height: 1 } }].map(patch => ({ frames: [{ ...good[0], detections: [{ ...good[0].detections[0], ...patch }] }] })),
      { frames: [{ ...good[0], detections: Array(101).fill(good[0].detections[0]) }] }]) expect(() => parseSequence(bad)).toThrow();
  });
  it('完整校验3000帧而不进行跟踪计算', () => {
    expect(parseSequence({ frames: Array.from({ length: 3000 }, (_, i) => ({ ...samples.straight[0], timestampMs: i })) })).toHaveLength(3000);
  });
  it('准备带外观的包装对象并深复制特征空间、帧和向量', async () => {
    const embedding = [3, 4];
    const value = {
      featureSpace: { id: 'imported-appearance-v1', dimension: 2 },
      frames: [{ timestampMs: 7, imageSize: { width: 100, height: 80 }, featureSpaceId: 'imported-appearance-v1', detections: [{ box: { x: 1, y: 2, width: 10, height: 20 }, score: 0.9, classId: 3, embedding }] }],
    };
    const prepared = await prepareSequence(value, 'deepsort', { algorithm: 'deepsort', minHits: 1 });
    expect(prepared.featureSpace).toEqual({ id: 'imported-appearance-v1', dimension: 2 });
    expect(prepared.featureSpace).not.toBe(value.featureSpace);
    expect(prepared.frames[0]).not.toBe(value.frames[0]);
    expect(prepared.frames[0].detections[0].embedding).toEqual([3, 4]);
    expect(prepared.frames[0].detections[0].embedding).not.toBe(embedding);
    expect(prepared.options).toMatchObject({ algorithm: 'deepsort', featureSpace: { id: 'imported-appearance-v1', dimension: 2 }, minHits: 1 });
  });
  it('紧凑导出千帧512维输入并可按相同特征空间重新准备', async () => {
    const featureSpace = { id: 'review-roundtrip-512d', dimension: 512 };
    const frames = appearanceSequence(1000, featureSpace.dimension, featureSpace.id);
    frames[0].detections[0].embedding = new Float32Array(frames[0].detections[0].embedding!);
    const oldReport = JSON.stringify({ featureSpace, frames, results: [] }, null, 2);
    expect(new TextEncoder().encode(oldReport).byteLength).toBeGreaterThan(MAX_BYTES);

    const serialized = serializeSequence(frames, featureSpace);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(MAX_BYTES);
    const exported = JSON.parse(serialized);
    expect(Array.isArray(exported.frames[0].detections[0].embedding)).toBe(true);
    const prepared = await prepareSequence(exported, 'deepsort', { algorithm: 'deepsort', minHits: 1, gallerySize: 1 });
    expect(prepared.featureSpace).toEqual(featureSpace);
    expect(prepared.frames).toHaveLength(frames.length);
    expect(prepared.frames[0].timestampMs).toBe(0);
    expect(prepared.frames.at(-1)?.timestampMs).toBe(999);
    expect(prepared.frames[0].detections[0].embedding).toEqual(Array.from(frames[0].detections[0].embedding!));
    expect(prepared.frames.at(-1)?.detections[0].embedding).toEqual(frames.at(-1)?.detections[0].embedding);
  });
  it('按UTF-8字节限制紧凑序列，并在规范化输入超限时保留现有会话', async () => {
    const asciiSpace = { id: 'near-limit', dimension: 2048 };
    let low = 1;
    let high = 3000;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const bytes = new TextEncoder().encode(JSON.stringify({ featureSpace: asciiSpace, frames: appearanceSequence(middle, asciiSpace.dimension, asciiSpace.id) })).byteLength;
      if (bytes <= MAX_BYTES) low = middle;
      else high = middle - 1;
    }
    const nearLimitFrames = appearanceSequence(low, asciiSpace.dimension, asciiSpace.id);
    const nearLimit = serializeSequence(nearLimitFrames, asciiSpace);
    expect(new TextEncoder().encode(nearLimit).byteLength).toBeLessThanOrEqual(MAX_BYTES);
    expect(new TextEncoder().encode(JSON.stringify({ featureSpace: asciiSpace, frames: appearanceSequence(low + 1, asciiSpace.dimension, asciiSpace.id) })).byteLength).toBeGreaterThan(MAX_BYTES);
    expect(JSON.parse(nearLimit).frames.at(-1).timestampMs).toBe(low - 1);

    const multibyteSpace = { id: '界'.repeat(256), dimension: 512 };
    const oversizedFrames = appearanceSequence(3000, multibyteSpace.dimension, multibyteSpace.id);
    const compact = JSON.stringify({ featureSpace: multibyteSpace, frames: oversizedFrames });
    expect(compact.length).toBeLessThan(MAX_BYTES);
    expect(new TextEncoder().encode(compact).byteLength).toBeGreaterThan(MAX_BYTES);
    expect(() => serializeSequence(oversizedFrames, multibyteSpace)).toThrow('FILE_TOO_LARGE');

    const playback = new Playback(samples.straight);
    playback.step();
    const previousResults = playback.results;
    const previousStartedAt = playback.startedAt;
    await expect(prepareSequence({ featureSpace: multibyteSpace, frames: oversizedFrames }, 'deepsort', { algorithm: 'deepsort', gallerySize: 1 })).rejects.toThrow('FILE_TOO_LARGE');
    expect(playback.results).toBe(previousResults);
    expect(playback.startedAt).toBe(previousStartedAt);
    expect(playback.index).toBe(0);
    playback.dispose();
  });
  it('完整验证在非法末帧失败，且不改变此前回放结果和时间', async () => {
    const playback = new Playback(samples.straight);
    playback.step();
    const previousResults = playback.results;
    const previousStartedAt = playback.startedAt;
    const bad = {
      featureSpace: SYNTHETIC_FEATURE_SPACE,
      frames: [...samples.straight.slice(0, 2), { ...samples.straight[2], featureSpaceId: 'wrong-space' }],
    };
    await expect(prepareSequence(bad, 'deepsort', { algorithm: 'deepsort' })).rejects.toThrow();
    expect(playback.results).toBe(previousResults);
    expect(playback.startedAt).toBe(previousStartedAt);
    expect(playback.index).toBe(0);
    playback.dispose();
  });
  it('旧的无向量 {frames} 包装仍可供 ByteTrack 使用', async () => {
    const frames = [{ timestampMs: 0, imageSize: { width: 20, height: 20 }, detections: [{ box: { x: 1, y: 1, width: 2, height: 2 }, score: 0.9, classId: 0 }] }];
    const prepared = await prepareSequence({ frames }, 'bytetrack', { algorithm: 'bytetrack', minHits: 1 });
    expect(prepared.featureSpace).toBeUndefined();
    expect(prepared.frames).toEqual(frames);
  });
  it('从全部帧的一致标识与向量推导内置合成特征空间', async () => {
    const prepared = await prepareSequence({ frames: samples.crossing }, 'deepsort', DEMO_DEFAULT_OPTIONS.deepsort);
    expect(prepared.featureSpace).toEqual(SYNTHETIC_FEATURE_SPACE);
    expect(prepared.options).toMatchObject({ algorithm: 'deepsort', featureSpace: SYNTHETIC_FEATURE_SPACE, maxCosineDistance: 0.2, gallerySize: 30 });
  });
  it('三种算法都能用各自默认配置完整准备内置样例', async () => {
    for (const algorithm of ['bytetrack', 'ocsort', 'deepsort'] as const) {
      const prepared = await prepareSequence({ featureSpace: SYNTHETIC_FEATURE_SPACE, frames: samples.straight }, algorithm, DEMO_DEFAULT_OPTIONS[algorithm]);
      expect(prepared.options.algorithm).toBe(algorithm);
      if (algorithm !== 'deepsort') expect(prepared.options).not.toHaveProperty('featureSpace');
    }
  });
  it('Demo 参数映射不会把其他算法专用字段带入 tracker', async () => {
    const drafts = { lowScoreThreshold: '0.1', highScoreThreshold: '0.5', newTrackThreshold: '0.6', minHits: '2', maxLostMs: '1000', ocmWeight: '0.2', ocmDeltaMs: '300', ocmHistoryLength: '30', oruMaxReplaySteps: '30', maxCosineDistance: '0.2', gallerySize: '30' };
    for (const algorithm of ['bytetrack', 'ocsort', 'deepsort'] as const) {
      const options = optionsFrom(algorithm, drafts, SYNTHETIC_FEATURE_SPACE);
      await expect(prepareSequence({ featureSpace: SYNTHETIC_FEATURE_SPACE, frames: samples.straight }, algorithm, options)).resolves.toMatchObject({ options: { algorithm } });
    }
  });
  it('没有可推导向量时拒绝 DeepSORT 且不补造 embedding', async () => {
    const empty = { frames: [{ timestampMs: 0, imageSize: { width: 20, height: 20 }, featureSpaceId: 'empty-v1', detections: [] }] };
    const legacy = { frames: [{ timestampMs: 0, imageSize: { width: 20, height: 20 }, featureSpaceId: 'legacy-v1', detections: [{ box: { x: 1, y: 1, width: 2, height: 2 }, score: 0.9, classId: 0 }] }] };
    await expect(prepareSequence(empty, 'deepsort', { algorithm: 'deepsort' })).rejects.toThrow();
    await expect(prepareSequence(legacy, 'deepsort', { algorithm: 'deepsort' })).rejects.toThrow();
    expect(legacy.frames[0].detections[0]).not.toHaveProperty('embedding');
  });
  it('回放保持记录时间，seek复位并重算，复位清空导出', () => {
    const p = new Playback(samples.low);
    expect(p.options).toEqual(DEMO_DEFAULT_OPTIONS.bytetrack);
    p.step(); p.step();
    expect(p.results.map(r => r.timestampMs)).toEqual([0, 100]);
    p.seek(6);
    expect(p.results).toHaveLength(7);
    expect(p.results[6].tracks[0]).toMatchObject({ id: 1, score: 0.25, observed: true });
    expect(p.results[0].generation).toBe(1);
    p.reset(); expect(p.results).toEqual([]); expect(p.index).toBe(-1);
    p.dispose();
  });
  it('错误参数保留当前结果，合法参数开启新实例', () => {
    const p = new Playback(samples.straight); p.step();
    const before = p.results;
    expect(() => p.configure({ highScoreThreshold: 0.05 })).toThrow();
    expect(p.results).toBe(before); expect(p.index).toBe(0);
    p.configure({ minHits: 1 }); expect(p.results).toEqual([]);
    p.step(); expect(p.results[0].tracks[0].state).toBe('tracked');
    p.dispose();
  });
});
