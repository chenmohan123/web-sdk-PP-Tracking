import type { FeatureSpace, TrackerOptions, TrackingFrame, TrackingResult, UpdateOptions, RuntimeInfo } from '../types.js';

export type { AffineMatrix } from '../motion/types.js';
import type { AffineMatrix } from '../motion/types.js';
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
export interface BoTSortTrackerOptions extends BoTSortOptions { algorithm: 'botsort' }
export interface BoTSortResult extends Omit<TrackingResult, 'algorithm' | 'runtime'> {
  algorithm: 'botsort'; frameId: number; motion: CameraMotion & { applied: boolean };
  runtime: RuntimeInfo;
}
export interface BoTSortTracker {
  update: (frame: BoTSortFrame, options?: UpdateOptions) => BoTSortResult;
  reset(): void;
  dispose(): void;
}
