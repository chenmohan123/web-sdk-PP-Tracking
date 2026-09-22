// .tmp/botsort-feasibility/compensate.mjs
function compensate(state, matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(Number.isFinite)) throw Error("\u65E0\u6548\u4EFF\u5C04\u77E9\u9635");
  const [a, b, tx, c, d, ty] = matrix;
  if (Math.abs(a * d - b * c) < 1e-8) throw Error("\u5947\u5F02\u4EFF\u5C04\u77E9\u9635");
  if (matrix.every((x, i) => x === [1, 0, 0, 0, 1, 0][i])) return state;
  const M = [[a, b], [c, d]], B = M.map((row) => row.map(Math.abs));
  const J = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let block = 0; block < 4; block++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) J[2 * block + i][2 * block + j] = (block % 2 === 0 ? M : B)[i][j];
  const mean = J.map((row) => row.reduce((s, x, j) => s + x * state.mean[j], 0));
  mean[0] += tx;
  mean[1] += ty;
  const product = J.map((row) => state.covariance[0].map((_, j) => row.reduce((s, x, k) => s + x * state.covariance[k][j], 0)));
  const covariance = product.map((row) => J.map((col) => row.reduce((s, x, k) => s + x * col[k], 0)));
  if (!mean.every(Number.isFinite) || !covariance.flat().every(Number.isFinite) || mean[2] <= 0 || mean[3] <= 0) throw Error("\u8FD0\u52A8\u8865\u507F\u4E0D\u53EF\u8868\u793A");
  return { mean, covariance };
}

// .tmp/botsort-feasibility/code/assignment.ts
function assign(similarities, threshold, validEdge = (similarity) => similarity >= threshold) {
  const n = similarities.length, m = similarities[0]?.length ?? 0;
  if (!n || !m) return [];
  const columns = m + n;
  let maxValidCost = 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    if (validEdge(similarities[i][j], i, j)) maxValidCost = Math.max(maxValidCost, 1 - similarities[i][j]);
  }
  const unmatched = maxValidCost <= 1 ? n + 1 : (n + 1) * maxValidCost + 1;
  const forbidden = (n + 1) * unmatched + 1;
  const cost = (i, j) => j >= m ? unmatched : validEdge(similarities[i][j], i, j) ? 1 - similarities[i][j] : forbidden;
  const u = Array(n + 1).fill(0), v = Array(columns + 1).fill(0);
  const owner = Array(columns + 1).fill(0), previous = Array(columns + 1).fill(0);
  for (let row = 1; row <= n; row++) {
    owner[0] = row;
    let column = 0;
    const distances = Array(columns + 1).fill(Infinity), used = Array(columns + 1).fill(false);
    do {
      used[column] = true;
      const current = owner[column];
      let delta = Infinity, next = 0;
      for (let j = 1; j <= columns; j++) {
        if (used[j]) continue;
        const reduced = cost(current - 1, j - 1) - u[current] - v[j];
        if (reduced < distances[j]) {
          distances[j] = reduced;
          previous[j] = column;
        }
        if (distances[j] < delta) {
          delta = distances[j];
          next = j;
        }
      }
      for (let j = 0; j <= columns; j++) {
        if (used[j]) {
          u[owner[j]] += delta;
          v[j] -= delta;
        } else distances[j] -= delta;
      }
      column = next;
    } while (owner[column] !== 0);
    do {
      const prev = previous[column];
      owner[column] = owner[prev];
      column = prev;
    } while (column !== 0);
  }
  const pairs = [];
  for (let j = 1; j <= m; j++) if (owner[j] !== 0 && validEdge(similarities[owner[j] - 1][j - 1], owner[j] - 1, j - 1)) pairs.push([owner[j] - 1, j - 1]);
  return pairs.sort((a, b) => a[0] - b[0]);
}
function iou(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const width = Math.max(0, Math.min(a.width, b.width, a.width - dx, b.width + dx));
  const height = Math.max(0, Math.min(a.height, b.height, a.height - dy, b.height + dy));
  if (width === 0 || height === 0) return 0;
  const scaleX = Math.max(a.width, b.width), scaleY = Math.max(a.height, b.height);
  const aw = a.width / scaleX, ah = a.height / scaleY;
  const bw = b.width / scaleX, bh = b.height / scaleY;
  const intersection = width / scaleX * (height / scaleY);
  const union = aw * ah + bw * bh - intersection;
  return union > 0 ? Math.max(0, Math.min(1, intersection / union)) : 0;
}

// .tmp/botsort-feasibility/code/errors.ts
var TrackingError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "TrackingError";
  }
};

// .tmp/botsort-feasibility/code/deepsort.ts
var MOTION_GATE_THRESHOLD = 9.487729036781154;
function normalizeEmbedding(value, dimension) {
  const array = Array.isArray(value);
  if (!array && !(value instanceof Float32Array) || value.length !== dimension) {
    throw new TrackingError("INVALID_INPUT", "\u5916\u89C2\u5411\u91CF\u7C7B\u578B\u6216\u7EF4\u5EA6\u4E0E\u7279\u5F81\u7A7A\u95F4\u4E0D\u7B26");
  }
  let maximum = 0;
  const copied = Array(dimension);
  for (let index = 0; index < dimension; index++) {
    if (array && !Object.hasOwn(value, index)) throw new TrackingError("INVALID_INPUT", "\u5916\u89C2\u5411\u91CF\u4E0D\u80FD\u5305\u542B\u7A00\u758F\u69FD\u4F4D");
    const component = value[index];
    if (!Number.isFinite(component)) throw new TrackingError("INVALID_INPUT", "\u5916\u89C2\u5411\u91CF\u5FC5\u987B\u5168\u90E8\u4E3A\u6709\u9650\u6570\u503C");
    copied[index] = component;
    maximum = Math.max(maximum, Math.abs(component));
  }
  if (maximum === 0) throw new TrackingError("INVALID_INPUT", "\u5916\u89C2\u5411\u91CF\u8303\u6570\u5FC5\u987B\u5927\u4E8E\u96F6");
  const scaled = copied.map((component) => component / maximum);
  const norm = Math.sqrt(scaled.reduce((sum, component) => sum + component * component, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new TrackingError("INVALID_INPUT", "\u5916\u89C2\u5411\u91CF\u65E0\u6CD5\u5F52\u4E00\u5316");
  return scaled.map((component) => component / norm);
}
function minimumCosineDistance(embedding, gallery) {
  let minimum = Infinity;
  for (const sample of gallery) {
    let dot = 0;
    for (let index = 0; index < embedding.length; index++) dot += embedding[index] * sample[index];
    if (!Number.isFinite(dot)) throw new TrackingError("NUMERICAL_FAILURE", "\u5916\u89C2\u8DDD\u79BB\u4E0D\u53EF\u8868\u793A");
    minimum = Math.min(minimum, 1 - Math.max(-1, Math.min(1, dot)));
  }
  if (!Number.isFinite(minimum)) throw new TrackingError("NUMERICAL_FAILURE", "\u8F68\u8FF9\u56FE\u5E93\u4E3A\u7A7A\u6216\u4E0D\u53EF\u8868\u793A");
  return minimum;
}
function appendToGallery(gallery, embedding, capacity) {
  gallery.push(Array.from(embedding));
  if (gallery.length > capacity) gallery.splice(0, gallery.length - capacity);
}

// .tmp/botsort-feasibility/code/kalman.ts
var identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => Number(i === j)));
var transpose = (a) => a[0].map((_, j) => a.map((row) => row[j]));
var multiply = (a, b) => a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
var add = (a, b) => a.map((row, i) => row.map((value, j) => value + b[i][j]));
function inverse(a) {
  const n = a.length, unit = identity(n);
  const rows = a.map((row, i) => [...row, ...unit[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    if (!Number.isFinite(rows[pivot][col]) || Math.abs(rows[pivot][col]) < 1e-12) throw new TrackingError("NUMERICAL_FAILURE", "\u89C2\u6D4B\u534F\u65B9\u5DEE\u4E0D\u53EF\u9006");
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    rows[col] = rows[col].map((value) => value / divisor);
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = rows[i][col];
      rows[i] = rows[i].map((value, j) => value - factor * rows[col][j]);
    }
  }
  return rows.map((row) => row.slice(n));
}
function checked(mean, covariance) {
  if (!mean.every(Number.isFinite) || !covariance.every((row) => row.every(Number.isFinite))) throw new TrackingError("NUMERICAL_FAILURE", "\u8FD0\u52A8\u72B6\u6001\u51FA\u73B0\u975E\u6709\u9650\u6570\u503C");
  const symmetric = covariance.map((row, i) => row.map((value, j) => value / 2 + covariance[j][i] / 2));
  if (symmetric.some((row, i) => row[i] < 0)) throw new TrackingError("NUMERICAL_FAILURE", "\u534F\u65B9\u5DEE\u51FA\u73B0\u8D1F\u65B9\u5DEE");
  mean[2] = Math.max(1e-6, mean[2]);
  mean[3] = Math.max(1e-6, mean[3]);
  return { mean, covariance: symmetric };
}
function initialize(box) {
  return checked([box.x + box.width / 2, box.y + box.height / 2, box.width, box.height, 0, 0, 0, 0], identity(8).map((row, i) => row.map((value) => value * (i < 4 ? 100 : 1e4))));
}
function predict(state, dt) {
  const F = identity(8), Q = identity(8).map((row) => row.map(() => 0));
  for (let i = 0; i < 4; i++) {
    F[i][i + 4] = dt;
    Q[i][i] = 25 * dt ** 4 / 4;
    Q[i][i + 4] = Q[i + 4][i] = 25 * dt ** 3 / 2;
    Q[i + 4][i + 4] = 25 * dt ** 2;
  }
  return checked(multiply(F, state.mean.map((value) => [value])).map((row) => row[0]), add(multiply(multiply(F, state.covariance), transpose(F)), Q));
}
function correct(state, measurement2) {
  const P = state.covariance;
  const S = P.slice(0, 4).map((row, i) => row.slice(0, 4).map((value, j) => value + (i === j ? 4 : 0)));
  const K = multiply(P.map((row) => row.slice(0, 4)), inverse(S));
  const innovation = measurement2.map((value, i) => [value - state.mean[i]]);
  const delta = multiply(K, innovation);
  const mean = state.mean.map((value, i) => value + delta[i][0]);
  const A = identity(8).map((row, i) => row.map((value, j) => value - (j < 4 ? K[i][j] : 0)));
  return checked(mean, add(multiply(multiply(A, P), transpose(A)), multiply(K.map((row) => row.map((value) => value * 4)), transpose(K))));
}
function squaredMahalanobisDistance(state, measurement2) {
  if (measurement2.length !== 4 || !measurement2.every(Number.isFinite)) throw new TrackingError("NUMERICAL_FAILURE", "\u8FD0\u52A8\u95E8\u63A7\u89C2\u6D4B\u4E0D\u53EF\u8868\u793A");
  const covariance = state.covariance.slice(0, 4).map((row, i) => row.slice(0, 4).map((value, j) => value + (i === j ? 4 : 0)));
  const innovation = measurement2.map((value, i) => value - state.mean[i]);
  const weighted = multiply([innovation], inverse(covariance))[0];
  const distance = weighted.reduce((sum, value, i) => sum + value * innovation[i], 0);
  if (!Number.isFinite(distance) || distance < 0) throw new TrackingError("NUMERICAL_FAILURE", "\u8FD0\u52A8\u95E8\u63A7\u8DDD\u79BB\u4E0D\u53EF\u8868\u793A");
  return distance;
}
function toBox(state) {
  const [cx, cy, width, height] = state.mean;
  const box = { x: cx - width / 2, y: cy - height / 2, width, height };
  if (!Object.values(box).every(Number.isFinite)) throw new TrackingError("NUMERICAL_FAILURE", "\u8F93\u51FA\u6846\u4E0D\u53EF\u8868\u793A");
  return box;
}

// .tmp/botsort-feasibility/code/ocsort.ts
var centre = (box) => [box.x + box.width / 2, box.y + box.height / 2];
function observationCentres(first, second) {
  return [centre(first), centre(second)];
}
function direction(segment) {
  const dx = segment[1][0] - segment[0][0];
  const dy = segment[1][1] - segment[0][1];
  return dx === 0 && dy === 0 ? null : Math.atan2(dy, dx);
}
function directionDifferenceRadians(track, intention) {
  const trackDirection = direction(track);
  const intentionDirection = direction(intention);
  if (trackDirection === null || intentionDirection === null) return 0;
  const difference = Math.abs(trackDirection - intentionDirection);
  return Math.min(difference, Math.PI * 2 - difference);
}
function ocmAssociationScore(iouValue, angleRadians, weight) {
  return iouValue - weight * angleRadians / Math.PI;
}
function ocmScoreFromHistory(iouValue, history, detection, weight, deltaMs) {
  if (history.length < 2) return iouValue;
  const latest = history[history.length - 1];
  const prior = [...history].reverse().slice(1).find((item) => latest.timestampMs - item.timestampMs >= deltaMs);
  if (!prior) return iouValue;
  const trackDirection = observationCentres(prior.box, latest.box);
  const intentionDirection = observationCentres(latest.box, detection);
  return ocmAssociationScore(iouValue, directionDifferenceRadians(trackDirection, intentionDirection), weight);
}
function interpolateObservationBox(start, end, timestampMs, startMs, endMs) {
  if (endMs <= startMs || timestampMs <= startMs) return { ...start };
  if (timestampMs >= endMs) return { ...end };
  const ratio = (timestampMs - startMs) / (endMs - startMs);
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
    width: start.width + (end.width - start.width) * ratio,
    height: start.height + (end.height - start.height) * ratio
  };
}
var measurement = (box) => [box.x + box.width / 2, box.y + box.height / 2, box.width, box.height];
function replayObservationFilter(initial, start, current, missingTimestamps, maxReplaySteps) {
  if (missingTimestamps.length > maxReplaySteps) throw new TrackingError("NUMERICAL_FAILURE", "OC-SORT \u7F3A\u5931\u91CD\u653E\u8D85\u8FC7\u4E0A\u9650");
  let state = { mean: [...initial.mean], covariance: initial.covariance.map((row) => [...row]) };
  let previousMs = start.timestampMs;
  for (const timestampMs of missingTimestamps) {
    if (!(timestampMs > previousMs && timestampMs < current.timestampMs)) throw new TrackingError("NUMERICAL_FAILURE", "OC-SORT \u7F3A\u5931\u65F6\u95F4\u6233\u987A\u5E8F\u975E\u6CD5");
    state = predict(state, (timestampMs - previousMs) / 1e3);
    state = correct(state, measurement(interpolateObservationBox(start.box, current.box, timestampMs, start.timestampMs, current.timestampMs)));
    previousMs = timestampMs;
  }
  state = predict(state, (current.timestampMs - previousMs) / 1e3);
  return correct(state, measurement(current.box));
}

// .tmp/botsort-feasibility/code/tracker.ts
var defaults = {
  algorithm: "bytetrack",
  lowScoreThreshold: 0.1,
  highScoreThreshold: 0.5,
  newTrackThreshold: 0.6,
  minHits: 2,
  matchIouThreshold: 0.3,
  lowMatchIouThreshold: 0.2,
  maxLostMs: 1e3,
  largeGapMs: 2e3,
  maxDetections: 100,
  maxTracks: 200,
  ocmWeight: 0.2,
  ocmDeltaMs: 300,
  ocmHistoryLength: 30,
  oruMaxReplaySteps: 30,
  featureSpace: null,
  maxCosineDistance: 0.2,
  gallerySize: 30
};
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var finite = (value) => typeof value === "number" && Number.isFinite(value);
var positive = (value) => finite(value) && value > 0;
var probability = (value) => finite(value) && value >= 0 && value <= 1;
var now = () => performance.now();
function copyFilter(state) {
  return { mean: [...state.mean], covariance: state.covariance.map((row) => [...row]) };
}
function parseOptions(value) {
  const fail = () => {
    throw new TrackingError("INVALID_OPTIONS", "\u8DDF\u8E2A\u53C2\u6570\u4E0D\u6EE1\u8DB3\u8303\u56F4\u6216\u9608\u503C\u987A\u5E8F\u7EA6\u675F");
  };
  if (!record(value)) return fail();
  if (Reflect.ownKeys(value).some((key) => !Object.hasOwn(defaults, key))) return fail();
  const algorithm = Object.hasOwn(value, "algorithm") ? value.algorithm : defaults.algorithm;
  if (algorithm !== "bytetrack" && algorithm !== "ocsort" && algorithm !== "deepsort") return fail();
  const byteTrackOnly = ["lowScoreThreshold", "lowMatchIouThreshold"];
  const ocSortOnly = ["ocmWeight", "ocmDeltaMs", "ocmHistoryLength", "oruMaxReplaySteps"];
  const deepSortOnly = ["featureSpace", "maxCosineDistance", "gallerySize"];
  if (algorithm === "ocsort" && [...byteTrackOnly, ...deepSortOnly].some((key) => Object.hasOwn(value, key))) return fail();
  if (algorithm === "bytetrack" && [...ocSortOnly, ...deepSortOnly].some((key) => Object.hasOwn(value, key))) return fail();
  if (algorithm === "deepsort" && [...byteTrackOnly, ...ocSortOnly].some((key) => Object.hasOwn(value, key))) return fail();
  let featureSpace = null;
  if (algorithm === "deepsort") {
    if (!Object.hasOwn(value, "featureSpace") || !record(value.featureSpace)) return fail();
    if (Reflect.ownKeys(value.featureSpace).length !== 2 || !Object.hasOwn(value.featureSpace, "id") || !Object.hasOwn(value.featureSpace, "dimension")) return fail();
    const { id, dimension } = value.featureSpace;
    if (typeof id !== "string" || id.length < 1 || id.length > 256 || id.trim() !== id) return fail();
    if (typeof dimension !== "number" || !Number.isSafeInteger(dimension) || dimension < 1 || dimension > 2048) return fail();
    featureSpace = { id, dimension };
  }
  const options = { ...defaults, ...value, algorithm, featureSpace };
  for (const key of ["lowScoreThreshold", "highScoreThreshold", "newTrackThreshold", "matchIouThreshold", "lowMatchIouThreshold"]) if (!probability(options[key])) return fail();
  if (algorithm === "bytetrack" && options.highScoreThreshold < options.lowScoreThreshold || options.newTrackThreshold < options.highScoreThreshold) return fail();
  for (const key of ["minHits", "maxDetections", "maxTracks"]) if (!Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > (key === "minHits" ? 100 : 500)) return fail();
  if (!positive(options.maxLostMs) || !positive(options.largeGapMs) || options.largeGapMs < options.maxLostMs) return fail();
  if (!probability(options.ocmWeight) || !finite(options.ocmDeltaMs) || options.ocmDeltaMs < 1 || options.ocmDeltaMs > 1e4) return fail();
  if (!Number.isSafeInteger(options.ocmHistoryLength) || options.ocmHistoryLength < 2 || options.ocmHistoryLength > 120) return fail();
  if (!Number.isSafeInteger(options.oruMaxReplaySteps) || options.oruMaxReplaySteps < 1 || options.oruMaxReplaySteps > 60) return fail();
  if (!finite(options.maxCosineDistance) || options.maxCosineDistance < 0 || options.maxCosineDistance > 2) return fail();
  if (!Number.isSafeInteger(options.gallerySize) || options.gallerySize < 1 || options.gallerySize > 100) return fail();
  if (featureSpace && options.maxTracks * options.gallerySize * featureSpace.dimension > 4e6) return fail();
  return options;
}
function validateFrame(value, previous, size, options) {
  const fail = () => {
    throw new TrackingError("INVALID_INPUT", "\u5E27\u3001\u65F6\u95F4\u6233\u3001\u56FE\u50CF\u5C3A\u5BF8\u6216\u68C0\u6D4B\u6846\u975E\u6CD5\uFF1B\u8DF3\u8F6C\u6216\u5C3A\u5BF8\u53D8\u5316\u8BF7\u5148 reset");
  };
  if (!record(value) || !finite(value.timestampMs) || value.timestampMs < 0 || previous !== null && value.timestampMs <= previous) return fail();
  if (!record(value.imageSize) || !positive(value.imageSize.width) || !positive(value.imageSize.height)) return fail();
  if (size && (value.imageSize.width !== size.width || value.imageSize.height !== size.height)) return fail();
  if (!Array.isArray(value.detections) || value.detections.length > options.maxDetections) return fail();
  if (options.algorithm === "deepsort" && value.featureSpaceId !== options.featureSpace?.id) return fail();
  const detections = [];
  for (const detection of value.detections) {
    if (!record(detection) || !probability(detection.score) || !Number.isSafeInteger(detection.classId) || detection.classId < 0 || !record(detection.box)) return fail();
    const box = detection.box;
    if (!finite(box.x) || !finite(box.y) || box.x < 0 || box.y < 0 || !positive(box.width) || !positive(box.height)) return fail();
    if (box.width > value.imageSize.width || box.height > value.imageSize.height || box.x > value.imageSize.width - box.width || box.y > value.imageSize.height - box.height) return fail();
    const embedding = options.algorithm === "deepsort" ? normalizeEmbedding(detection.embedding, options.featureSpace.dimension) : void 0;
    detections.push({ box: { ...box }, score: detection.score, classId: detection.classId, ...embedding ? { embedding } : {} });
  }
  return { timestampMs: value.timestampMs, imageSize: { ...value.imageSize }, detections, ...options.algorithm === "deepsort" ? { featureSpaceId: value.featureSpaceId } : {} };
}
function snapshot(entry, timestamp) {
  return { id: entry.id, classId: entry.classId, state: entry.state, box: toBox(entry.filter), observed: entry.score !== null, score: entry.score, ageMs: timestamp - entry.firstMs, hits: entry.hits, missedMs: timestamp - entry.lastSeenMs };
}
function cloneEntry(entry) {
  return {
    ...entry,
    score: null,
    filter: copyFilter(entry.filter),
    lastObservedFilter: copyFilter(entry.lastObservedFilter),
    observations: entry.observations.map((observation) => ({ ...observation, box: { ...observation.box } })),
    missingTimestamps: [...entry.missingTimestamps],
    gallery: entry.gallery.map((sample) => [...sample])
  };
}
function createTracker(input = {}, probe = { motion: false, appearance: false }) {
  const options = parseOptions(input);
  let entries = [], timestamp = null, size = null;
  let generation = 0, nextId = 1, disposed = false;
  const ensureActive = () => {
    if (disposed) throw new TrackingError("DISPOSED", "\u8DDF\u8E2A\u5B9E\u4F8B\u5DF2\u91CA\u653E");
  };
  return {
    update(inputFrame, updateOptions = {}) {
      ensureActive();
      const start = now();
      if (!record(updateOptions) || updateOptions.signal !== void 0 && (!record(updateOptions.signal) || typeof updateOptions.signal.aborted !== "boolean")) throw new TrackingError("INVALID_INPUT", "\u53D6\u6D88\u53C2\u6570\u975E\u6CD5");
      if (updateOptions.signal?.aborted) throw new TrackingError("ABORTED", "\u8BA1\u7B97\u5F00\u59CB\u524D\u5DF2\u53D6\u6D88");
      const frame = validateFrame(inputFrame, timestamp, size, options);
      const matrix = probe.motion ? inputFrame.motionMatrix ?? [1, 0, 0, 0, 1, 0] : [1, 0, 0, 0, 1, 0];
      if (probe.appearance) for (let i = 0; i < frame.detections.length; i++) frame.detections[i].embedding = normalizeEmbedding(inputFrame.detections[i].embedding, 512);
      const validationEnd = now(), time = frame.timestampMs;
      const dt = timestamp === null ? 0 : (time - timestamp) / 1e3;
      const gap = timestamp !== null && time - timestamp > options.largeGapMs;
      const removed = [];
      let working = entries.map(cloneEntry);
      working = working.filter((entry) => {
        if (gap || entry.state === "lost" && time - entry.lastSeenMs > options.maxLostMs) {
          removed.push({ ...snapshot(entry, time), state: "removed" });
          return false;
        }
        return true;
      });
      for (const entry of working) entry.filter = compensate(predict(entry.filter, dt), matrix);
      const predictionEnd = now();
      const high = frame.detections.map((detection, index) => ({ detection, index })).filter(({ detection }) => detection.score >= options.highScoreThreshold);
      const low = frame.detections.map((detection, index) => ({ detection, index })).filter(({ detection }) => detection.score >= options.lowScoreThreshold && detection.score < options.highScoreThreshold);
      const matches = /* @__PURE__ */ new Map(), used = /* @__PURE__ */ new Set();
      const associate = (candidates, observations, threshold, recovery = false, appearance = true) => {
        const raw = candidates.map((entry) => observations.map(({ detection }) => entry.classId === detection.classId ? recovery && entry.observations.length ? iou(entry.observations[entry.observations.length - 1].box, detection.box) : iou(toBox(entry.filter), detection.box) : -1));
        const similarities = candidates.map((entry, row) => observations.map(({ detection }, column) => {
          const rawValue = raw[row][column];
          if (probe.appearance && appearance && detection.score >= options.highScoreThreshold && rawValue >= 0.5 && entry.gallery.length) {
            const distance = minimumCosineDistance(detection.embedding, entry.gallery);
            if (distance <= 0.25) return Math.max(rawValue, 1 - distance / 2);
          }
          return options.algorithm === "ocsort" && !recovery && rawValue >= 0 ? ocmScoreFromHistory(rawValue, entry.observations, detection.box, options.ocmWeight, options.ocmDeltaMs) : rawValue;
        }));
        const pairs = assign(similarities, threshold, options.algorithm === "ocsort" && !recovery ? (_score, row, column) => raw[row][column] >= threshold : void 0);
        for (const [row, col] of pairs) {
          matches.set(candidates[row], observations[col].detection);
          used.add(observations[col].index);
        }
      };
      if (options.algorithm === "deepsort") {
        const confirmed = working.filter((entry) => entry.state !== "tentative");
        const groups = [...new Set(confirmed.map((entry) => entry.lastSeenMs))].sort((a, b) => b - a);
        for (const lastSeenMs of groups) {
          const candidates = confirmed.filter((entry) => entry.lastSeenMs === lastSeenMs);
          const observations = high.filter(({ index }) => !used.has(index));
          const similarities = candidates.map((entry) => observations.map(({ detection }) => 1 - minimumCosineDistance(detection.embedding, entry.gallery)));
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
        associate(working.filter((entry) => (entry.state === "tentative" || entry.state === "tracked") && !matches.has(entry)), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold);
      } else {
        associate(working.filter((entry) => entry.state !== "tentative"), high, options.matchIouThreshold);
        if (options.algorithm === "ocsort") associate(working.filter((entry) => entry.state !== "tentative" && !matches.has(entry)), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold, true);
        if (options.algorithm === "bytetrack") associate(working.filter((entry) => entry.state === "tracked" && !matches.has(entry)), low, options.lowMatchIouThreshold);
        associate(working.filter((entry) => entry.state === "tentative"), high.filter(({ index }) => !used.has(index)), options.matchIouThreshold);
      }
      const associationEnd = now();
      working = working.filter((entry) => {
        const detection = matches.get(entry);
        if (detection) {
          const wasLost = entry.state === "lost";
          const observation = { timestampMs: time, box: { ...detection.box }, score: detection.score };
          if (options.algorithm === "ocsort" && wasLost && entry.observations.length) {
            entry.filter = replayObservationFilter(entry.lastObservedFilter, entry.observations[entry.observations.length - 1], observation, entry.missingTimestamps, options.oruMaxReplaySteps);
          } else {
            const b = detection.box;
            entry.filter = correct(entry.filter, [b.x + b.width / 2, b.y + b.height / 2, b.width, b.height]);
          }
          entry.hits++;
          entry.lastSeenMs = time;
          entry.score = detection.score;
          entry.observations.push(observation);
          if (entry.observations.length > options.ocmHistoryLength) entry.observations.shift();
          entry.lastObservedFilter = copyFilter(entry.filter);
          entry.missingTimestamps = [];
          if (options.algorithm === "deepsort") appendToGallery(entry.gallery, detection.embedding, options.gallerySize);
          if (entry.hits >= options.minHits) entry.state = "tracked";
          return true;
        }
        if (entry.state === "tentative") {
          removed.push({ ...snapshot(entry, time), state: "removed" });
          return false;
        }
        entry.state = "lost";
        if (options.algorithm === "ocsort") {
          entry.missingTimestamps.push(time);
          if (entry.missingTimestamps.length > options.oruMaxReplaySteps) {
            removed.push({ ...snapshot(entry, time), state: "removed" });
            return false;
          }
        }
        return true;
      });
      let localNextId = nextId, droppedDetections = 0;
      for (const { detection, index } of high) {
        if (used.has(index) || detection.score < options.newTrackThreshold) continue;
        if (working.length >= options.maxTracks) {
          droppedDetections++;
          continue;
        }
        if (!Number.isSafeInteger(localNextId)) throw new TrackingError("ID_EXHAUSTED", "\u672C\u4EE3\u6B21\u8F68\u8FF9 ID \u5DF2\u8017\u5C3D\uFF0C\u8BF7 reset");
        const filter = initialize(detection.box);
        working.push({
          id: localNextId++,
          classId: detection.classId,
          state: options.minHits === 1 ? "tracked" : "tentative",
          filter,
          lastObservedFilter: copyFilter(filter),
          firstMs: time,
          lastSeenMs: time,
          hits: 1,
          score: detection.score,
          observations: [{ timestampMs: time, box: { ...detection.box }, score: detection.score }],
          missingTimestamps: [],
          gallery: options.algorithm === "deepsort" || probe.appearance ? [[...detection.embedding]] : []
        });
      }
      if (probe.appearance) for (const entry of working) {
        const d = matches.get(entry);
        if (d && d.score >= options.highScoreThreshold) entry.gallery = [entry.gallery.length ? normalizeEmbedding(entry.gallery[0].map((x, i) => 0.9 * x + 0.1 * d.embedding[i]), 512) : [...d.embedding]];
      }
      const tracks = working.map((entry) => snapshot(entry, time));
      removed.sort((a, b) => a.id - b.id);
      const updateEnd = now();
      const result = {
        generation,
        algorithm: options.algorithm,
        timestampMs: time,
        tracks,
        removed,
        droppedDetections,
        runtime: { requestedBackend: "cpu", actualBackend: "cpu", executionMode: "main", runtimeVersion: "web-sdk-pp-tracking@0.2.0-rc.0" },
        timings: { validationMs: validationEnd - start, predictionMs: predictionEnd - validationEnd, associationMs: associationEnd - predictionEnd, updateMs: updateEnd - associationEnd, totalMs: now() - start }
      };
      entries = working;
      nextId = localNextId;
      timestamp = time;
      size = frame.imageSize;
      return result;
    },
    reset() {
      ensureActive();
      if (!Number.isSafeInteger(generation + 1)) throw new TrackingError("ID_EXHAUSTED", "\u4EE3\u6B21\u5DF2\u8017\u5C3D\uFF0C\u8BF7\u521B\u5EFA\u65B0\u5B9E\u4F8B");
      entries = [];
      timestamp = null;
      size = null;
      nextId = 1;
      generation++;
    },
    dispose() {
      entries = [];
      timestamp = null;
      size = null;
      disposed = true;
    }
  };
}
export {
  createTracker
};
