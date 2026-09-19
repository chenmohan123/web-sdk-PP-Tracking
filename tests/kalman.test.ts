import { expect, test } from 'vitest';
import { initialize, predict, correct } from '../src/kalman';
import reference from './fixtures/math-reference.json';

test('预测与连续更新在不同 dt 下符合独立 NumPy 参考', () => {
  let state = initialize({ x: 20, y: 20, width: 40, height: 80 });
  for (const step of reference.steps) {
    state = predict(state, step.dt);
    compare(state, step.predicted);
    if (step.measurement) state = correct(state, step.measurement);
    compare(state, step.corrected);
  }
});
function compare(actual: any, expected: any) {
  actual.mean.forEach((v: number, i: number) => expect(v).toBeCloseTo(expected.mean[i], 8));
  actual.covariance.forEach((row: number[], i: number) => row.forEach((v, j) => expect(v).toBeCloseTo(expected.covariance[i][j], 8)));
}
test('长期重复更新协方差有限、对称，尺寸保持正数', () => {
  let state = initialize({ x: 0, y: 0, width: 2, height: 2 });
  for (let i = 0; i < 500; i++) {
    state = correct(predict(state, 0.033), [i, i, 1, 1]);
    expect(state.mean[2]).toBeGreaterThan(0);
    for (let j = 0; j < 8; j++) {
      expect(state.covariance[j][j]).toBeGreaterThanOrEqual(0);
      for (let k = 0; k < 8; k++) expect(state.covariance[j][k]).toBeCloseTo(state.covariance[k][j], 10);
    }
  }
});
