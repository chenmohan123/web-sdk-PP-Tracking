import { MotionEstimateError } from './errors.js';
import type { MotionEstimateInput, MotionEstimateOptions, MotionEstimateResult, MotionAlgorithm } from './types.js';
import { IDENTITY } from './runtime.js';
import { validateAndReadInput } from './input.js';
import { estimateTranslation } from './translation.js';
import { estimateSparseFlow } from './sparse-flow.js';
import { estimateFeatureMatch } from './feature-match.js';
import { clampAffine, photometricResidual } from './math.js';

export type * from './types.js';
export { MotionEstimateError } from './errors.js';

const algorithmOf = (value: MotionEstimateOptions | undefined): MotionAlgorithm => {
  const algorithm = value?.algorithm ?? 'translation';
  if (algorithm !== 'translation' && algorithm !== 'sparse-flow' && algorithm !== 'feature-match') throw new MotionEstimateError('INVALID_OPTIONS', '不支持的运动估计算法');
  if (value?.maxSearchRadius !== undefined && (!Number.isFinite(value.maxSearchRadius) || value.maxSearchRadius < 1 || value.maxSearchRadius > 128)) throw new MotionEstimateError('INVALID_OPTIONS', '搜索半径必须为1到128之间的有限数');
  if (value?.minInliers !== undefined && (!Number.isSafeInteger(value.minInliers) || value.minInliers < 4 || value.minInliers > 120)) throw new MotionEstimateError('INVALID_OPTIONS', '内点下限必须为4到120之间的整数');
  return algorithm;
};

export async function estimateMotion(input: MotionEstimateInput, options: MotionEstimateOptions = {}): Promise<MotionEstimateResult> {
  const algorithm = algorithmOf(options);
  const start = performance.now();
  const images = await validateAndReadInput(input);
  const preprocessedAt = performance.now();
  let difference = 0;
  for (let i = 0; i < images.previous.data.length; i++) difference += Math.abs(images.previous.data[i] - images.current.data[i]);
  difference /= images.previous.data.length;
  if (difference <= 1 / 255 && options.identityWhenStatic) {
    const end = performance.now();
    return { status: 'identity', matrix: IDENTITY, confidence: 1, inlierCount: 0, timings: { preprocessMs: preprocessedAt - start, estimateMs: end - preprocessedAt, totalMs: end - start }, algorithm };
  }
  const searchRadius = Math.floor(options.maxSearchRadius ?? (algorithm === 'feature-match' ? 24 : 12));
  const minimum = options.minInliers ?? (algorithm === 'translation' ? 8 : 6);
  const candidate = algorithm === 'translation'
    ? estimateTranslation(images.previous, images.current, searchRadius, minimum)
    : algorithm === 'sparse-flow'
      ? estimateSparseFlow(images.previous, images.current, searchRadius, minimum)
      : estimateFeatureMatch(images.previous, images.current, searchRadius, minimum);
  const end = performance.now();
  const timings = { preprocessMs: preprocessedAt - start, estimateMs: end - preprocessedAt, totalMs: end - start };
  const minimumConfidence = algorithm === 'sparse-flow' ? 0.8 : 0.5;
  if (!candidate.matrix || candidate.confidence < minimumConfidence) return { status: 'failed', confidence: 0, inlierCount: 0, timings, algorithm, reason: candidate.reason ?? 'quality-threshold' };
  try {
    const matrix = clampAffine(candidate.matrix, input.imageSize);
    if (photometricResidual(images.previous, images.current, matrix) > 0.12) return { status: 'failed', confidence: 0, inlierCount: 0, timings, algorithm, reason: 'quality-threshold' };
    const stationary = Math.abs(matrix[0] - 1) < 1e-5 && Math.abs(matrix[1]) < 1e-5 && Math.abs(matrix[2]) < 0.25 && Math.abs(matrix[3]) < 1e-5 && Math.abs(matrix[4] - 1) < 1e-5 && Math.abs(matrix[5]) < 0.25;
    return { status: stationary && options.identityWhenStatic ? 'identity' : 'estimated', matrix: stationary && options.identityWhenStatic ? IDENTITY : matrix, confidence: candidate.confidence, inlierCount: candidate.inlierCount, residual: candidate.residual, timings, algorithm };
  } catch {
    return { status: 'failed', confidence: 0, inlierCount: 0, timings, algorithm, reason: 'quality-threshold' };
  }
}
