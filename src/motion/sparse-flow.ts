import type { GrayImage } from './input.js';
import { cornerPoints, imageVariance, robustAffine, searchMatches, type MotionCandidate } from './matching.js';

export function estimateSparseFlow(previous: GrayImage, current: GrayImage, searchRadius: number, minimum: number): MotionCandidate {
  if (imageVariance(previous) < 1e-5 || imageVariance(current) < 1e-5) return { confidence: 0, inlierCount: 0, reason: 'insufficient-texture' };
  const margin = searchRadius + 5;
  const points = cornerPoints(previous, 120, margin);
  if (points.length < minimum) return { confidence: 0, inlierCount: 0, reason: 'insufficient-texture' };
  return robustAffine(searchMatches(previous, current, points, searchRadius, 3), minimum);
}
