export type AffineMatrix = readonly [number, number, number, number, number, number];
export type MotionAlgorithm = 'translation' | 'sparse-flow' | 'feature-match';
export type MotionEstimateStatus = 'estimated' | 'identity' | 'failed';
export type MotionEstimateFailureReason =
  | 'invalid-input'
  | 'frame-order'
  | 'size-mismatch'
  | 'unsupported-input'
  | 'insufficient-texture'
  | 'insufficient-matches'
  | 'numerical-instability'
  | 'quality-threshold'
  | 'runtime-error';

export interface MotionFrame {
  image: ImageData | VideoFrame;
  frameId: number;
  timestampMs: number;
}

export interface MotionEstimateInput {
  previous: MotionFrame;
  current: MotionFrame;
  imageSize: { width: number; height: number };
}

export interface MotionEstimateOptions {
  algorithm?: MotionAlgorithm;
  identityWhenStatic?: boolean;
  maxSearchRadius?: number;
  minInliers?: number;
}

export interface MotionEstimateTimings {
  preprocessMs: number;
  estimateMs: number;
  totalMs: number;
}

export type MotionEstimateSuccess = {
  status: 'estimated' | 'identity';
  matrix: AffineMatrix;
  confidence: number;
  inlierCount: number;
  residual?: number;
  timings: MotionEstimateTimings;
  algorithm: MotionAlgorithm;
  reason?: MotionEstimateFailureReason;
};

export type MotionEstimateFailure = {
  status: 'failed';
  confidence: 0;
  inlierCount: 0;
  timings: MotionEstimateTimings;
  algorithm: MotionAlgorithm;
  reason: MotionEstimateFailureReason;
};

export type MotionEstimateResult = MotionEstimateSuccess | MotionEstimateFailure;
