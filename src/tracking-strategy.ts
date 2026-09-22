import type { GaussianState } from './kalman.js';
import type { Detection, FeatureSpace, TrackingFrame } from './types.js';

// 仅供同包候选复用生命周期，非根入口的公开扩展API；钩子不得提交持久状态。
export interface TrackingStrategy {
  featureSpace?: FeatureSpace;
  prepareFrame(frame: TrackingFrame, previousTimestamp: number | null, size: TrackingFrame['imageSize'] | null): TrackingFrame;
  transformPrediction(state: GaussianState): GaussianState;
  similarity?(rawIou: number, detection: Detection, gallery: readonly (readonly number[])[]): number;
  updateGallery?(gallery: number[][], detection: Detection): void;
  initializeGallery?(detection: Detection): number[][];
}
