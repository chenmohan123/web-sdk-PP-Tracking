import { ReIdError, safeError } from './errors';
import type { ReIdOptions, ReIdSource } from './types';

export const MODEL_BYTES = 33_704_835;
export const MODEL_SHA256 = '24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4';
export const PREPROCESSING_ID = 'rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1';
export const FEATURE_SPACE = Object.freeze({ id: `pplcnet-reid:${MODEL_SHA256}:${PREPROCESSING_ID}:l2-f32-v1`, dimension: 512 });
export const INPUT_NAME = 'crops';
export const OUTPUT_NAME = 'save_infer_model/scale_0.tmp_0';

export function validateOptions(options: ReIdOptions): { backend: 'wasm' | 'webgpu'; maxDetections: number; modelBytes?: ArrayBuffer; source?: Readonly<ReIdSource> } {
  if (!options || options.modelId !== 'pplcnet-reid-fp32') throw new ReIdError('INVALID_MANIFEST', '模型标识不受支持');
  if (options.backend !== 'wasm' && options.backend !== 'webgpu') throw new ReIdError('UNSUPPORTED_BACKEND', '必须显式选择 wasm 或 webgpu');
  const maxDetections = options.maxDetections ?? 32;
  if (!Number.isInteger(maxDetections) || maxDetections < 1 || maxDetections > 64) throw new ReIdError('INVALID_INPUT', '检测数上限必须是 1 至 64 的整数');
  if ((options.modelBytes !== undefined) === (options.source !== undefined)) throw new ReIdError('INVALID_MANIFEST', '必须且只能指定模型字节或一个来源');
  if (options.modelBytes !== undefined) {
    if (!(options.modelBytes instanceof ArrayBuffer) || options.modelBytes.byteLength !== MODEL_BYTES) throw new ReIdError('INVALID_INPUT', '模型须为大小匹配的独立 ArrayBuffer');
    try { return { backend: options.backend, maxDetections, modelBytes: options.modelBytes.slice(0) }; }
    catch (error) { throw safeError(error, 'INVALID_INPUT'); }
  }
  const s = options.source;
  if (!s || !['modelscope', 'huggingface'].includes(s.kind) || typeof s.repository !== 'string' || !s.repository.trim() ||
      typeof s.path !== 'string' || !s.path.trim() || typeof s.revision !== 'string' || !/^[a-f\d]{40,64}$/i.test(s.revision) ||
      s.bytes !== MODEL_BYTES || s.sha256 !== MODEL_SHA256) throw new ReIdError('INVALID_MANIFEST', '模型来源身份与固定资产不匹配');
  try {
    const url = new URL(s.downloadUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
  } catch { throw new ReIdError('INVALID_MANIFEST', '来源必须使用不含凭据的 HTTPS 地址'); }
  return { backend: options.backend, maxDetections, source: Object.freeze({ kind: s.kind, repository: s.repository, revision: s.revision, path: s.path, downloadUrl: s.downloadUrl, bytes: s.bytes, sha256: s.sha256 }) };
}
