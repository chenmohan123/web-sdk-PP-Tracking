import { mkdir, writeFile } from 'node:fs/promises';
import { estimateMotion } from '../dist/motion/index.js';

const seed = 20260923;
const cases = [
  { id: 'translation-small', matrix: [1, 0, 4, 0, 1, 3] },
  { id: 'translation-medium', matrix: [1, 0, 10, 0, 1, 6] },
  { id: 'translation-large', matrix: [1, 0, 20, 0, 1, 12] },
  { id: 'rotation', matrix: [0.996, -0.087, 8, 0.087, 0.996, -5] },
  { id: 'scale', matrix: [1.04, 0, -6, 0, 1.04, -4] },
  { id: 'affine', matrix: [1.01, 0.035, -5, -0.02, 0.99, 4] },
  { id: 'static', matrix: [1, 0, 0, 0, 1, 0] },
  { id: 'brightness', matrix: [1, 0, 5, 0, 1, 2], brightness: 28 },
  { id: 'occlusion', matrix: [1, 0, 5, 0, 1, 2], occlusion: true },
  { id: 'repeated-texture', matrix: [1, 0, 6, 0, 1, 4], repeated: true },
  { id: 'low-texture', matrix: [1, 0, 2, 0, 1, 1], lowTexture: true },
  { id: 'out-of-range', matrix: [1, 0, 90, 0, 1, 60] },
];
const algorithms = ['translation', 'sparse-flow', 'feature-match'];

function valueAt(x, y, scenario = {}) {
  if (scenario.lowTexture) return 127;
  if (scenario.repeated) return ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) * 150 + 50;
  return Math.sin(x * 0.23) * 35 + Math.cos(y * 0.19) * 35 + ((Math.floor(x) * 17 + Math.floor(y) * 13 + seed) % 41) * 3 + 90;
}

function image(width, height, matrix = [1, 0, 0, 0, 1, 0], scenario = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const [a, b, tx, c, d, ty] = matrix, determinant = a * d - b * c;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceX = (d * (x - tx) - b * (y - ty)) / determinant;
    const sourceY = (-c * (x - tx) + a * (y - ty)) / determinant;
    let value = sourceX >= 0 && sourceY >= 0 && sourceX < width && sourceY < height ? valueAt(sourceX, sourceY, scenario) + (scenario.brightness ?? 0) : 0;
    if (scenario.occlusion && x > width * 0.4 && x < width * 0.65 && y > height * 0.3 && y < height * 0.7) value = 20;
    const index = (y * width + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value)); data[index + 3] = 255;
  }
  return { width, height, data };
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

const results = [];
for (const size of [{ width: 320, height: 180 }, { width: 640, height: 360 }]) {
  for (const scenario of cases) {
    const previous = image(size.width, size.height, undefined, scenario);
    const current = image(size.width, size.height, scenario.matrix, scenario);
    for (const algorithm of algorithms) {
      const result = await estimateMotion({ previous: { image: previous, frameId: 0, timestampMs: 0 }, current: { image: current, frameId: 1, timestampMs: 33 }, imageSize: size }, { algorithm, identityWhenStatic: scenario.id === 'static' });
      const matrixError = result.status === 'failed' ? null : Math.sqrt(result.matrix.reduce((sum, value, index) => sum + (value - scenario.matrix[index]) ** 2, 0));
      results.push({ size, scenario: scenario.id, expectedMatrix: scenario.matrix, algorithm, status: result.status, ...(result.status === 'failed' ? { reason: result.reason } : { matrix: result.matrix, matrixError, confidence: result.confidence, inlierCount: result.inlierCount, residual: result.residual }), timings: result.timings });
    }
  }
}
for (const item of results) if (item.status === 'failed' && !item.reason) throw new Error('失败结果缺少原因');
const grouped = Object.fromEntries(algorithms.map(algorithm => [algorithm, Object.fromEntries([{ width: 320, height: 180 }, { width: 640, height: 360 }].map(size => {
  const values = results.filter(item => item.algorithm === algorithm && item.size.width === size.width).map(item => item.timings.totalMs);
  return [`${size.width}x${size.height}`, { successRate: results.filter(item => item.algorithm === algorithm && item.size.width === size.width && item.status !== 'failed').length / cases.length, totalMsP50: percentile(values, 0.5), totalMsP95: percentile(values, 0.95) }];
}))]));
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), seed, environment: { node: process.version, platform: process.platform, executionMode: 'main', backend: 'cpu', note: 'Node 合成基准；不是浏览器兼容或跨设备性能承诺' }, input: { sizes: [{ width: 320, height: 180 }, { width: 640, height: 360 }], cases: cases.map(({ id }) => id) }, algorithms, results, summary: grouped };
await mkdir('reports/2026-09-23-motion-estimation', { recursive: true });
await writeFile('reports/2026-09-23-motion-estimation/metrics.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
