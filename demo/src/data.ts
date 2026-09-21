import { createTracker, type Detection, type FeatureSpace, type TrackerAlgorithm, type TrackerOptions, type TrackingFrame } from 'web-sdk-pp-tracking';

export const MAX_BYTES = 5 * 1024 * 1024;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;

export const SYNTHETIC_FEATURE_SPACE: FeatureSpace = {
  id: 'pp-tracking-demo-synthetic-appearance-v1-original-vectors',
  dimension: 4,
};

export type DemoParameterKey = 'lowScoreThreshold' | 'highScoreThreshold' | 'newTrackThreshold' | 'minHits' | 'maxLostMs' | 'ocmWeight' | 'ocmDeltaMs' | 'ocmHistoryLength' | 'oruMaxReplaySteps' | 'maxCosineDistance' | 'gallerySize';
export type DemoParameterDraft = Record<DemoParameterKey, string>;
export const DEMO_DEFAULT_PARAMETERS: DemoParameterDraft = {
  lowScoreThreshold: '0.1', highScoreThreshold: '0.5', newTrackThreshold: '0.6', minHits: '2', maxLostMs: '1000',
  ocmWeight: '0.2', ocmDeltaMs: '300', ocmHistoryLength: '30', oruMaxReplaySteps: '30', maxCosineDistance: '0.2', gallerySize: '30',
};
const defaultValue = (key: DemoParameterKey) => Number(DEMO_DEFAULT_PARAMETERS[key]);

const sharedOptions = {
  highScoreThreshold: defaultValue('highScoreThreshold'),
  newTrackThreshold: defaultValue('newTrackThreshold'),
  minHits: defaultValue('minHits'),
  matchIouThreshold: 0.3,
  maxLostMs: defaultValue('maxLostMs'),
  largeGapMs: 2000,
  maxDetections: 100,
  maxTracks: 200,
};

export const DEMO_DEFAULT_OPTIONS: Record<TrackerAlgorithm, TrackerOptions> = {
  bytetrack: { algorithm: 'bytetrack', ...sharedOptions, lowScoreThreshold: defaultValue('lowScoreThreshold'), lowMatchIouThreshold: 0.2 },
  ocsort: { algorithm: 'ocsort', ...sharedOptions, ocmWeight: defaultValue('ocmWeight'), ocmDeltaMs: defaultValue('ocmDeltaMs'), ocmHistoryLength: defaultValue('ocmHistoryLength'), oruMaxReplaySteps: defaultValue('oruMaxReplaySteps') },
  deepsort: { algorithm: 'deepsort', ...sharedOptions, featureSpace: { ...SYNTHETIC_FEATURE_SPACE }, maxCosineDistance: defaultValue('maxCosineDistance'), gallerySize: defaultValue('gallerySize') },
};

export function optionsFrom(algorithm: TrackerAlgorithm, parameters: DemoParameterDraft, featureSpace?: FeatureSpace): TrackerOptions {
  const value = (key: DemoParameterKey) => parameters[key].trim() === '' ? NaN : Number(parameters[key]);
  const shared = { ...DEMO_DEFAULT_OPTIONS[algorithm], algorithm, highScoreThreshold: value('highScoreThreshold'), newTrackThreshold: value('newTrackThreshold'), minHits: value('minHits'), maxLostMs: value('maxLostMs') };
  if (algorithm === 'bytetrack') return { ...shared, lowScoreThreshold: value('lowScoreThreshold') };
  if (algorithm === 'ocsort') return { ...shared, ocmWeight: value('ocmWeight'), ocmDeltaMs: value('ocmDeltaMs'), ocmHistoryLength: value('ocmHistoryLength'), oruMaxReplaySteps: value('oruMaxReplaySteps') };
  return { ...shared, featureSpace: featureSpace ?? SYNTHETIC_FEATURE_SPACE, maxCosineDistance: value('maxCosineDistance'), gallerySize: value('gallerySize') };
}

export interface PreparedSequence {
  frames: TrackingFrame[];
  featureSpace?: FeatureSpace;
  options: TrackerOptions;
}

export function serializeSequence(frames: readonly TrackingFrame[], featureSpace?: FeatureSpace): string {
  const serialized = JSON.stringify(
    { ...(featureSpace ? { featureSpace } : {}), frames },
    (_key, value) => value instanceof Float32Array ? Array.from(value) : value,
  );
  if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
  return serialized;
}

// 仅做线性结构校验；完整算法校验由 prepareSequence 在临时实例中完成。
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
      let embedding: number[] | Float32Array | undefined;
      if (Object.hasOwn(d, 'embedding')) {
        if (Array.isArray(d.embedding)) embedding = [...d.embedding];
        else if (d.embedding instanceof Float32Array) embedding = new Float32Array(d.embedding);
        else return fail();
      }
      return { box: { x, y, width: w, height: h }, score: d.score, classId: d.classId, ...(embedding ? { embedding } : {}) };
    });
    if (Object.hasOwn(frame, 'featureSpaceId') && typeof frame.featureSpaceId !== 'string') return fail();
    previous = frame.timestampMs; size = { width, height };
    return { timestampMs: frame.timestampMs, imageSize: { width, height }, detections, ...(typeof frame.featureSpaceId === 'string' ? { featureSpaceId: frame.featureSpaceId } : {}) };
  });
}

function readFeatureSpace(value: unknown): FeatureSpace | undefined {
  if (value === undefined) return undefined;
  if (!record(value) || Reflect.ownKeys(value).length !== 2 || typeof value.id !== 'string' || value.id.length < 1 || value.id.length > 256 || value.id.trim() !== value.id || !Number.isSafeInteger(value.dimension) || (value.dimension as number) < 1 || (value.dimension as number) > 2048) throw new Error('INVALID_SEQUENCE');
  return { id: value.id, dimension: value.dimension as number };
}

function inferFeatureSpace(frames: readonly TrackingFrame[]): FeatureSpace {
  const id = frames[0]?.featureSpaceId;
  let dimension: number | undefined;
  if (typeof id !== 'string' || id.length < 1 || id.length > 256 || id.trim() !== id) throw new Error('INVALID_SEQUENCE');
  for (const frame of frames) {
    if (frame.featureSpaceId !== id) throw new Error('INVALID_SEQUENCE');
    for (const detection of frame.detections) {
      const embedding = detection.embedding;
      if (!Array.isArray(embedding) && !(embedding instanceof Float32Array)) throw new Error('INVALID_SEQUENCE');
      dimension ??= embedding.length;
      if (embedding.length !== dimension) throw new Error('INVALID_SEQUENCE');
    }
  }
  if (dimension === undefined) throw new Error('INVALID_SEQUENCE');
  return readFeatureSpace({ id, dimension })!;
}

const yieldMainThread = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function prepareSequence(value: unknown, algorithm: TrackerAlgorithm, currentOptions: TrackerOptions): Promise<PreparedSequence> {
  if (!record(value)) throw new Error('INVALID_SEQUENCE');
  const frames = parseSequence(value);
  const declaredFeatureSpace = readFeatureSpace(value.featureSpace);
  const featureSpace = algorithm === 'deepsort' ? declaredFeatureSpace ?? inferFeatureSpace(frames) : declaredFeatureSpace;
  serializeSequence(frames, featureSpace);
  const options: TrackerOptions = algorithm === 'deepsort'
    ? { ...currentOptions, algorithm, featureSpace }
    : { ...currentOptions, algorithm };
  const tracker = createTracker(options);
  try {
    for (let index = 0; index < frames.length; index++) {
      tracker.update(frames[index]);
      if ((index + 1) % 100 === 0 && index + 1 < frames.length) await yieldMainThread();
    }
  } finally {
    tracker.dispose();
  }
  return { frames, ...(featureSpace ? { featureSpace: { ...featureSpace } } : {}), options: { ...options, ...(options.featureSpace ? { featureSpace: { ...options.featureSpace } } : {}) } };
}

const box = (x: number, y: number, score = 0.92, embedding: readonly number[] = [1, 0, 0, 0]): Detection => ({ box: { x, y, width: 64, height: 80 }, score, classId: 0, embedding: [...embedding] });
const sequence = (kind: string): TrackingFrame[] => Array.from({ length: 40 }, (_, i) => ({
  timestampMs: i * 100, imageSize: { width: 640, height: 360 }, featureSpaceId: SYNTHETIC_FEATURE_SPACE.id,
  detections: kind === 'occlusion' && i >= 12 && i <= 16 ? [] : kind === 'crossing'
    ? [box(80 + Math.min(i, 28) * 8 - Math.max(0, i - 28) * 8, 100), box(480 - i * 8, 135, 0.92, [0, 1, 0, 0])]
    : [box(70 + i * 9, 140, kind === 'low' && i >= 6 && i <= 12 ? 0.25 : 0.92)],
}));
export const samples = { straight: sequence('straight'), low: sequence('low'), occlusion: sequence('occlusion'), crossing: sequence('crossing') };
export type Sample = keyof typeof samples;
