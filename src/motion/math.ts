import { MotionEstimateError } from './errors.js';
import type { AffineMatrix } from './types.js';

export interface PointMatch { x: number; y: number; u: number; v: number }

export function median(values: readonly number[]): number {
  if (!values.length || !values.every(Number.isFinite)) throw new MotionEstimateError('INVALID_INPUT', '中位数输入必须是非空有限数组');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function mad(values: readonly number[]): number {
  const center = median(values);
  return median(values.map(value => Math.abs(value - center)));
}

function solveLinear(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let j = column; j <= n; j++) augmented[column][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let j = column; j <= n; j++) augmented[row][j] -= factor * augmented[column][j];
    }
  }
  const result = augmented.map(row => row[n]);
  return result.every(Number.isFinite) ? result : null;
}

export function solveAffine(matches: readonly PointMatch[]): AffineMatrix | null {
  if (matches.length < 3) return null;
  const normal = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
  const target = Array<number>(6).fill(0);
  for (const { x, y, u, v } of matches) {
    if (![x, y, u, v].every(Number.isFinite)) return null;
    const rows = [[x, y, 1, 0, 0, 0], [0, 0, 0, x, y, 1]];
    for (const [row, value] of [[rows[0], u], [rows[1], v]] as const) {
      for (let i = 0; i < 6; i++) {
        target[i] += row[i] * value;
        for (let j = 0; j < 6; j++) normal[i][j] += row[i] * row[j];
      }
    }
  }
  const solved = solveLinear(normal, target);
  return solved ? [solved[0], solved[1], solved[2], solved[3], solved[4], solved[5]] : null;
}

export function clampAffine(matrix: AffineMatrix, size: { width: number; height: number }): AffineMatrix {
  const [a, b, tx, c, d, ty] = matrix;
  if (![a, b, tx, c, d, ty].every(Number.isFinite)) throw new MotionEstimateError('INVALID_INPUT', '仿射矩阵必须为有限数');
  const determinant = a * d - b * c;
  const x = a * a + c * c, y = b * b + d * d, z = a * b + c * d;
  const delta = Math.hypot(x - y, 2 * z);
  const minimum = Math.sqrt(Math.max(0, (x + y - delta) / 2));
  const maximum = Math.sqrt(Math.max(0, (x + y + delta) / 2));
  const angle = Math.abs(Math.atan2(c - b, a + d));
  if (!(determinant > 0) || minimum < 0.8 - 1e-10 || maximum > 1.25 + 1e-10 || angle > Math.PI / 12 + 1e-10 || Math.hypot(tx, ty) > 0.25 * Math.hypot(size.width, size.height) + 1e-10) throw new MotionEstimateError('INVALID_INPUT', '仿射矩阵超出局部运动范围');
  return matrix;
}

export function transformPoint(matrix: AffineMatrix, x: number, y: number): { x: number; y: number } {
  return { x: matrix[0] * x + matrix[1] * y + matrix[2], y: matrix[3] * x + matrix[4] * y + matrix[5] };
}

export function photometricResidual(previous: { width: number; height: number; data: Float32Array }, current: { width: number; height: number; data: Float32Array }, matrix: AffineMatrix): number {
  const [a, b, tx, c, d, ty] = matrix;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-8) return Number.POSITIVE_INFINITY;
  const differences: number[] = [];
  for (let y = 2; y < current.height - 2; y += 4) for (let x = 2; x < current.width - 2; x += 4) {
    const sourceX = (d * (x - tx) - b * (y - ty)) / determinant;
    const sourceY = (-c * (x - tx) + a * (y - ty)) / determinant;
    if (sourceX < 2 || sourceY < 2 || sourceX >= previous.width - 2 || sourceY >= previous.height - 2) continue;
    const previousValue = previous.data[Math.round(sourceY) * previous.width + Math.round(sourceX)];
    const currentValue = current.data[y * current.width + x];
    differences.push(currentValue - previousValue);
  }
  if (differences.length < 20) return Number.POSITIVE_INFINITY;
  const offset = median(differences);
  return median(differences.map(value => Math.abs(value - offset)));
}
