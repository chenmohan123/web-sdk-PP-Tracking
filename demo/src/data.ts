import type { Detection, TrackingFrame } from 'web-sdk-pp-tracking';

export const MAX_BYTES = 5 * 1024 * 1024;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;

// 仅做线性结构校验；导入不运行关联器，也不会更改当前回放。
export function parseSequence(value: unknown): TrackingFrame[] {
  const fail = (): never => { throw new Error('INVALID_SEQUENCE'); };
  if (!record(value) || !Array.isArray(value.frames) || value.frames.length < 1 || value.frames.length > 3000) return fail();
  let previous = -1;
  let size: TrackingFrame['imageSize'] | undefined;
  return value.frames.map(frame => {
    if (!record(frame) || !finite(frame.timestampMs) || frame.timestampMs < 0 || frame.timestampMs <= previous || !record(frame.imageSize)) return fail();
    const { width, height } = frame.imageSize;
    if (!positive(width) || !positive(height) || (size && (width !== size.width || height !== size.height))) return fail();
    if (!Array.isArray(frame.detections) || frame.detections.length > 100) return fail();
    const detections: Detection[] = frame.detections.map(d => {
      if (!record(d) || !finite(d.score) || d.score < 0 || d.score > 1 || !finite(d.classId) || !Number.isSafeInteger(d.classId) || d.classId < 0 || !record(d.box)) return fail();
      const { x, y, width: w, height: h } = d.box;
      if (!finite(x) || !finite(y) || x < 0 || y < 0 || !positive(w) || !positive(h) || w > width || h > height || x > width - w || y > height - h) return fail();
      return { box: { x, y, width: w, height: h }, score: d.score, classId: d.classId };
    });
    previous = frame.timestampMs; size = { width, height };
    return { timestampMs: frame.timestampMs, imageSize: { width, height }, detections };
  });
}

const box = (x: number, y: number, score = 0.92): Detection => ({ box: { x, y, width: 64, height: 80 }, score, classId: 0 });
const sequence = (kind: string): TrackingFrame[] => Array.from({ length: 40 }, (_, i) => ({
  timestampMs: i * 100, imageSize: { width: 640, height: 360 },
  detections: kind === 'occlusion' && i >= 12 && i <= 16 ? [] : kind === 'crossing'
    ? [box(80 + Math.min(i, 28) * 8 - Math.max(0, i - 28) * 8, 100), box(480 - i * 8, 135)]
    : [box(70 + i * 9, 140, kind === 'low' && i >= 6 && i <= 12 ? 0.25 : 0.92)],
}));
export const samples = { straight: sequence('straight'), low: sequence('low'), occlusion: sequence('occlusion'), crossing: sequence('crossing') };
export type Sample = keyof typeof samples;
