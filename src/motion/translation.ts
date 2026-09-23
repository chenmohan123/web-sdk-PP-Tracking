import type { GrayImage } from './input.js';
import { gridPoints, imageVariance, robustTranslation, searchMatches, type MotionCandidate } from './matching.js';

export function estimateTranslation(previous: GrayImage, current: GrayImage, searchRadius: number, minimum = 8): MotionCandidate {
  if (imageVariance(previous) < 1e-5 || imageVariance(current) < 1e-5) return { confidence: 0, inlierCount: 0, reason: 'insufficient-texture' };
  const patchRadius = 3, margin = searchRadius + patchRadius + 2;
  if (previous.width <= margin * 2 || previous.height <= margin * 2) return { confidence: 0, inlierCount: 0, reason: 'invalid-input' };
  const points = gridPoints(previous, 8, 5, margin);
  return robustTranslation(searchMatches(previous, current, points, searchRadius, patchRadius), minimum);
}
