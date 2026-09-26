import { describe, expect, it } from 'vitest';
import { runYoloxTrackingSequence } from './yolox-tracking-sequence.mjs';

const frames = [
  {
    id: 'first',
    timestampMs: 0,
    events: ['motion'],
    image: { width: 2, height: 1, data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
  },
  {
    id: 'second',
    timestampMs: 100,
    events: ['occlusion'],
    image: { width: 2, height: 1, data: new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]) },
  },
];

describe('YOLOX 到 ByteTrack 合成序列证据', () => {
  it('逐帧检测后更新 tracker 并生成稳定摘要', async () => {
    let generation = 0;
    const detector = {
      detect: async () => ({
        generation: generation++,
        detections: [{ box: { x: 1, y: 2, width: 3, height: 4 }, score: 0.5, classId: 1 }],
        droppedDetections: 2,
      }),
    };
    const updates: unknown[] = [];
    const tracker = {
      update: (frame: unknown) => {
        updates.push(frame);
        const timestampMs = (frame as { timestampMs: number }).timestampMs;
        return {
          generation: updates.length - 1,
          algorithm: 'bytetrack' as const,
          timestampMs,
          droppedDetections: 0,
          tracks: [{
            id: 7,
            classId: 1,
            state: 'tracked' as const,
            observed: true,
            score: 0.5,
            ageMs: timestampMs,
            hits: updates.length,
            missedMs: 0,
            box: { x: 1, y: 2, width: 3, height: 4 },
          }],
          removed: timestampMs === 100 ? [{
            id: 3,
            classId: 1,
            state: 'removed' as const,
            observed: false,
            score: null,
            ageMs: 100,
            hits: 1,
            missedMs: 100,
            box: { x: 0, y: 0, width: 1, height: 1 },
          }] : [],
        };
      },
    };
    const digest = async (value: string | Uint8Array) =>
      typeof value === 'string' ? `text:${value}` : `bytes:${Array.from(value).join(',')}`;

    const result = await runYoloxTrackingSequence({ frames, detector, tracker, digest });

    expect(updates).toEqual([
      {
        timestampMs: 0,
        imageSize: { width: 2, height: 1 },
        detections: detectorResult(0).detections,
      },
      {
        timestampMs: 100,
        imageSize: { width: 2, height: 1 },
        detections: detectorResult(1).detections,
      },
    ]);
    expect(result.frames).toMatchObject([
      {
        id: 'first',
        timestampMs: 0,
        events: ['motion'],
        image: { width: 2, height: 1, bytes: 8, sha256: 'bytes:1,2,3,4,5,6,7,8' },
        detectorGeneration: 0,
        detectionCount: 1,
        droppedDetections: 2,
        activeTrackIds: [7],
        observedTrackIds: [7],
        lostTrackIds: [],
        removedTrackIds: [],
      },
      {
        id: 'second',
        timestampMs: 100,
        events: ['occlusion'],
        image: { width: 2, height: 1, bytes: 8, sha256: 'bytes:8,7,6,5,4,3,2,1' },
        detectorGeneration: 1,
        detectionCount: 1,
        droppedDetections: 2,
        activeTrackIds: [7],
        observedTrackIds: [7],
        lostTrackIds: [],
        removedTrackIds: [3],
      },
    ]);
    expect(result.sequence).toEqual({
      frameCount: 2,
      detectionSha256: expect.stringContaining('text:'),
      trackingSha256: expect.stringContaining('text:'),
    });
  });

  it('使用注入的检测序列化器计算检测哈希', async () => {
    const digest = async (value: string | Uint8Array) =>
      typeof value === 'string' ? `text:${value}` : `bytes:${Array.from(value).join(',')}`;
    const detector = {
      detect: async () => ({
        generation: 0,
        detections: [
          { box: { x: 1, y: 2, width: 3, height: 4 }, score: 0.5, classId: 1 },
          { box: { x: 5, y: 6, width: 7, height: 8 }, score: 0.4, classId: 1 },
          { box: { x: 9, y: 10, width: 11, height: 12 }, score: 0.2, classId: 1 },
        ],
        droppedDetections: 0,
      }),
    };
    const tracker = {
      update: () => ({
        generation: 0,
        algorithm: 'bytetrack' as const,
        timestampMs: 0,
        droppedDetections: 0,
        tracks: [],
        removed: [],
      }),
    };

    const result = await runYoloxTrackingSequence({
      frames: [frames[0]],
      detector,
      tracker,
      digest,
      serializeDetections: () => 'unordered-bag',
    });

    expect(result.frames[0].detectionSha256).toBe('text:unordered-bag');
    expect(result.sequence.detectionSha256).toBe('text:text:unordered-bag');
    // 相邻间隔取最小正值：0.5-0.4 与 0.4-0.2 中前者更小（按 IEEE754 实际结果断言）。
    expect(result.frames[0].minimumAdjacentScoreGap).toBe(0.5 - 0.4);
  });

  it('单框或空框时不伪造分数间隔', async () => {
    const digest = async (value: string | Uint8Array) =>
      typeof value === 'string' ? `text:${value}` : `bytes:${Array.from(value).join(',')}`;
    const tracker = {
      update: () => ({
        generation: 0,
        algorithm: 'bytetrack' as const,
        timestampMs: 0,
        droppedDetections: 0,
        tracks: [],
        removed: [],
      }),
    };

    for (const detections of [
      [],
      [{ box: { x: 1, y: 2, width: 3, height: 4 }, score: 0.5, classId: 1 }],
    ]) {
      const result = await runYoloxTrackingSequence({
        frames: [frames[0]],
        detector: { detect: async () => ({ generation: 0, detections, droppedDetections: 0 }) },
        tracker,
        digest,
      });
      expect(result.frames[0].minimumAdjacentScoreGap).toBeNull();
    }
  });
});

function detectorResult(generation: number) {
  return {
    generation,
    detections: [{ box: { x: 1, y: 2, width: 3, height: 4 }, score: 0.5, classId: 1 }],
    droppedDetections: 2,
  };
}
