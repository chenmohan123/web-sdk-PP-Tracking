import { describe, expect, it } from 'vitest';
import {
  serializeTrackingResult,
  serializeYoloxDetections,
  serializeYoloxDetectionsUnordered,
} from './yolox-serialization.mjs';

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function result(box: Box, score: number) {
  return {
    droppedDetections: 1556,
    detections: [
      {
        box,
        score,
        classId: 1,
      },
    ],
  };
}

describe('serializeYoloxDetections', () => {
  // 数值为手工构造的跨运行时尾差样本，非取自某个留档证据；这里只固定规范化口径本身。
  it('normalizes sub-picometer cross-runtime float differences', () => {
    const nodeResult = result(
      {
        x: 3.8110246547162117,
        y: 2.7164737137038757,
        width: 319.66773249753305,
        height: 143.87481057685676,
      },
      0.000003609597921894192,
    );
    const chromiumResult = result(
      {
        x: 3.8110246547162006,
        y: 2.7164737137038757,
        width: 319.66773249753305,
        height: 143.87481057685673,
      },
      0.000003609597921894191,
    );

    expect(serializeYoloxDetections(nodeResult)).toBe(
      serializeYoloxDetections(chromiumResult),
    );
  });

  it('preserves differences larger than the canonical precision', () => {
    const baseline = result(
      {
        x: 3.8110246547162,
        y: 2.7164737137039,
        width: 319.667732497533,
        height: 143.874810576857,
      },
      0.000003609597921894,
    );
    const changed = result(
      {
        ...baseline.detections[0].box,
        x: baseline.detections[0].box.x + 0.000001,
      },
      baseline.detections[0].score,
    );

    expect(serializeYoloxDetections(baseline)).not.toBe(
      serializeYoloxDetections(changed),
    );
  });
});

describe('serializeYoloxDetectionsUnordered', () => {
  const first = {
    box: { x: 1, y: 2, width: 3, height: 4 },
    score: 0.0000037326851343166823,
    classId: 1,
  };
  const second = {
    box: { x: 5, y: 6, width: 7, height: 8 },
    score: 0.0000037324888806367085,
    classId: 1,
  };

  it('is insensitive to near-tie ordering flips across runtimes', () => {
    expect(serializeYoloxDetectionsUnordered({ droppedDetections: 1736, detections: [first, second] })).toBe(
      serializeYoloxDetectionsUnordered({ droppedDetections: 1736, detections: [second, first] }),
    );
    expect(serializeYoloxDetections({ droppedDetections: 1736, detections: [first, second] })).not.toBe(
      serializeYoloxDetections({ droppedDetections: 1736, detections: [second, first] }),
    );
  });

  it('keeps duplicate detections as a bag instead of a set', () => {
    expect(serializeYoloxDetectionsUnordered({ droppedDetections: 0, detections: [first, first] })).not.toBe(
      serializeYoloxDetectionsUnordered({ droppedDetections: 0, detections: [first] }),
    );
  });

  it('still reports value changes beyond canonical precision', () => {
    expect(serializeYoloxDetectionsUnordered({ droppedDetections: 0, detections: [first] })).not.toBe(
      serializeYoloxDetectionsUnordered({
        droppedDetections: 0,
        detections: [{ ...first, box: { ...first.box, x: first.box.x + 1e-6 } }],
      }),
    );
    expect(serializeYoloxDetectionsUnordered({ droppedDetections: 0, detections: [first] })).not.toBe(
      serializeYoloxDetectionsUnordered({ droppedDetections: 1, detections: [first] }),
    );
  });
});

describe('serializeTrackingResult', () => {
  it('omits runtime timings and canonicalizes track boxes', () => {
    const baseline = {
      generation: 2,
      algorithm: 'bytetrack',
      timestampMs: 100,
      droppedDetections: 0,
      tracks: [
        {
          id: 1,
          classId: 1,
          state: 'tracked' as const,
          observed: true,
          score: 0.9876543210987654,
          ageMs: 100,
          hits: 2,
          missedMs: 0,
          box: {
            x: 10.12345678901234,
            y: 20.12345678901234,
            width: 30.12345678901234,
            height: 40.12345678901234,
          },
        },
      ],
      removed: [],
      runtime: { actualBackend: 'cpu' },
      timings: { totalMs: 1 },
    };
    const changedOnlyOutsideEvidence = {
      ...baseline,
      tracks: [
        {
          ...baseline.tracks[0],
          score: baseline.tracks[0].score + 1e-14,
          box: {
            ...baseline.tracks[0].box,
            x: baseline.tracks[0].box.x + 1e-14,
          },
        },
      ],
      timings: { totalMs: 999 },
    };

    expect(serializeTrackingResult(baseline)).toBe(
      serializeTrackingResult(changedOnlyOutsideEvidence),
    );
    expect(serializeTrackingResult(baseline)).not.toContain('timings');
    expect(serializeTrackingResult(baseline)).not.toContain('runtime');
  });
});
