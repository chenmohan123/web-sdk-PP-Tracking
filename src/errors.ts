export type TrackingErrorCode = 'INVALID_OPTIONS' | 'INVALID_INPUT' | 'ABORTED' | 'DISPOSED' | 'NUMERICAL_FAILURE' | 'ID_EXHAUSTED';
export class TrackingError extends Error {
  constructor(public readonly code: TrackingErrorCode, message: string) {
    super(message);
    this.name = 'TrackingError';
  }
}
