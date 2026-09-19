export interface Box { x: number; y: number; width: number; height: number }
export interface Detection { box: Box; score: number; classId: number }
export interface TrackingFrame {
  timestampMs: number;
  imageSize: { width: number; height: number };
  detections: Detection[];
}
export type TrackerAlgorithm = 'bytetrack' | 'ocsort';
export interface TrackerOptions {
  algorithm?: TrackerAlgorithm;
  lowScoreThreshold?: number;
  highScoreThreshold?: number;
  newTrackThreshold?: number;
  minHits?: number;
  matchIouThreshold?: number;
  lowMatchIouThreshold?: number;
  maxLostMs?: number;
  largeGapMs?: number;
  maxDetections?: number;
  maxTracks?: number;
  ocmWeight?: number;
  ocmDeltaMs?: number;
  ocmHistoryLength?: number;
  oruMaxReplaySteps?: number;
}
export type TrackState = 'tentative' | 'tracked' | 'lost';
export interface Track {
  id: number; classId: number; box: Box; state: TrackState;
  observed: boolean; score: number | null; ageMs: number; hits: number; missedMs: number;
}
export interface RemovedTrack extends Omit<Track, 'state'> { state: 'removed' }
export interface RuntimeInfo {
  requestedBackend: 'cpu'; actualBackend: 'cpu'; executionMode: 'main';
  runtimeVersion: 'web-sdk-pp-tracking@0.2.0-alpha.0';
}
export interface TrackingTimings {
  validationMs: number; predictionMs: number; associationMs: number; updateMs: number; totalMs: number;
}
export interface TrackingResult {
  generation: number; algorithm: TrackerAlgorithm; timestampMs: number; tracks: Track[]; removed: RemovedTrack[];
  droppedDetections: number; runtime: RuntimeInfo; timings: TrackingTimings;
}
export interface UpdateOptions { signal?: AbortSignal }
export interface Tracker {
  update(frame: TrackingFrame, options?: UpdateOptions): TrackingResult;
  reset(): void;
  dispose(): void;
}
