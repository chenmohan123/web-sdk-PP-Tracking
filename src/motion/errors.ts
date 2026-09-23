export type MotionEstimateErrorCode = 'INVALID_INPUT' | 'FRAME_ORDER' | 'SIZE_MISMATCH' | 'UNSUPPORTED_INPUT' | 'INVALID_OPTIONS';

export class MotionEstimateError extends Error {
  constructor(public readonly code: MotionEstimateErrorCode, message: string) {
    super(message);
    this.name = 'MotionEstimateError';
  }
}
