import { TrackingError } from '../errors';
import type { Detection } from '../types';
import { greedyPersonNms } from './nms';
import type { YoloxCandidate } from './nms';
import type { PreprocessedYoloxInput } from './types';

const CHANNELS = 85;
const LEVELS = [
  { gridSize: 52, stride: 8 },
  { gridSize: 26, stride: 16 },
  { gridSize: 13, stride: 32 },
] as const;
const ANCHORS = LEVELS.reduce(
  (sum, level) => sum + level.gridSize ** 2,
  0,
);

export interface YoloxDecodeOptions {
  scoreThreshold: number;
  nmsThreshold: number;
  maxDetections: number;
}

export interface YoloxDecodeResult {
  detections: Detection[];
  droppedDetections: number;
}

function invalid(message: string): never {
  throw new TrackingError('INVALID_INPUT', message);
}

function validate(
  output: Float32Array,
  metadata: PreprocessedYoloxInput,
  options: YoloxDecodeOptions,
): void {
  if (
    !(output instanceof Float32Array) ||
    output.length !== ANCHORS * CHANNELS
  ) {
    invalid('YOLOX 输出形状无效');
  }

  for (const value of output) {
    if (!Number.isFinite(value)) {
      invalid('YOLOX 输出包含非有限值');
    }
  }

  if (
    !metadata ||
    !Number.isFinite(metadata.scale) ||
    metadata.scale <= 0 ||
    !Number.isInteger(metadata.resizedWidth) ||
    !Number.isInteger(metadata.resizedHeight) ||
    metadata.resizedWidth <= 0 ||
    metadata.resizedHeight <= 0 ||
    metadata.resizedWidth > 416 ||
    metadata.resizedHeight > 416 ||
    !Number.isInteger(metadata.imageWidth) ||
    !Number.isInteger(metadata.imageHeight) ||
    metadata.imageWidth <= 0 ||
    metadata.imageHeight <= 0
  ) {
    invalid('YOLOX 预处理元数据无效');
  }

  if (
    !Number.isFinite(options.scoreThreshold) ||
    options.scoreThreshold < 0 ||
    options.scoreThreshold > 1
  ) {
    invalid('YOLOX 分数阈值无效');
  }
}

function clipBox(
  cx: number,
  cy: number,
  width: number,
  height: number,
  metadata: PreprocessedYoloxInput,
) {
  const x0 = Math.max(0, (cx - width / 2) / metadata.scale);
  const y0 = Math.max(0, (cy - height / 2) / metadata.scale);
  const x1 = Math.min(
    metadata.imageWidth,
    (cx + width / 2) / metadata.scale,
  );
  const y1 = Math.min(
    metadata.imageHeight,
    (cy + height / 2) / metadata.scale,
  );

  return {
    x: x0,
    y: y0,
    width: Math.max(0, x1 - x0),
    height: Math.max(0, y1 - y0),
  };
}

export function decodeYolox(
  output: Float32Array,
  metadata: PreprocessedYoloxInput,
  options: YoloxDecodeOptions,
): YoloxDecodeResult {
  validate(output, metadata, options);

  const candidates: YoloxCandidate[] = [];
  let levelOffset = 0;

  for (const level of LEVELS) {
    const levelAnchors = level.gridSize ** 2;

    for (let localIndex = 0; localIndex < levelAnchors; localIndex += 1) {
      const anchorIndex = levelOffset + localIndex;
      const offset = anchorIndex * CHANNELS;
      const score = output[offset + 4] * output[offset + 5];

      if (score < options.scoreThreshold) {
        continue;
      }

      const gridX = localIndex % level.gridSize;
      const gridY = Math.floor(localIndex / level.gridSize);
      const cx = (output[offset] + gridX) * level.stride;
      const cy = (output[offset + 1] + gridY) * level.stride;
      const width = Math.exp(output[offset + 2]) * level.stride;
      const height = Math.exp(output[offset + 3]) * level.stride;
      const box = clipBox(
        cx,
        cy,
        width,
        height,
        metadata,
      );

      if (box.width <= 0 || box.height <= 0) {
        continue;
      }

      candidates.push({
        anchorIndex,
        box,
        score,
        classId: 1,
      });
    }

    levelOffset += levelAnchors;
  }

  const nms = greedyPersonNms(
    candidates,
    options.nmsThreshold,
    options.maxDetections,
  );

  return {
    detections: nms.candidates.map(
      ({ anchorIndex: _anchorIndex, ...detection }) =>
        detection,
    ),
    droppedDetections: nms.droppedDetections,
  };
}
