import { expect, test } from 'vitest';
import { assign } from '../src/assignment';

test('全局分配避免最高 IoU 贪心占用另一轨迹唯一候选', () => {
  expect(assign([[0.9, 0.8], [0.85, 0.1]], 0.3)).toEqual([[0, 1], [1, 0]]);
});
test('门限必须进入优化，不能先分配再过滤', () => {
  expect(assign([[0.9, 0.6], [0.59, 0.29]], 0.3)).toEqual([[0, 1], [1, 0]]);
});
test('矩形、空候选、无有效边与相等代价保持确定', () => {
  expect(assign([[0.7], [0.8]], 0.3)).toEqual([[1, 0]]);
  expect(assign([], 0.3)).toEqual([]);
  expect(assign([[]], 0.3)).toEqual([]);
  expect(assign([[0.2]], 0.3)).toEqual([]);
  expect(assign([[0.5, 0.5], [0.5, 0.5]], 0.5)).toEqual([[0, 0], [1, 1]]);
});

test('729 个小矩阵的匹配数量与总 IoU 等于独立穷举最优值', () => {
  for (let code = 0; code < 729; code++) {
    let digits = code;
    const matrix = Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => {
      const value = [0.1, 0.5, 0.9][digits % 3]; digits = Math.floor(digits / 3); return value;
    }));
    let bestCount = -1, bestSum = -1;
    for (let a = -1; a < 3; a++) for (let b = -1; b < 3; b++) {
      if ((a >= 0 && b === a) || (a >= 0 && matrix[0][a] < 0.3) || (b >= 0 && matrix[1][b] < 0.3)) continue;
      const count = Number(a >= 0) + Number(b >= 0), sum = (a >= 0 ? matrix[0][a] : 0) + (b >= 0 ? matrix[1][b] : 0);
      if (count > bestCount || (count === bestCount && sum > bestSum)) { bestCount = count; bestSum = sum; }
    }
    const pairs = assign(matrix, 0.3);
    expect(pairs).toHaveLength(bestCount);
    expect(pairs.reduce((sum, [i, j]) => sum + matrix[i][j], 0)).toBeCloseTo(bestSum, 12);
  }
});
