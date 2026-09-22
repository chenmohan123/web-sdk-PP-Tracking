import type { FeatureSpace, TrackerOptions, TrackingFrame, TrackingResult, UpdateOptions } from '../types.js';

export type AffineMatrix = readonly [number, number, number, number, number, number];
export interface MotionEndpoint { frameId: number; timestampMs: number }
export type CameraMotion =
  | { status: 'initial'; from: null; to: MotionEndpoint }
  | { status: 'identity'; from: MotionEndpoint; to: MotionEndpoint }
  | { status: 'estimated'; from: MotionEndpoint; to: MotionEndpoint; matrix: AffineMatrix; source: string; confidence: number }
  | { status: 'unavailable'; from: MotionEndpoint; to: MotionEndpoint; reason: string };
export interface BoTSortFrame extends TrackingFrame { frameId: number; motion: CameraMotion }
export interface BoTSortAppearance {
  featureSpace: FeatureSpace;
  proximityIouThreshold?: number;
  maxCosineDistance?: number;
  emaAlpha?: number;
}
export interface BoTSortOptions extends Pick<TrackerOptions, 'lowScoreThreshold' | 'highScoreThreshold' | 'newTrackThreshold' | 'minHits' | 'matchIouThreshold' | 'lowMatchIouThreshold' | 'maxLostMs' | 'largeGapMs' | 'maxDetections' | 'maxTracks'> {
  motionFailure?: 'error' | 'identity';
  appearance?: BoTSortAppearance;
}
export interface BoTSortResult extends Omit<TrackingResult, 'algorithm' | 'runtime'> {
  algorithm: 'botsort'; frameId: number; motion: CameraMotion & { applied: boolean };
  runtime: { requestedBackend: 'cpu'; actualBackend: 'cpu'; executionMode: 'main'; runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.0+botsort-core.1' };
}
export interface BoTSortTracker {
  update(frame: BoTSortFrame, options?: UpdateOptions): BoTSortResult;
  reset(): void;
  dispose(): void;
}
