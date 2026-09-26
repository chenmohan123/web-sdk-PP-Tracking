import { assign, iou } from './assignment.js';
import { appendToGallery, minimumCosineDistance, MOTION_GATE_THRESHOLD, normalizeEmbedding } from './deepsort.js';
import { TrackingError } from './errors.js';
import { correct, initialize, predict, squaredMahalanobisDistance, toBox, type GaussianState } from './kalman.js';
import { ocmScoreFromHistory, replayObservationFilter, type Observation } from './ocsort.js';
import type { Detection, FeatureSpace, RemovedTrack, Track, Tracker, TrackerOptions, TrackingFrame, TrackingResult, UpdateOptions } from './types.js';
import type { TrackingStrategy } from './tracking-strategy.js';

type ParsedOptions = Omit<Required<TrackerOptions>, 'featureSpace'> & { featureSpace: FeatureSpace | null };
const defaults: ParsedOptions = {
  algorithm: 'bytetrack', lowScoreThreshold: 0.1, highScoreThreshold: 0.5, newTrackThreshold: 0.6,
  minHits: 2, matchIouThreshold: 0.3, lowMatchIouThreshold: 0.2,
  maxLostMs: 1000, largeGapMs: 2000, maxDetections: 100, maxTracks: 200,
  ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30,
  featureSpace: null, maxCosineDistance: 0.2, gallerySize: 30,
};
type Entry = {
  id: number; classId: number; state: Track['state']; filter: GaussianState; lastObservedFilter: GaussianState;
  firstMs: number; lastSeenMs: number; hits: number; score: number | null;
  observations: Observation[]; missingTimestamps: number[]; gallery: number[][];
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const probability = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const now = () => performance.now();
// 裁剪到图像边界的框用减法产出，y + height 与边界可差 1 ULP；容差为边界值的 8 倍机器精度（约 15 ULP）。
const boundsFactor = 1 + Number.EPSILON * 8;

function copyFilter(state: GaussianState): GaussianState {
  return { mean: [...state.mean], covariance: state.covariance.map(row => [...row]) };
}

function parseOptions(value: TrackerOptions): ParsedOptions {
  const fail = () => { throw new TrackingError('INVALID_OPTIONS', '跟踪参数不满足范围或阈值顺序约束'); };
  if (!record(value)) return fail();
  if (Reflect.ownKeys(value).some(key => !Object.hasOwn(defaults, key))) return fail();
  const algorithm = (Object.hasOwn(value, 'algorithm') ? value.algorithm : defaults.algorithm) as TrackerOptions['algorithm'];
  if (algorithm !== 'bytetrack' && algorithm !== 'ocsort' && algorithm !== 'deepsort') return fail();
  const byteTrackOnly = ['lowScoreThreshold', 'lowMatchIouThreshold'];
  const ocSortOnly = ['ocmWeight', 'ocmDeltaMs', 'ocmHistoryLength', 'oruMaxReplaySteps'];
  const deepSortOnly = ['featureSpace', 'maxCosineDistance', 'gallerySize'];
  if (algorithm === 'ocsort' && [...byteTrackOnly, ...deepSortOnly].some(key => Object.hasOwn(value, key))) return fail();
  if (algorithm === 'bytetrack' && [...ocSortOnly, ...deepSortOnly].some(key => Object.hasOwn(value, key))) return fail();
  if (algorithm === 'deepsort' && [...byteTrackOnly, ...ocSortOnly].some(key => Object.hasOwn(value, key))) return fail();
  let featureSpace: FeatureSpace | null = null;
  if (algorithm === 'deepsort') {
    if (!Object.hasOwn(value, 'featureSpace') || !record(value.featureSpace)) return fail();
    if (Reflect.ownKeys(value.featureSpace).length !== 2 || !Object.hasOwn(value.featureSpace, 'id') || !Object.hasOwn(value.featureSpace, 'dimension')) return fail();
    const { id, dimension } = value.featureSpace;
    if (typeof id !== 'string' || id.length < 1 || id.length > 256 || id.trim() !== id) return fail();
    if (typeof dimension !== 'number' || !Number.isSafeInteger(dimension) || dimension < 1 || dimension > 2048) return fail();
    featureSpace = { id, dimension };
  }
  const options = { ...defaults, ...value, algorithm, featureSpace } as ParsedOptions;
  for (const key of ['lowScoreThreshold', 'highScoreThreshold', 'newTrackThreshold', 'matchIouThreshold', 'lowMatchIouThreshold'] as const) if (!probability(options[key])) return fail();
  if ((algorithm === 'bytetrack' && options.highScoreThreshold < options.lowScoreThreshold) || options.newTrackThreshold < options.highScoreThreshold) return fail();
  for (const key of ['minHits', 'maxDetections', 'maxTracks'] as const) if (!Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > (key === 'minHits' ? 100 : 500)) return fail();
  if (!positive(options.maxLostMs) || !positive(options.largeGapMs) || options.largeGapMs < options.maxLostMs) return fail();
  if (!probability(options.ocmWeight) || !finite(options.ocmDeltaMs) || options.ocmDeltaMs < 1 || options.ocmDeltaMs > 10000) return fail();
  if (!Number.isSafeInteger(options.ocmHistoryLength) || options.ocmHistoryLength < 2 || options.ocmHistoryLength > 120) return fail();
  if (!Number.isSafeInteger(options.oruMaxReplaySteps) || options.oruMaxReplaySteps < 1 || options.oruMaxReplaySteps > 60) return fail();
  if (!finite(options.maxCosineDistance) || options.maxCosineDistance < 0 || options.maxCosineDistance > 2) return fail();
  if (!Number.isSafeInteger(options.gallerySize) || options.gallerySize < 1 || options.gallerySize > 100) return fail();
  if (featureSpace && options.maxTracks * options.gallerySize * featureSpace.dimension > 4_000_000) return fail();
  return options;
}

function validateFrame(value: TrackingFrame, previous: number | null, size: TrackingFrame['imageSize'] | null, options: ParsedOptions, strategy?: TrackingStrategy): TrackingFrame {
  const fail = () => { throw new TrackingError('INVALID_INPUT', '帧、时间戳、图像尺寸或检测框非法；跳转或尺寸变化请先 reset'); };
  if (!record(value) || !finite(value.timestampMs) || value.timestampMs < 0 || (previous !== null && value.timestampMs <= previous)) return fail();
  if (!record(value.imageSize) || !positive(value.imageSize.width) || !positive(value.imageSize.height)) return fail();
  if (size && (value.imageSize.width !== size.width || value.imageSize.height !== size.height)) return fail();
  if (!Array.isArray(value.detections) || value.detections.length > options.maxDetections) return fail();
  const featureSpace = options.algorithm === 'deepsort' ? options.featureSpace : strategy?.featureSpace;
  if (featureSpace && value.featureSpaceId !== featureSpace.id) return fail();
  const detections: Detection[] = [];
  for (const detection of value.detections) {
    if (!record(detection) || !probability(detection.score) || !Number.isSafeInteger(detection.classId) || detection.classId < 0 || !record(detection.box)) return fail();
    const box = detection.box;
    if (!finite(box.x) || !finite(box.y) || box.x < 0 || box.y < 0 || !positive(box.width) || !positive(box.height)) return fail();
    if (box.width > value.imageSize.width || box.height > value.imageSize.height || box.x + box.width > value.imageSize.width * boundsFactor || box.y + box.height > value.imageSize.height * boundsFactor) return fail();
    const embedding = featureSpace ? normalizeEmbedding(detection.embedding, featureSpace.dimension) : undefined;
    detections.push({ box: { ...box }, score: detection.score, classId: detection.classId, ...(embedding ? { embedding } : {}) });
  }
  return { timestampMs: value.timestampMs, imageSize: { ...value.imageSize }, detections, ...(featureSpace ? { featureSpaceId: value.featureSpaceId } : {}) };
}

function snapshot(entry: Entry, timestamp: number): Track {
  return { id: entry.id, classId: entry.classId, state: entry.state, box: toBox(entry.filter), observed: entry.score !== null, score: entry.score, ageMs: timestamp - entry.firstMs, hits: entry.hits, missedMs: timestamp - entry.lastSeenMs };
}

function cloneEntry(entry: Entry): Entry {
  return {
    ...entry, score: null, filter: copyFilter(entry.filter), lastObservedFilter: copyFilter(entry.lastObservedFilter),
    observations: entry.observations.map(observation => ({ ...observation, box: { ...observation.box } })),
    missingTimestamps: [...entry.missingTimestamps], gallery: entry.gallery.map(sample => [...sample]),
  };
}

export function createTracker(input: TrackerOptions = {}): Tracker {
  return createTrackingCore(input);
}

// 内部候选策略复用；不从包根入口导出。
export function createTrackingCore(input: TrackerOptions = {}, strategy?: TrackingStrategy): Tracker {
  const options = parseOptions(input);
  if (strategy && options.algorithm !== 'bytetrack') throw new TrackingError('INVALID_OPTIONS', '内部候选策略仅复用ByteTrack生命周期');
  let entries: Entry[] = [], timestamp: number | null = null, size: TrackingFrame['imageSize'] | null = null;
  let generation = 0, nextId = 1, disposed = false;
  const ensureActive = () => { if (disposed) throw new TrackingError('DISPOSED', '跟踪实例已释放'); };
  return {
    update(inputFrame: TrackingFrame, updateOptions: UpdateOptions = {}): TrackingResult {
      ensureActive();
      const start = now();
      if (!record(updateOptions) || (updateOptions.signal !== undefined && (!record(updateOptions.signal) || typeof updateOptions.signal.aborted !== 'boolean'))) throw new TrackingError('INVALID_INPUT', '取消参数非法');
      if (updateOptions.signal?.aborted) throw new TrackingError('ABORTED', '计算开始前已取消');
      const frame = validateFrame(strategy ? strategy.prepareFrame(inputFrame, timestamp, size) : inputFrame, timestamp, size, options, strategy);
      const validationEnd = now(), time = frame.timestampMs;
      const dt = timestamp === null ? 0 : (time - timestamp) / 1000;
      const gap = timestamp !== null && time - timestamp > options.largeGapMs;
      const removed: RemovedTrack[] = [];
      // 所有计算在副本上；成功构建结果后才提交时钟、ID 与轨迹。
      let working = entries.map(cloneEntry);
      working = working.filter(entry => {
        if (gap || (entry.state === 'lost' && time - entry.lastSeenMs > options.maxLostMs)) {
          removed.push({ ...snapshot(entry, time), state: 'removed' }); return false;
        }
        return true;
      });
      for (const entry of working) {
        const predicted = predict(entry.filter, dt);
        entry.filter = strategy ? strategy.transformPrediction(predicted) : predicted;
      }
      const predictionEnd = now();
      const high = frame.detections.map((detection, index) => ({ detection, index })).filter(({ detection }) => detection.score >= options.highScoreThreshold);
      const low = frame.detections.map((detection, index) => ({ detection, index })).filter(({ detection }) => detection.score >= options.lowScoreThreshold && detection.score < options.highScoreThreshold);
      const matches = new Map<Entry, Detection>(), used = new Set<number>();
      const associate = (candidates: Entry[], observations: typeof high, threshold: number, recovery = false) => {
        const raw = candidates.map(entry => observations.map(({ detection }) => entry.classId === detection.classId
          ? (recovery && entry.observations.length ? iou(entry.observations[entry.observations.length - 1].box, detection.box) : iou(toBox(entry.filter), detection.box)) : -1));
        const similarities = candidates.map((entry, row) => observations.map(({ detection }, column) => {
          const rawValue = raw[row][column];
          if (strategy?.similarity && detection.score >= options.highScoreThreshold) return strategy.similarity(rawValue, detection, entry.gallery);
          return options.algorithm === 'ocsort' && !recovery && rawValue >= 0
            ? ocmScoreFromHistory(rawValue, entry.observations, detection.box, options.ocmWeight, options.ocmDeltaMs)
            : rawValue;
        }));
        const pairs = assign(similarities, threshold, options.algorithm === 'ocsort' && !recovery
          ? (_score, row, column) => raw[row][column] >= threshold
          : undefined);
        for (const [row, col] of pairs) { matches.set(candidates[row], observations[col].detection); used.add(observations[col].index); }
      };
      if (options.algorithm === 'deepsort') {
        const confirmed = working.filter(entry => entry.state !== 'tentative');
        const groups = [...new Set(confirmed.map(entry => entry.lastSeenMs))].sort((a, b) => b - a);
        for (const lastSeenMs of groups) {
          const candidates = confirmed.filter(entry => entry.lastSeenMs === lastSeenMs);
          const observations = high.filter(({ index }) => !used.has(index));
          const similarities = candidates.map(entry => observations.map(({ detection }) => 1 - minimumCosineDistance(detection.embedding!, entry.gallery)));
          const eligible = candidates.map((entry, row) => observations.map(({ detection }, column) => {
            if (entry.classId !== detection.classId || 1 - similarities[row][column] > options.maxCosineDistance) return false;
            const box = detection.box;
            return squaredMahalanobisDistance(entry.filter, [box.x + box.width / 2, box.y + box.height / 2, box.width, box.height]) <= MOTION_GATE_THRESHOLD;
          }));
          const pairs = assign(similarities, -1, (_score, row, column) => eligible[row][column]);
          for (const [row, column] of pairs) {
            matches.set(candidates[row], observations[column].detection);
            used.add(observations[column].index);
          }
        }
        associate(working.filter(entry => (entry.state === 'tentative' || entry.state === 'tracked') && !matches.has(entry)), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold);
      } else {
        associate(working.filter(entry => entry.state !== 'tentative'), high, options.matchIouThreshold);
        if (options.algorithm === 'ocsort') associate(working.filter(entry => entry.state !== 'tentative' && !matches.has(entry)), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold, true);
        if (options.algorithm === 'bytetrack') associate(working.filter(entry => entry.state === 'tracked' && !matches.has(entry)), low, options.lowMatchIouThreshold);
        associate(working.filter(entry => entry.state === 'tentative'), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold);
      }
      const associationEnd = now();
      working = working.filter(entry => {
        const detection = matches.get(entry);
        if (detection) {
          const wasLost = entry.state === 'lost';
          const observation: Observation = { timestampMs: time, box: { ...detection.box }, score: detection.score };
          if (options.algorithm === 'ocsort' && wasLost && entry.observations.length) {
            entry.filter = replayObservationFilter(entry.lastObservedFilter, entry.observations[entry.observations.length - 1], observation, entry.missingTimestamps, options.oruMaxReplaySteps);
          } else {
            const b = detection.box;
            entry.filter = correct(entry.filter, [b.x + b.width / 2, b.y + b.height / 2, b.width, b.height]);
          }
          entry.hits++; entry.lastSeenMs = time; entry.score = detection.score;
          entry.observations.push(observation);
          if (entry.observations.length > options.ocmHistoryLength) entry.observations.shift();
          entry.lastObservedFilter = copyFilter(entry.filter);
          entry.missingTimestamps = [];
          if (options.algorithm === 'deepsort') appendToGallery(entry.gallery, detection.embedding!, options.gallerySize);
          if (strategy?.updateGallery && detection.score >= options.highScoreThreshold) strategy.updateGallery(entry.gallery, detection);
          if (entry.hits >= options.minHits) entry.state = 'tracked';
          return true;
        }
        if (entry.state === 'tentative') { removed.push({ ...snapshot(entry, time), state: 'removed' }); return false; }
        entry.state = 'lost';
        if (options.algorithm === 'ocsort') {
          entry.missingTimestamps.push(time);
          if (entry.missingTimestamps.length > options.oruMaxReplaySteps) { removed.push({ ...snapshot(entry, time), state: 'removed' }); return false; }
        }
        return true;
      });
      let localNextId = nextId, droppedDetections = 0;
      for (const { detection, index } of high) {
        if (used.has(index) || detection.score < options.newTrackThreshold) continue;
        if (working.length >= options.maxTracks) { droppedDetections++; continue; }
        if (!Number.isSafeInteger(localNextId)) throw new TrackingError('ID_EXHAUSTED', '本代次轨迹 ID 已耗尽，请 reset');
        const filter = initialize(detection.box);
        working.push({
          id: localNextId++, classId: detection.classId, state: options.minHits === 1 ? 'tracked' : 'tentative', filter,
          lastObservedFilter: copyFilter(filter), firstMs: time, lastSeenMs: time, hits: 1, score: detection.score,
          observations: [{ timestampMs: time, box: { ...detection.box }, score: detection.score }], missingTimestamps: [],
          gallery: options.algorithm === 'deepsort' ? [[...detection.embedding!]] : strategy?.initializeGallery?.(detection) ?? [],
        });
      }
      const tracks = working.map(entry => snapshot(entry, time));
      removed.sort((a, b) => a.id - b.id);
      const updateEnd = now();
      const result: TrackingResult = {
        generation, algorithm: options.algorithm, timestampMs: time, tracks, removed, droppedDetections,
        runtime: { requestedBackend: 'cpu', actualBackend: 'cpu', executionMode: 'main', runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.2' },
        timings: { validationMs: validationEnd - start, predictionMs: predictionEnd - validationEnd, associationMs: associationEnd - predictionEnd, updateMs: updateEnd - associationEnd, totalMs: now() - start },
      };
      entries = working; nextId = localNextId; timestamp = time; size = frame.imageSize;
      return result;
    },
    reset() {
      ensureActive();
      if (!Number.isSafeInteger(generation + 1)) throw new TrackingError('ID_EXHAUSTED', '代次已耗尽，请创建新实例');
      entries = []; timestamp = null; size = null; nextId = 1; generation++;
    },
    dispose() { entries = []; timestamp = null; size = null; disposed = true; },
  };
}
