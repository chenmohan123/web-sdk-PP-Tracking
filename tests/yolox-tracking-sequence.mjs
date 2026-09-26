import {
  serializeTrackingResult,
  serializeYoloxDetections,
} from './yolox-serialization.mjs';

function sortedIds(tracks) {
  return tracks.map(track => track.id).sort((left, right) => left - right);
}

// 保留集合按分数降序，相邻最小正间隔暴露近平局取舍风险；少于两框时为 null。
function minimumAdjacentScoreGap(detections) {
  let gap = null;
  for (let index = 1; index < detections.length; index += 1) {
    const delta = detections[index - 1].score - detections[index].score;
    if (delta > 0 && (gap === null || delta < gap)) gap = delta;
  }
  return gap;
}

export async function runYoloxTrackingSequence({
  frames,
  detector,
  tracker,
  digest,
  serializeDetections = serializeYoloxDetections,
}) {
  const evidenceFrames = [];
  for (const frame of frames) {
    const detection = await detector.detect({ image: frame.image });
    const tracking = tracker.update({
      timestampMs: frame.timestampMs,
      imageSize: { width: frame.image.width, height: frame.image.height },
      detections: detection.detections,
    });
    const detectionSerialization = serializeDetections(detection);
    const trackingSerialization = serializeTrackingResult(tracking);
    evidenceFrames.push({
      id: frame.id,
      timestampMs: frame.timestampMs,
      events: [...frame.events],
      image: {
        width: frame.image.width,
        height: frame.image.height,
        bytes: frame.image.data.byteLength,
        sha256: await digest(frame.image.data),
      },
      detectorGeneration: detection.generation,
      detectionCount: detection.detections.length,
      droppedDetections: detection.droppedDetections,
      minimumAdjacentScoreGap: minimumAdjacentScoreGap(detection.detections),
      detectionSha256: await digest(detectionSerialization),
      trackingSha256: await digest(trackingSerialization),
      activeTrackIds: sortedIds(tracking.tracks),
      observedTrackIds: sortedIds(tracking.tracks.filter(track => track.observed)),
      lostTrackIds: sortedIds(tracking.tracks.filter(track => track.state === 'lost')),
      removedTrackIds: sortedIds(tracking.removed),
    });
  }

  return {
    frames: evidenceFrames,
    sequence: {
      frameCount: evidenceFrames.length,
      detectionSha256: await digest(
        evidenceFrames.map(frame => frame.detectionSha256).join('\n'),
      ),
      trackingSha256: await digest(
        evidenceFrames.map(frame => frame.trackingSha256).join('\n'),
      ),
    },
  };
}
