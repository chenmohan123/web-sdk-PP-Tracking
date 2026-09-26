import model from '../../models/yolox-tiny/0.1.0/model.json';
import sources from '../../models/yolox-tiny/0.1.0/sources.json';
import { aborted, YoloxError } from './errors';
import type {
  LoadProgress,
  YoloxLoadTimings,
  YoloxOptions,
} from './types';

export const MODEL_BYTES = model.bytes;
export const MODEL_SHA256 = model.sha256;
export const INPUT_NAME = model.input.name;
export const OUTPUT_NAME = model.output.name;

export interface ValidatedYoloxOptions {
  backend: 'wasm' | 'webgpu';
  modelBytes?: ArrayBuffer;
  scoreThreshold: number;
  nmsThreshold: number;
  maxDetections: number;
}

const ALLOWED_OPTIONS = new Set([
  'modelId',
  'backend',
  'modelBytes',
  'scoreThreshold',
  'nmsThreshold',
  'maxDetections',
]);

export function validateOptions(
  options: YoloxOptions,
): ValidatedYoloxOptions {
  if (!options || typeof options !== 'object') {
    throw new YoloxError('INVALID_OPTIONS', '检测器选项必须是对象');
  }

  const values = options as unknown as Record<string, unknown>;
  if ('source' in values) {
    throw new YoloxError(
      'INVALID_MANIFEST',
      '候选模型尚无授权远程分发来源',
    );
  }
  for (const key of Object.keys(values)) {
    if (!ALLOWED_OPTIONS.has(key)) {
      throw new YoloxError('INVALID_OPTIONS', `未知检测器选项：${key}`);
    }
  }

  if (values.modelId !== model.id) {
    throw new YoloxError('INVALID_MANIFEST', '模型标识不受支持');
  }
  if (values.backend !== 'wasm' && values.backend !== 'webgpu') {
    throw new YoloxError(
      'UNSUPPORTED_BACKEND',
      '必须显式选择 wasm 或 webgpu',
    );
  }

  const scoreThreshold = values.scoreThreshold ?? 0.1;
  if (
    typeof scoreThreshold !== 'number' ||
    !Number.isFinite(scoreThreshold) ||
    scoreThreshold < 0 ||
    scoreThreshold > 1
  ) {
    throw new YoloxError('INVALID_OPTIONS', '分数阈值必须在 0 至 1 之间');
  }

  const nmsThreshold = values.nmsThreshold ?? 0.7;
  if (
    typeof nmsThreshold !== 'number' ||
    !Number.isFinite(nmsThreshold) ||
    nmsThreshold < 0 ||
    nmsThreshold > 1
  ) {
    throw new YoloxError('INVALID_OPTIONS', 'NMS 阈值必须在 0 至 1 之间');
  }

  const maxDetections = values.maxDetections ?? 100;
  if (
    typeof maxDetections !== 'number' ||
    !Number.isInteger(maxDetections) ||
    maxDetections < 1 ||
    maxDetections > 1_000
  ) {
    throw new YoloxError(
      'INVALID_OPTIONS',
      '检测数上限必须是 1 至 1000 的整数',
    );
  }

  if (values.modelBytes === undefined) {
    const status = sources.status;
    const count = sources.distributions.length;
    throw new YoloxError(
      'INVALID_MANIFEST',
      status === 'pending-authorization' && count === 0
        ? '候选模型尚无授权分发来源，必须显式提供 modelBytes'
        : '候选模块仅支持显式 modelBytes',
    );
  }
  if (
    !(values.modelBytes instanceof ArrayBuffer) ||
    values.modelBytes.byteLength !== MODEL_BYTES
  ) {
    throw new YoloxError(
      'INVALID_INPUT',
      '模型须为大小匹配的独立 ArrayBuffer',
    );
  }

  let modelBytes: ArrayBuffer;
  try {
    modelBytes = values.modelBytes.slice(0);
  } catch (error) {
    throw new YoloxError(
      'INVALID_INPUT',
      error instanceof Error
        ? '模型字节无法复制'
        : '模型字节无效',
    );
  }

  return {
    backend: values.backend,
    modelBytes,
    scoreThreshold,
    nmsThreshold,
    maxDetections,
  };
}

export async function verifyModelBytes(
  bytes: ArrayBuffer,
  signal: AbortSignal,
  notify: (progress: LoadProgress) => void,
  timings: YoloxLoadTimings,
): Promise<void> {
  aborted(signal);
  const start = performance.now();
  notify({
    stage: 'integrity',
    status: 'start',
    loaded: 0,
    total: MODEL_BYTES,
  });
  try {
    if (bytes.byteLength !== MODEL_BYTES) {
      throw new YoloxError(
        'INTEGRITY_FAILED',
        '模型实际字节数不匹配',
      );
    }
    const hash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', bytes),
    );
    aborted(signal);
    const actual = Array.from(
      hash,
      value => value.toString(16).padStart(2, '0'),
    ).join('');
    if (actual !== MODEL_SHA256) {
      throw new YoloxError(
        'INTEGRITY_FAILED',
        '模型 SHA-256 不匹配',
      );
    }
    notify({
      stage: 'integrity',
      status: 'complete',
      loaded: MODEL_BYTES,
      total: MODEL_BYTES,
    });
    aborted(signal);
  } finally {
    timings.integrityMs += performance.now() - start;
  }
}
