const CANONICAL_DECIMAL_PLACES = 12;

function canonicalizeNumber(value) {
  return Number(value.toFixed(CANONICAL_DECIMAL_PLACES));
}

function canonicalizeBox(box) {
  return {
    x: canonicalizeNumber(box.x),
    y: canonicalizeNumber(box.y),
    width: canonicalizeNumber(box.width),
    height: canonicalizeNumber(box.height),
  };
}

function canonicalizeTrack(track) {
  return {
    id: track.id,
    classId: track.classId,
    state: track.state,
    observed: track.observed,
    score: track.score === null ? null : canonicalizeNumber(track.score),
    ageMs: track.ageMs,
    hits: track.hits,
    missedMs: track.missedMs,
    box: canonicalizeBox(track.box),
  };
}

function canonicalDetection(detection) {
  return {
    box: canonicalizeBox(detection.box),
    score: canonicalizeNumber(detection.score),
    classId: detection.classId,
  };
}

export function serializeYoloxDetections(result) {
  return JSON.stringify({
    droppedDetections: result.droppedDetections,
    detections: result.detections.map(canonicalDetection),
  });
}

// 零阈值噪声区的 topK 边界是 1e-10 级近平局，运行时尾差可翻转取舍顺序，故按多集合比较。
export function serializeYoloxDetectionsUnordered(result) {
  return JSON.stringify({
    droppedDetections: result.droppedDetections,
    detections: result.detections
      .map(detection => JSON.stringify(canonicalDetection(detection)))
      .sort(),
  });
}

export function serializeTrackingResult(result) {
  return JSON.stringify({
    generation: result.generation,
    algorithm: result.algorithm,
    timestampMs: result.timestampMs,
    droppedDetections: result.droppedDetections,
    tracks: result.tracks.map(canonicalizeTrack),
    removed: result.removed.map(canonicalizeTrack),
  });
}
