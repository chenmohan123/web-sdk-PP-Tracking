import type { Detection, TrackingFrame, TrackingResult } from '../src/types.js';
import type { YoloxSyntheticFrame } from './yolox-sequence.mjs';

interface SequenceDetectorResult {
  generation: number;
  detections: Detection[];
  droppedDetections: number;
}

interface SequenceDetector {
  detect(input: { image: YoloxSyntheticFrame['image'] }): Promise<SequenceDetectorResult>;
}

// runner 只读取参与证据序列化的字段，不读取 runtime 与 timings。
type SequenceTrackingSnapshot = Pick<
  TrackingResult,
  'generation' | 'algorithm' | 'timestampMs' | 'droppedDetections' | 'tracks' | 'removed'
>;

interface SequenceTracker {
  update(frame: TrackingFrame): SequenceTrackingSnapshot;
}

type Digest = (value: string | Uint8Array) => Promise<string>;

interface SequenceFrameEvidence {
  id: string;
  timestampMs: number;
  events: string[];
  image: {
    width: number;
    height: number;
    bytes: number;
    sha256: string;
  };
  detectorGeneration: number;
  detectionCount: number;
  droppedDetections: number;
  minimumAdjacentScoreGap: number | null;
  detectionSha256: string;
  trackingSha256: string;
  activeTrackIds: number[];
  observedTrackIds: number[];
  lostTrackIds: number[];
  trackedTrackIds: number[];
  removedTrackIds: number[];
}

export function runYoloxTrackingSequence(options: {
  frames: YoloxSyntheticFrame[];
  detector: SequenceDetector;
  tracker: SequenceTracker;
  digest: Digest;
  serializeDetections?: (result: SequenceDetectorResult) => string;
}): Promise<{
  frames: SequenceFrameEvidence[];
  sequence: {
    frameCount: number;
    detectionSha256: string;
    trackingSha256: string;
  };
}>;
