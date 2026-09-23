import type { GrayImage } from './input.js';
import { mad, median, solveAffine, transformPoint, type PointMatch } from './math.js';
import type { AffineMatrix, MotionEstimateFailureReason } from './types.js';

export interface MotionCandidate {
  matrix?: AffineMatrix;
  confidence: number;
  inlierCount: number;
  residual?: number;
  reason?: MotionEstimateFailureReason;
}

export function imageVariance(image: GrayImage): number {
  let sum = 0, square = 0;
  for (const value of image.data) { sum += value; square += value * value; }
  const mean = sum / image.data.length;
  return Math.max(0, square / image.data.length - mean * mean);
}

function patchCost(previous: GrayImage, current: GrayImage, x: number, y: number, u: number, v: number, radius: number): number {
  let previousMean = 0, currentMean = 0, count = 0;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    previousMean += previous.data[(y + dy) * previous.width + x + dx];
    currentMean += current.data[(v + dy) * current.width + u + dx];
    count++;
  }
  previousMean /= count; currentMean /= count;
  let cost = 0, energy = 0;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const a = previous.data[(y + dy) * previous.width + x + dx] - previousMean;
    const b = current.data[(v + dy) * current.width + u + dx] - currentMean;
    const difference = a - b;
    cost += difference * difference; energy += a * a + b * b;
  }
  return energy > 1e-8 ? cost / energy : Number.POSITIVE_INFINITY;
}

export function gridPoints(image: GrayImage, columns: number, rows: number, margin: number): { x: number; y: number; score: number }[] {
  const points: { x: number; y: number; score: number }[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = Math.round(margin + (column + 0.5) * (image.width - 2 * margin) / columns);
    const y = Math.round(margin + (row + 0.5) * (image.height - 2 * margin) / rows);
    let score = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const gx = image.data[(y + dy) * image.width + x + dx + 1] - image.data[(y + dy) * image.width + x + dx - 1];
      const gy = image.data[(y + dy + 1) * image.width + x + dx] - image.data[(y + dy - 1) * image.width + x + dx];
      score += gx * gx + gy * gy;
    }
    points.push({ x, y, score });
  }
  return points;
}

export function cornerPoints(image: GrayImage, maximum = 120, margin = 8): { x: number; y: number; score: number }[] {
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = margin; y < image.height - margin; y += 2) for (let x = margin; x < image.width - margin; x += 2) {
    let xx = 0, xy = 0, yy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = image.data[(y + dy) * image.width + x + dx + 1] - image.data[(y + dy) * image.width + x + dx - 1];
      const gy = image.data[(y + dy + 1) * image.width + x + dx] - image.data[(y + dy - 1) * image.width + x + dx];
      xx += gx * gx; xy += gx * gy; yy += gy * gy;
    }
    const trace = xx + yy, determinant = xx * yy - xy * xy;
    const score = (trace - Math.sqrt(Math.max(0, trace * trace - 4 * determinant))) / 2;
    if (score > 1e-4) candidates.push({ x, y, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const selected: typeof candidates = [];
  for (const point of candidates) {
    if (selected.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= 5)) selected.push(point);
    if (selected.length === maximum) break;
  }
  return selected;
}

export function searchMatches(previous: GrayImage, current: GrayImage, points: readonly { x: number; y: number; score: number }[], radius: number, patchRadius: number): PointMatch[] {
  const matches: PointMatch[] = [];
  for (const point of points) {
    if (point.score < 1e-5) continue;
    let best = Number.POSITIVE_INFINITY, second = Number.POSITIVE_INFINITY, bestX = 0, bestY = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const u = point.x + dx, v = point.y + dy;
      if (u < patchRadius || v < patchRadius || u >= current.width - patchRadius || v >= current.height - patchRadius) continue;
      const cost = patchCost(previous, current, point.x, point.y, u, v, patchRadius);
      if (cost < best) { second = best; best = cost; bestX = u; bestY = v; }
      else if (cost < second) second = cost;
    }
    const hasUniquePeak = !Number.isFinite(second) || (best <= second * 0.92 && second - best > 1e-6);
    if (Number.isFinite(best) && best < 0.12 && hasUniquePeak) matches.push({ x: point.x, y: point.y, u: bestX, v: bestY });
  }
  return matches;
}

export function robustTranslation(matches: readonly PointMatch[], minimum: number): MotionCandidate {
  if (matches.length < minimum) return { confidence: 0, inlierCount: 0, reason: 'insufficient-matches' };
  const dx = matches.map(match => match.u - match.x), dy = matches.map(match => match.v - match.y);
  const centerX = median(dx), centerY = median(dy);
  const deviations = matches.map(match => Math.hypot(match.u - match.x - centerX, match.v - match.y - centerY));
  const spread = mad(deviations);
  const threshold = Math.max(1.25, spread * 3);
  const inliers = matches.filter((_, index) => deviations[index] <= threshold);
  if (inliers.length < minimum || inliers.length < matches.length * 0.6) return { confidence: 0, inlierCount: 0, reason: 'quality-threshold' };
  const residual = median(inliers.map(match => Math.hypot(match.u - match.x - centerX, match.v - match.y - centerY)));
  return { matrix: [1, 0, centerX, 0, 1, centerY], confidence: Math.max(0, Math.min(1, inliers.length / matches.length * Math.exp(-residual))), inlierCount: inliers.length, residual };
}

export function robustAffine(matches: readonly PointMatch[], minimum: number): MotionCandidate {
  if (matches.length < Math.max(3, minimum)) return { confidence: 0, inlierCount: 0, reason: 'insufficient-matches' };
  let best: PointMatch[] = [];
  const limit = Math.min(matches.length, 18);
  for (let i = 0; i < limit - 2; i++) for (let j = i + 1; j < limit - 1; j++) for (let k = j + 1; k < limit; k++) {
    const matrix = solveAffine([matches[i], matches[j], matches[k]]);
    if (!matrix) continue;
    const inliers = matches.filter(match => {
      const point = transformPoint(matrix, match.x, match.y);
      return Math.hypot(point.x - match.u, point.y - match.v) <= 1.75;
    });
    if (inliers.length > best.length) best = inliers;
  }
  if (best.length < minimum || best.length < matches.length * 0.6) return { confidence: 0, inlierCount: 0, reason: 'quality-threshold' };
  const matrix = solveAffine(best);
  if (!matrix) return { confidence: 0, inlierCount: 0, reason: 'numerical-instability' };
  const errors = best.map(match => { const point = transformPoint(matrix, match.x, match.y); return Math.hypot(point.x - match.u, point.y - match.v); });
  const residual = median(errors);
  return { matrix, confidence: Math.max(0, Math.min(1, best.length / matches.length * Math.exp(-residual))), inlierCount: best.length, residual };
}
