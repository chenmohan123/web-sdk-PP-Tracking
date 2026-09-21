export type ReIdErrorCode = 'INVALID_INPUT' | 'INVALID_MANIFEST' | 'UNSUPPORTED_BACKEND' | 'DOWNLOAD_FAILED' | 'INTEGRITY_FAILED' | 'OUT_OF_MEMORY' | 'SESSION_FAILED' | 'INFERENCE_FAILED' | 'ABORTED' | 'BUSY' | 'NOT_LOADED' | 'DISPOSED';
export class ReIdError extends Error {
  readonly code: ReIdErrorCode;
  readonly reason: string;
  constructor(code: ReIdErrorCode, reason: string) { super(reason); this.name = 'ReIdError'; this.code = code; this.reason = reason; }
}
export function aborted(signal?: AbortSignal): void { if (signal?.aborted) throw new ReIdError('ABORTED', '操作已取消'); }
export function safeError(error: unknown, code: ReIdErrorCode): ReIdError {
  if (error instanceof ReIdError) return error;
  // 仅识别明确的内存不足；不将未知设备错误猜测成内存不足，也不回传原始 URL。
  const message = error instanceof Error ? error.message : '';
  if (/out of memory|allocation failed|cannot allocate memory|invalid typed array length/i.test(message)) return new ReIdError('OUT_OF_MEMORY', '运行环境内存不足');
  return new ReIdError(code, ({ DOWNLOAD_FAILED: '当前来源下载失败', SESSION_FAILED: '模型会话创建失败', INFERENCE_FAILED: '特征推理失败' } as Partial<Record<ReIdErrorCode, string>>)[code] ?? '操作失败');
}
