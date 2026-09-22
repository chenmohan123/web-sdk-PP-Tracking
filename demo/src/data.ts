import { createTracker, TrackingError, type AnyTrackerOptions, type BoTSortFrame, type Detection, type FeatureSpace, type TrackerAlgorithm, type TrackingFrame } from 'web-sdk-pp-tracking';

export type DemoFrame = TrackingFrame & Partial<Pick<BoTSortFrame, 'frameId' | 'motion'>>;
export interface BoTSettings { motionFailure: 'error' | 'identity'; useAppearance: boolean; proximityIouThreshold: string; emaAlpha: string }
export const DEFAULT_BOT_SETTINGS: BoTSettings = { motionFailure: 'error', useAppearance: false, proximityIouThreshold: '0.5', emaAlpha: '0.9' };

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

export const DEMO_DEFAULT_OPTIONS = {
  bytetrack: { algorithm: 'bytetrack', ...sharedOptions, lowScoreThreshold: defaultValue('lowScoreThreshold'), lowMatchIouThreshold: 0.2 },
  ocsort: { algorithm: 'ocsort', ...sharedOptions, ocmWeight: defaultValue('ocmWeight'), ocmDeltaMs: defaultValue('ocmDeltaMs'), ocmHistoryLength: defaultValue('ocmHistoryLength'), oruMaxReplaySteps: defaultValue('oruMaxReplaySteps') },
  deepsort: { algorithm: 'deepsort', ...sharedOptions, featureSpace: { ...SYNTHETIC_FEATURE_SPACE }, maxCosineDistance: defaultValue('maxCosineDistance'), gallerySize: defaultValue('gallerySize') },
  botsort: { algorithm: 'botsort', ...sharedOptions, lowScoreThreshold: defaultValue('lowScoreThreshold'), lowMatchIouThreshold: 0.2, motionFailure: 'error' },
} satisfies Record<TrackerAlgorithm, AnyTrackerOptions>;

export function optionsFrom(algorithm: TrackerAlgorithm, parameters: DemoParameterDraft, featureSpace?: FeatureSpace, bot: BoTSettings = DEFAULT_BOT_SETTINGS, currentOptions?: AnyTrackerOptions): AnyTrackerOptions {
  const value = (key: DemoParameterKey) => parameters[key].trim() === '' ? NaN : Number(parameters[key]);
  // 同算法应用只修改可见字段；切算法仍采用对应默认配置。
  const base = currentOptions && (currentOptions.algorithm ?? 'bytetrack') === algorithm ? currentOptions : undefined;
  const shared = { ...sharedOptions, matchIouThreshold: base?.matchIouThreshold ?? sharedOptions.matchIouThreshold, largeGapMs: base?.largeGapMs ?? sharedOptions.largeGapMs, maxDetections: base?.maxDetections ?? sharedOptions.maxDetections, maxTracks: base?.maxTracks ?? sharedOptions.maxTracks, highScoreThreshold: value('highScoreThreshold'), newTrackThreshold: value('newTrackThreshold'), minHits: value('minHits'), maxLostMs: value('maxLostMs') };
  if (algorithm === 'bytetrack') return { ...DEMO_DEFAULT_OPTIONS.bytetrack, ...shared, lowMatchIouThreshold: base?.lowMatchIouThreshold ?? 0.2, lowScoreThreshold: value('lowScoreThreshold') };
  if (algorithm === 'ocsort') return { ...DEMO_DEFAULT_OPTIONS.ocsort, ...shared, ocmWeight: value('ocmWeight'), ocmDeltaMs: value('ocmDeltaMs'), ocmHistoryLength: value('ocmHistoryLength'), oruMaxReplaySteps: value('oruMaxReplaySteps') };
  if (algorithm === 'botsort') return { ...DEMO_DEFAULT_OPTIONS.botsort, ...shared, lowMatchIouThreshold: base?.lowMatchIouThreshold ?? 0.2, lowScoreThreshold: value('lowScoreThreshold'), motionFailure: bot.motionFailure, ...(bot.useAppearance ? { appearance: { featureSpace: featureSpace ?? SYNTHETIC_FEATURE_SPACE, maxCosineDistance: value('maxCosineDistance'), proximityIouThreshold: bot.proximityIouThreshold.trim() === '' ? NaN : Number(bot.proximityIouThreshold), emaAlpha: bot.emaAlpha.trim() === '' ? NaN : Number(bot.emaAlpha) } } : {}) };
  return { ...DEMO_DEFAULT_OPTIONS.deepsort, ...shared, featureSpace: featureSpace ?? SYNTHETIC_FEATURE_SPACE, maxCosineDistance: value('maxCosineDistance'), gallerySize: value('gallerySize') };
}

export function parametersFrom(options: AnyTrackerOptions): DemoParameterDraft {
  const parameters = { ...DEMO_DEFAULT_PARAMETERS, ...(options.algorithm === 'botsort' ? { maxCosineDistance: '0.25' } : {}) };
  for (const key of Object.keys(parameters) as DemoParameterKey[]) {
    const value = (options as unknown as Record<string, unknown>)[key];
    if (typeof value === 'number') parameters[key] = String(value);
  }
  if (options.algorithm === 'botsort' && options.appearance) parameters.maxCosineDistance = String(options.appearance.maxCosineDistance ?? 0.25);
  return parameters;
}

export function botSettingsFrom(options: AnyTrackerOptions): BoTSettings {
  return options.algorithm === 'botsort' ? { motionFailure: options.motionFailure ?? 'error', useAppearance: !!options.appearance, proximityIouThreshold: String(options.appearance?.proximityIouThreshold ?? 0.5), emaAlpha: String(options.appearance?.emaAlpha ?? 0.9) } : { ...DEFAULT_BOT_SETTINGS };
}

export interface PreparedSequence {
  frames: DemoFrame[];
  featureSpace?: FeatureSpace;
  options: AnyTrackerOptions;
}

export function serializeSequence(frames: readonly DemoFrame[], featureSpace?: FeatureSpace, options?: AnyTrackerOptions): string {
  const serialized = JSON.stringify(
    { ...(options ? { schemaVersion: 2, algorithm: options.algorithm ?? 'bytetrack', options: { ...options, algorithm: options.algorithm ?? 'bytetrack' } } : {}), ...(featureSpace ? { featureSpace } : {}), frames },
    (_key, value) => value instanceof Float32Array ? Array.from(value) : value,
  );
  if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
  return serialized;
}

// 仅做线性结构校验；完整算法校验由 prepareSequence 在临时实例中完成。
export function parseSequence(value: unknown): DemoFrame[] {
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
    // 保留原始运动字段及未知字段，交给核心严格验证；不得通过挑选字段绕过契约。
    return { ...structuredClone(frame), timestampMs: frame.timestampMs, imageSize: structuredClone(frame.imageSize) as TrackingFrame['imageSize'], detections } as DemoFrame;
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

export async function prepareSequence(value: unknown, algorithm: TrackerAlgorithm, currentOptions: AnyTrackerOptions): Promise<PreparedSequence> {
  if (!record(value)) throw new Error('INVALID_SEQUENCE');
  if (Object.hasOwn(value, 'schemaVersion') && value.schemaVersion !== 1 && value.schemaVersion !== 2) throw new Error('INVALID_SEQUENCE');
  const versioned = value.schemaVersion === 2;
  if (versioned) {
    if (value.schemaVersion !== 2 || !['bytetrack', 'ocsort', 'deepsort', 'botsort'].includes(value.algorithm as string) || !record(value.options) || value.options.algorithm !== value.algorithm) throw new Error('INVALID_SEQUENCE');
    algorithm = value.algorithm as TrackerAlgorithm;
    currentOptions = structuredClone(value.options) as unknown as AnyTrackerOptions;
  }
  const frames = parseSequence(value);
  const declaredFeatureSpace = readFeatureSpace(value.featureSpace);
  let options = structuredClone({ ...currentOptions, algorithm }) as AnyTrackerOptions;
  const usesAppearance = algorithm === 'deepsort' || (options.algorithm === 'botsort' && !!options.appearance);
  const configuredSpace = options.algorithm === 'botsort' ? options.appearance?.featureSpace : options.featureSpace;
  const featureSpace = usesAppearance ? declaredFeatureSpace ?? (versioned ? readFeatureSpace(configuredSpace) : undefined) ?? inferFeatureSpace(frames) : declaredFeatureSpace;
  if (usesAppearance) {
    if (versioned && (!configuredSpace || configuredSpace.id !== featureSpace!.id || configuredSpace.dimension !== featureSpace!.dimension)) throw new Error('INVALID_SEQUENCE');
    // 版本化选项必须原样交给工厂校验，不能用包装字段清洗非法配置。
    if (!versioned) {
      if (options.algorithm === 'botsort') options = { ...options, appearance: { ...options.appearance!, featureSpace: featureSpace! } };
      else options = { ...options, featureSpace };
    }
  }
  serializeSequence(frames, featureSpace, versioned ? options : undefined);
  const tracker = createTracker(options);
  try {
    for (let index = 0; index < frames.length; index++) {
      // 工厂联合类型要求交集；BoT-SORT 的实际必填字段始终由运行时校验。
      tracker.update(frames[index] as BoTSortFrame);
      if ((index + 1) % 100 === 0 && index + 1 < frames.length) await yieldMainThread();
    }
  } catch (error) {
    if (error instanceof TrackingError && error.code === 'INVALID_INPUT') throw new Error('INVALID_SEQUENCE');
    throw error;
  } finally {
    tracker.dispose();
  }
  return { frames, ...(featureSpace ? { featureSpace: { ...featureSpace } } : {}), options: structuredClone(options) };
}

const box = (x: number, y: number, score = 0.92, embedding: readonly number[] = [1, 0, 0, 0]): Detection => ({ box: { x, y, width: 64, height: 80 }, score, classId: 0, embedding: [...embedding] });
const sequence = (kind: string): TrackingFrame[] => Array.from({ length: 40 }, (_, i) => ({
  timestampMs: i * 100, imageSize: { width: 640, height: 360 }, featureSpaceId: SYNTHETIC_FEATURE_SPACE.id,
  detections: kind === 'occlusion' && i >= 12 && i <= 16 ? [] : kind === 'crossing'
    ? [box(80 + Math.min(i, 28) * 8 - Math.max(0, i - 28) * 8, 100), box(480 - i * 8, 135, 0.92, [0, 1, 0, 0])]
    : [box(70 + i * 9, 140, kind === 'low' && i >= 6 && i <= 12 ? 0.25 : 0.92)],
}));
const translation: BoTSortFrame[] = Array.from({ length: 40 }, (_, i) => ({
  frameId: i, timestampMs: i * 100, imageSize: { width: 640, height: 360 },
  detections: [{ box: { x: 100 + i * 8, y: 140, width: 64, height: 80 }, score: 0.92, classId: 0 }],
  motion: i === 0 ? { status: 'initial', from: null, to: { frameId: i, timestampMs: i * 100 } } : { status: 'estimated', from: { frameId: i - 1, timestampMs: (i - 1) * 100 }, to: { frameId: i, timestampMs: i * 100 }, matrix: [1, 0, 8, 0, 1, 0], source: 'original-synthetic-camera-translation', confidence: 1 },
}));
export const samples = { straight: sequence('straight'), low: sequence('low'), occlusion: sequence('occlusion'), crossing: sequence('crossing'), translation };
export type Sample = keyof typeof samples;

// 仅内置原创样例可生成运动/向量；外部导入绝不经过此适配。
export function sampleInput(sample: Sample, algorithm: TrackerAlgorithm, options: AnyTrackerOptions) {
  const appearance = algorithm === 'deepsort' || (options.algorithm === 'botsort' && !!options.appearance);
  const frames: DemoFrame[] = structuredClone(samples[sample]).map((frame, index) => {
    const result: DemoFrame = { timestampMs: frame.timestampMs, imageSize: frame.imageSize, detections: frame.detections.map((d, i) => ({ box: d.box, score: d.score, classId: d.classId, ...(appearance ? { embedding: d.embedding ?? (i % 2 ? [0, 1, 0, 0] : [1, 0, 0, 0]) } : {}) })), ...(appearance ? { featureSpaceId: SYNTHETIC_FEATURE_SPACE.id } : {}) };
    if (algorithm === 'botsort') {
      result.frameId = index;
      result.motion = 'motion' in frame ? (frame as BoTSortFrame).motion : index === 0 ? { status: 'initial', from: null, to: { frameId: index, timestampMs: frame.timestampMs } } : { status: 'identity', from: { frameId: index - 1, timestampMs: samples[sample][index - 1].timestampMs }, to: { frameId: index, timestampMs: frame.timestampMs } };
    }
    return result;
  });
  return { ...(appearance ? { featureSpace: { ...SYNTHETIC_FEATURE_SPACE } } : {}), frames };
}
