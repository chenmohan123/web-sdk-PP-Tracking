export type YoloxErrorCode =
  | 'INVALID_OPTIONS'
  | 'INVALID_INPUT'
  | 'INVALID_MANIFEST'
  | 'UNSUPPORTED_BACKEND'
  | 'INTEGRITY_FAILED'
  | 'OUT_OF_MEMORY'
  | 'SESSION_FAILED'
  | 'INFERENCE_FAILED'
  | 'ABORTED'
  | 'BUSY'
  | 'NOT_LOADED'
  | 'DISPOSED';

export class YoloxError extends Error {
  readonly code: YoloxErrorCode;
  readonly reason: string;

  constructor(code: YoloxErrorCode, reason: string) {
    super(reason);
    this.name = 'YoloxError';
    this.code = code;
    this.reason = reason;
  }
}

export function aborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new YoloxError('ABORTED', '操作已取消');
  }
}

export function safeError(
  error: unknown,
  code: YoloxErrorCode,
): YoloxError {
  if (error instanceof YoloxError) {
    return error;
  }

  const message = error instanceof Error ? error.message : '';
  if (
    /out of memory|allocation failed|cannot allocate memory|invalid typed array length/i
      .test(message)
  ) {
    return new YoloxError('OUT_OF_MEMORY', '运行环境内存不足');
  }

  const reasons: Partial<Record<YoloxErrorCode, string>> = {
    INVALID_OPTIONS: '检测器选项无效',
    INVALID_INPUT: '检测输入无效',
    INTEGRITY_FAILED: '模型完整性校验失败',
    SESSION_FAILED: '模型会话创建失败',
    INFERENCE_FAILED: '检测推理失败',
  };
  return new YoloxError(code, reasons[code] ?? '操作失败');
}
