import { describe, expect, it } from 'vitest';
import {
  greedyPersonNms,
  type YoloxCandidate,
} from '../src/yolox/nms';

function candidate(
  anchorIndex: number,
  score: number,
  x: number,
  width = 10,
): YoloxCandidate {
  return {
    anchorIndex,
    score,
    classId: 1,
    box: { x, y: 0, width, height: 10 },
  };
}

function iou(a: YoloxCandidate, b: YoloxCandidate): number {
  const left = Math.max(a.box.x, b.box.x);
  const right = Math.min(
    a.box.x + a.box.width,
    b.box.x + b.box.width,
  );
  const intersection =
    Math.max(0, right - left) * 10;
  const union =
    a.box.width * 10 + b.box.width * 10 - intersection;
  return intersection / union;
}

describe('YOLOX 单类 NMS', () => {
  it('仅在 IoU 严格大于阈值时抑制', () => {
    const first = candidate(0, 0.9, 0);
    const equal = candidate(1, 0.8, 10 / 3);
    const threshold = iou(first, equal);

    expect(
      greedyPersonNms([first, equal], threshold, 10)
        .candidates,
    ).toHaveLength(2);

    const over = candidate(2, 0.7, 10 / 3 - 0.001);
    expect(
      greedyPersonNms([first, over], threshold, 10)
        .candidates,
    ).toEqual([first]);
  });

  it('按分数降序并以 anchor index 升序打平', () => {
    const result = greedyPersonNms(
      [
        candidate(9, 0.8, 40),
        candidate(3, 0.8, 20),
        candidate(1, 0.9, 0),
      ],
      0.7,
      10,
    );

    expect(
      result.candidates.map(value => value.anchorIndex),
    ).toEqual([1, 3, 9]);
  });

  it('只统计 NMS 后的容量截断', () => {
    const suppressed = candidate(1, 0.8, 0.001);
    const result = greedyPersonNms(
      [
        candidate(0, 0.9, 0),
        suppressed,
        candidate(2, 0.7, 20),
        candidate(3, 0.6, 40),
      ],
      0.7,
      2,
    );

    expect(
      result.candidates.map(value => value.anchorIndex),
    ).toEqual([0, 2]);
    expect(result.droppedDetections).toBe(1);
  });
});
