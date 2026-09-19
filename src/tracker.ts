import { assign, iou } from './assignment.js';
import { TrackingError } from './errors.js';
import { correct, initialize, predict, toBox, type GaussianState } from './kalman.js';
import { ocmScoreFromHistory, replayObservationFilter, type Observation } from './ocsort.js';
import type { Detection, RemovedTrack, Track, Tracker, TrackerOptions, TrackingFrame, TrackingResult, UpdateOptions } from './types.js';

const defaults: Required<TrackerOptions> = {
  algorithm: 'bytetrack', lowScoreThreshold: 0.1, highScoreThreshold: 0.5, newTrackThreshold: 0.6,
  minHits: 2, matchIouThreshold: 0.3, lowMatchIouThreshold: 0.2,
  maxLostMs: 1000, largeGapMs: 2000, maxDetections: 100, maxTracks: 200,
  ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30,
};
type Entry = {
  id: number; classId: number; state: Track['state']; filter: GaussianState; lastObservedFilter: GaussianState;
  firstMs: number; lastSeenMs: number; hits: number; score: number | null;
  observations: Observation[]; missingTimestamps: number[];
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const probability = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const now = () => performance.now();

function copyFilter(state: GaussianState): GaussianState {
  return { mean: [...state.mean], covariance: state.covariance.map(row => [...row]) };
}

function parseOptions(value: TrackerOptions): Required<TrackerOptions> {
  const fail = () => { throw new TrackingError('INVALID_OPTIONS', '跟踪参数不满足范围或阈值顺序约束'); };
  if (!record(value)) return fail();
  if (Object.keys(value).some(key => !Object.hasOwn(defaults, key))) return fail();
  const algorithm = (value.algorithm === undefined && Object.hasOwn(value, 'algorithm') ? undefined : value.algorithm ?? defaults.algorithm) as TrackerOptions['algorithm'];
  if (algorithm !== 'bytetrack' && algorithm !== 'ocsort') return fail();
  const byteTrackOnly = ['lowScoreThreshold', 'lowMatchIouThreshold'];
  const ocSortOnly = ['ocmWeight', 'ocmDeltaMs', 'ocmHistoryLength', 'oruMaxReplaySteps'];
  if (algorithm === 'ocsort' && byteTrackOnly.some(key => Object.hasOwn(value, key))) return fail();
  if (algorithm === 'bytetrack' && ocSortOnly.some(key => Object.hasOwn(value, key))) return fail();
  const options: Required<TrackerOptions> = { ...defaults, ...value, algorithm } as Required<TrackerOptions>;
  for (const key of ['lowScoreThreshold', 'highScoreThreshold', 'newTrackThreshold', 'matchIouThreshold', 'lowMatchIouThreshold'] as const) if (!probability(options[key])) return fail();
  if (options.highScoreThreshold < options.lowScoreThreshold || options.newTrackThreshold < options.highScoreThreshold) return fail();
  for (const key of ['minHits', 'maxDetections', 'maxTracks'] as const) if (!Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > (key === 'minHits' ? 100 : 500)) return fail();
  if (!positive(options.maxLostMs) || !positive(options.largeGapMs) || options.largeGapMs < options.maxLostMs) return fail();
  if (!probability(options.ocmWeight) || !finite(options.ocmDeltaMs) || options.ocmDeltaMs < 1 || options.ocmDeltaMs > 10000) return fail();
  if (!Number.isSafeInteger(options.ocmHistoryLength) || options.ocmHistoryLength < 2 || options.ocmHistoryLength > 120) return fail();
  if (!Number.isSafeInteger(options.oruMaxReplaySteps) || options.oruMaxReplaySteps < 1 || options.oruMaxReplaySteps > 60) return fail();
  return options;
}

function validateFrame(value: TrackingFrame, previous: number | null, size: TrackingFrame['imageSize'] | null, limit: number): TrackingFrame {
  const fail = () => { throw new TrackingError('INVALID_INPUT', '帧、时间戳、图像尺寸或检测框非法；跳转或尺寸变化请先 reset'); };
  if (!record(value) || !finite(value.timestampMs) || value.timestampMs < 0 || (previous !== null && value.timestampMs <= previous)) return fail();
  if (!record(value.imageSize) || !positive(value.imageSize.width) || !positive(value.imageSize.height)) return fail();
  if (size && (value.imageSize.width !== size.width || value.imageSize.height !== size.height)) return fail();
  if (!Array.isArray(value.detections) || value.detections.length > limit) return fail();
  const detections: Detection[] = [];
  for (const detection of value.detections) {
    if (!record(detection) || !probability(detection.score) || !Number.isSafeInteger(detection.classId) || detection.classId < 0 || !record(detection.box)) return fail();
    const box = detection.box;
    if (!finite(box.x) || !finite(box.y) || box.x < 0 || box.y < 0 || !positive(box.width) || !positive(box.height)) return fail();
    if (box.width > value.imageSize.width || box.height > value.imageSize.height || box.x > value.imageSize.width - box.width || box.y > value.imageSize.height - box.height) return fail();
    detections.push({ box: { ...box }, score: detection.score, classId: detection.classId });
  }
  return { timestampMs: value.timestampMs, imageSize: { ...value.imageSize }, detections };
}

function snapshot(entry: Entry, timestamp: number): Track {
  return { id: entry.id, classId: entry.classId, state: entry.state, box: toBox(entry.filter), observed: entry.score !== null, score: entry.score, ageMs: timestamp - entry.firstMs, hits: entry.hits, missedMs: timestamp - entry.lastSeenMs };
}

function cloneEntry(entry: Entry): Entry {
  return {
    ...entry, score: null, filter: copyFilter(entry.filter), lastObservedFilter: copyFilter(entry.lastObservedFilter),
    observations: entry.observations.map(observation => ({ ...observation, box: { ...observation.box } })),
    missingTimestamps: [...entry.missingTimestamps],
  };
}

export function createTracker(input: TrackerOptions = {}): Tracker {
  const options = parseOptions(input);
  let entries: Entry[] = [], timestamp: number | null = null, size: TrackingFrame['imageSize'] | null = null;
  let generation = 0, nextId = 1, disposed = false;
  const ensureActive = () => { if (disposed) throw new TrackingError('DISPOSED', '跟踪实例已释放'); };
  return {
    update(inputFrame: TrackingFrame, updateOptions: UpdateOptions = {}): TrackingResult {
      ensureActive();
      const start = now();
      if (!record(updateOptions) || (updateOptions.signal !== undefined && (!record(updateOptions.signal) || typeof updateOptions.signal.aborted !== 'boolean'))) throw new TrackingError('INVALID_INPUT', '取消参数非法');
      if (updateOptions.signal?.aborted) throw new TrackingError('ABORTED', '计算开始前已取消');
      const frame = validateFrame(inputFrame, timestamp, size, options.maxDetections);
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
      for (const entry of working) entry.filter = predict(entry.filter, dt);
      const predictionEnd = now();
      const high = frame.detections.map((detection, index) => ({ detection, index })).filter(({ detection }) => detection.score >= options.highScoreThreshold);
      const low = frame.detections.map((detection, index) => ({ detection, index })).filter(({ detection }) => detection.score >= options.lowScoreThreshold && detection.score < options.highScoreThreshold);
      const matches = new Map<Entry, Detection>(), used = new Set<number>();
      const associate = (candidates: Entry[], observations: typeof high, threshold: number, recovery = false) => {
        const raw = candidates.map(entry => observations.map(({ detection }) => entry.classId === detection.classId
          ? (recovery && entry.observations.length ? iou(entry.observations[entry.observations.length - 1].box, detection.box) : iou(toBox(entry.filter), detection.box)) : -1));
        const similarities = candidates.map((entry, row) => observations.map(({ detection }, column) => {
          const rawValue = raw[row][column];
          return options.algorithm === 'ocsort' && !recovery && rawValue >= 0
            ? ocmScoreFromHistory(rawValue, entry.observations, detection.box, options.ocmWeight, options.ocmDeltaMs)
            : rawValue;
        }));
        const pairs = assign(similarities, threshold, options.algorithm === 'ocsort' && !recovery
          ? (_score, row, column) => raw[row][column] >= threshold
          : undefined);
        for (const [row, col] of pairs) { matches.set(candidates[row], observations[col].detection); used.add(observations[col].index); }
      };
      associate(working.filter(entry => entry.state !== 'tentative'), high, options.matchIouThreshold);
      if (options.algorithm === 'ocsort') associate(working.filter(entry => entry.state !== 'tentative' && !matches.has(entry)), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold, true);
      if (options.algorithm === 'bytetrack') associate(working.filter(entry => entry.state === 'tracked' && !matches.has(entry)), low, options.lowMatchIouThreshold);
      associate(working.filter(entry => entry.state === 'tentative'), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold);
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
        });
      }
      const tracks = working.map(entry => snapshot(entry, time));
      removed.sort((a, b) => a.id - b.id);
      const updateEnd = now();
      const result: TrackingResult = {
        generation, algorithm: options.algorithm, timestampMs: time, tracks, removed, droppedDetections,
        runtime: { requestedBackend: 'cpu', actualBackend: 'cpu', executionMode: 'main', runtimeVersion: 'web-sdk-pp-tracking@0.1.0' },
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
