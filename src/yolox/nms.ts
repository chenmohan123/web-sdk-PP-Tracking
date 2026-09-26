import type { Detection } from '../types';

export interface YoloxCandidate extends Detection {
  anchorIndex: number;
}

export interface YoloxNmsResult {
  candidates: YoloxCandidate[];
  droppedDetections: number;
}

function intersectionOverUnion(
  left: YoloxCandidate,
  right: YoloxCandidate,
): number {
  const x0 = Math.max(left.box.x, right.box.x);
  const y0 = Math.max(left.box.y, right.box.y);
  const x1 = Math.min(
    left.box.x + left.box.width,
    right.box.x + right.box.width,
  );
  const y1 = Math.min(
    left.box.y + left.box.height,
    right.box.y + right.box.height,
  );
  const intersection =
    Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union =
    left.box.width * left.box.height +
    right.box.width * right.box.height -
    intersection;

  return union > 0 ? intersection / union : 0;
}

export function greedyPersonNms(
  input: readonly YoloxCandidate[],
  nmsThreshold: number,
  maxDetections: number,
): YoloxNmsResult {
  if (
    !Number.isFinite(nmsThreshold) ||
    nmsThreshold < 0 ||
    nmsThreshold > 1 ||
    !Number.isInteger(maxDetections) ||
    maxDetections < 1 ||
    maxDetections > 1000
  ) {
    throw new RangeError('YOLOX NMS 选项无效');
  }

  const sorted = Array.from(input).sort(
    (left, right) =>
      right.score - left.score ||
      left.anchorIndex - right.anchorIndex,
  );
  const retained: YoloxCandidate[] = [];

  for (const candidate of sorted) {
    if (
      retained.some(
        selected =>
          intersectionOverUnion(selected, candidate) >
          nmsThreshold,
      )
    ) {
      continue;
    }

    retained.push(candidate);
  }

  return {
    candidates: retained.slice(0, maxDetections),
    droppedDetections: Math.max(
      0,
      retained.length - maxDetections,
    ),
  };
}
