import { TrackingError } from './errors.js';
import type { Box } from './types.js';

type Matrix = number[][];
export interface GaussianState { mean: number[]; covariance: Matrix }
const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Number(i === j)));
const transpose = (a: Matrix): Matrix => a[0].map((_, j) => a.map(row => row[j]));
const multiply = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
const add = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((value, j) => value + b[i][j]));

function inverse(a: Matrix): Matrix {
  const n = a.length, unit = identity(n);
  const rows = a.map((row, i) => [...row, ...unit[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    if (!Number.isFinite(rows[pivot][col]) || Math.abs(rows[pivot][col]) < 1e-12) throw new TrackingError('NUMERICAL_FAILURE', '观测协方差不可逆');
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    rows[col] = rows[col].map(value => value / divisor);
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = rows[i][col];
      rows[i] = rows[i].map((value, j) => value - factor * rows[col][j]);
    }
  }
  return rows.map(row => row.slice(n));
}

function checked(mean: number[], covariance: Matrix): GaussianState {
  if (!mean.every(Number.isFinite) || !covariance.every(row => row.every(Number.isFinite))) throw new TrackingError('NUMERICAL_FAILURE', '运动状态出现非有限数值');
  // 浮点误差对称化；尺寸投影只约束输出几何，不声称严格高斯分布。
  const symmetric = covariance.map((row, i) => row.map((value, j) => value / 2 + covariance[j][i] / 2));
  if (symmetric.some((row, i) => row[i] < 0)) throw new TrackingError('NUMERICAL_FAILURE', '协方差出现负方差');
  mean[2] = Math.max(1e-6, mean[2]); mean[3] = Math.max(1e-6, mean[3]);
  return { mean, covariance: symmetric };
}

export function initialize(box: Box): GaussianState {
  return checked([box.x + box.width / 2, box.y + box.height / 2, box.width, box.height, 0, 0, 0, 0], identity(8).map((row, i) => row.map(value => value * (i < 4 ? 100 : 10000))));
}

export function predict(state: GaussianState, dt: number): GaussianState {
  const F = identity(8), Q = identity(8).map(row => row.map(() => 0));
  for (let i = 0; i < 4; i++) {
    F[i][i + 4] = dt;
    Q[i][i] = 25 * dt ** 4 / 4;
    Q[i][i + 4] = Q[i + 4][i] = 25 * dt ** 3 / 2;
    Q[i + 4][i + 4] = 25 * dt ** 2;
  }
  return checked(multiply(F, state.mean.map(value => [value])).map(row => row[0]), add(multiply(multiply(F, state.covariance), transpose(F)), Q));
}

export function correct(state: GaussianState, measurement: number[]): GaussianState {
  const P = state.covariance;
  const S = P.slice(0, 4).map((row, i) => row.slice(0, 4).map((value, j) => value + (i === j ? 4 : 0)));
  const K = multiply(P.map(row => row.slice(0, 4)), inverse(S));
  const innovation = measurement.map((value, i) => [value - state.mean[i]]);
  const delta = multiply(K, innovation);
  const mean = state.mean.map((value, i) => value + delta[i][0]);
  const A = identity(8).map((row, i) => row.map((value, j) => value - (j < 4 ? K[i][j] : 0)));
  // Joseph 形式：P=(I-KH)P(I-KH)^T+KRK^T。
  return checked(mean, add(multiply(multiply(A, P), transpose(A)), multiply(K.map(row => row.map(value => value * 4)), transpose(K))));
}

export function toBox(state: GaussianState): Box {
  const [cx, cy, width, height] = state.mean;
  const box = { x: cx - width / 2, y: cy - height / 2, width, height };
  if (!Object.values(box).every(Number.isFinite)) throw new TrackingError('NUMERICAL_FAILURE', '输出框不可表示');
  return box;
}
