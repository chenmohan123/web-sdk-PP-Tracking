import { describe, expect, it } from 'vitest';
import { MotionEstimateError, estimateMotion, type MotionEstimateInput, type MotionEstimateResult } from '../src/motion/index.js';
import { readMotionImage, validateAndReadInput } from '../src/motion/input.js';
import { clampAffine, mad, median, solveAffine } from '../src/motion/math.js';

function makeImageData(width = 64, height = 48, value = 0): ImageData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(value) } as ImageData;
}

function makeInput(overrides: { currentFrameId?: number; currentTimestampMs?: number; size?: { width: number; height: number }; value?: number } = {}): MotionEstimateInput {
  const size = overrides.size ?? { width: 64, height: 48 };
  return {
    previous: { image: makeImageData(size.width, size.height, overrides.value), frameId: 0, timestampMs: 0 },
    current: { image: makeImageData(size.width, size.height, overrides.value), frameId: overrides.currentFrameId ?? 1, timestampMs: overrides.currentTimestampMs ?? 33 },
    imageSize: size,
  };
}

function patternedImage(width = 96, height = 64, shiftX = 0, shiftY = 0): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceX = x - shiftX, sourceY = y - shiftY;
    const value = sourceX >= 0 && sourceY >= 0 && sourceX < width && sourceY < height
      ? (Math.sin(sourceX * 0.47) * 35 + Math.cos(sourceY * 0.31) * 35 + ((sourceX * 17 + sourceY * 13) % 41) * 3 + 90)
      : 0;
    const index = (y * width + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value)); data[index + 3] = 255;
  }
  return { width, height, data } as ImageData;
}

function patternedInput(shiftX: number, shiftY: number, size = { width: 96, height: 64 }): MotionEstimateInput {
  return {
    previous: { image: patternedImage(size.width, size.height), frameId: 0, timestampMs: 0 },
    current: { image: patternedImage(size.width, size.height, shiftX, shiftY), frameId: 1, timestampMs: 33 },
    imageSize: size,
  };
}

function repeatedTextureInput(shiftX: number, shiftY: number, size = { width: 320, height: 180 }): MotionEstimateInput {
  const makeFrame = (offsetX: number, offsetY: number): ImageData => {
    const data = new Uint8ClampedArray(size.width * size.height * 4);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
      const sourceX = x - offsetX, sourceY = y - offsetY;
      const value = sourceX >= 0 && sourceY >= 0 && sourceX < size.width && sourceY < size.height
        ? ((Math.floor(sourceX / 8) + Math.floor(sourceY / 8)) % 2) * 150 + 50
        : 0;
      const index = (y * size.width + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = value;
      data[index + 3] = 255;
    }
    return { width: size.width, height: size.height, data } as ImageData;
  };
  return {
    previous: { image: makeFrame(0, 0), frameId: 0, timestampMs: 0 },
    current: { image: makeFrame(shiftX, shiftY), frameId: 1, timestampMs: 33 },
    imageSize: size,
  };
}

function benchmarkPatternInput(shiftX: number, shiftY: number, size = { width: 640, height: 360 }): MotionEstimateInput {
  const seed = 20260923;
  const makeFrame = (matrix: readonly [number, number, number, number, number, number]): ImageData => {
    const data = new Uint8ClampedArray(size.width * size.height * 4);
    const [a, b, tx, c, d, ty] = matrix;
    const determinant = a * d - b * c;
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
      const sourceX = (d * (x - tx) - b * (y - ty)) / determinant;
      const sourceY = (-c * (x - tx) + a * (y - ty)) / determinant;
      const value = sourceX >= 0 && sourceY >= 0 && sourceX < size.width && sourceY < size.height
        ? Math.sin(sourceX * 0.23) * 35 + Math.cos(sourceY * 0.19) * 35 + ((Math.floor(sourceX) * 17 + Math.floor(sourceY) * 13 + seed) % 41) * 3 + 90
        : 0;
      const index = (y * size.width + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value));
      data[index + 3] = 255;
    }
    return { width: size.width, height: size.height, data } as ImageData;
  };
  return {
    previous: { image: makeFrame([1, 0, 0, 0, 1, 0]), frameId: 0, timestampMs: 0 },
    current: { image: makeFrame([1, 0, shiftX, 0, 1, shiftY]), frameId: 1, timestampMs: 33 },
    imageSize: size,
  };
}

function affineImage(width: number, height: number, matrix: readonly [number, number, number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const [a, b, tx, c, d, ty] = matrix;
  const determinant = a * d - b * c;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceX = (d * (x - tx) - b * (y - ty)) / determinant;
    const sourceY = (-c * (x - tx) + a * (y - ty)) / determinant;
    const value = sourceX >= 0 && sourceY >= 0 && sourceX < width - 1 && sourceY < height - 1
      ? Math.sin(sourceX * 0.47) * 35 + Math.cos(sourceY * 0.31) * 35 + ((Math.floor(sourceX) * 17 + Math.floor(sourceY) * 13) % 41) * 3 + 90 : 0;
    const index = (y * width + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value)); data[index + 3] = 255;
  }
  return { width, height, data } as ImageData;
}

describe('运动估计公共契约', () => {
  it('拒绝缺失输入和不支持的图片对象', async () => {
    await expect(estimateMotion({} as MotionEstimateInput)).rejects.toBeInstanceOf(MotionEstimateError);
    await expect(estimateMotion({ ...makeInput(), previous: { ...makeInput().previous, image: {} as ImageData } })).rejects.toMatchObject({ code: 'UNSUPPORTED_INPUT' });
  });

  it('要求相邻帧编号、递增时间和一致尺寸', async () => {
    await expect(estimateMotion(makeInput({ currentFrameId: 0 }))).rejects.toMatchObject({ code: 'FRAME_ORDER' });
    await expect(estimateMotion(makeInput({ currentTimestampMs: 0 }))).rejects.toMatchObject({ code: 'FRAME_ORDER' });
    await expect(estimateMotion({ ...makeInput(), current: { ...makeInput().current, image: makeImageData(32, 48) } })).rejects.toMatchObject({ code: 'SIZE_MISMATCH' });
  });

  it('低纹理返回不带矩阵的显式失败结果', async () => {
    const result = await estimateMotion(makeInput({ value: 128 }), { algorithm: 'translation' });
    expect(result).toMatchObject({ status: 'failed', reason: 'insufficient-texture', confidence: 0, inlierCount: 0 });
    expect('matrix' in result).toBe(false);
  });

  it('静止基线可显式返回恒等状态', async () => {
    const result = await estimateMotion(makeInput({ value: 128 }), { algorithm: 'translation', identityWhenStatic: true });
    expect(result.status).toBe('identity');
    if (result.status !== 'failed') expect(result.matrix).toEqual([1, 0, 0, 0, 1, 0]);
  });

  it('根入口不暴露运动估计，运动子入口提供类型和函数', async () => {
    const result: MotionEstimateResult = await estimateMotion(makeInput(), { algorithm: 'translation' });
    expect(result.algorithm).toBe('translation');
  });

  it('灰度转换固定使用 RGB 加权且忽略 alpha', async () => {
    const image = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 0]) } as ImageData;
    const gray = await readMotionImage(image, { width: 1, height: 1 });
    expect(gray.data[0]).toBeCloseTo(0.299, 6);
  });

  it('读取输入时返回独立灰度缓冲区并拒绝尺寸不一致', async () => {
    const input = makeInput();
    const result = await validateAndReadInput(input);
    expect(result.previous.data).not.toBe(result.current.data);
    await expect(validateAndReadInput({ ...input, current: { ...input.current, image: makeImageData(32, 48) } })).rejects.toMatchObject({ code: 'SIZE_MISMATCH' });
  });

  it('读取 VideoFrame 时不关闭调用方拥有的帧', async () => {
    let closed = false;
    const frame = {
      codedWidth: 8, codedHeight: 8, displayWidth: 8, displayHeight: 8,
      async copyTo(target: AllowSharedBufferSource) { (target as Uint8ClampedArray).fill(127); return []; },
      close() { closed = true; },
    } as unknown as VideoFrame;
    const gray = await readMotionImage(frame, { width: 8, height: 8 });
    expect(gray.data[0]).toBeCloseTo(127 / 255, 6);
    expect(closed).toBe(false);
  });

  it('稳健统计和仿射拟合拒绝奇异变换', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(mad([1, 2, 3, 4])).toBe(1);
    expect(solveAffine([{ x: 0, y: 0, u: 0, v: 0 }, { x: 1, y: 0, u: 1, v: 0 }, { x: 0, y: 1, u: 0, v: 1 }, { x: 1, y: 1, u: 1, v: 1 }])).toEqual([1, 0, 0, 0, 1, 0]);
    expect(() => clampAffine([0, 0, 0, 0, 0, 0], { width: 64, height: 48 })).toThrow();
  });

  it('纯平移基线估计确定性小位移', async () => {
    const result = await estimateMotion(patternedInput(3, 2), { algorithm: 'translation' });
    expect(result.status).toBe('estimated');
    if (result.status === 'estimated') {
      expect(result.matrix[2]).toBeCloseTo(3, 0);
      expect(result.matrix[5]).toBeCloseTo(2, 0);
      expect(result.inlierCount).toBeGreaterThanOrEqual(8);
    }
  });

  it('稀疏光流估计纹理平移并在低纹理时失败', async () => {
    const result = await estimateMotion(patternedInput(4, -2), { algorithm: 'sparse-flow' });
    expect(result.status).toBe('estimated');
    if (result.status === 'estimated') expect(result.matrix[2]).toBeCloseTo(4, 0);
    const failed = await estimateMotion(makeInput({ value: 127 }), { algorithm: 'sparse-flow' });
    expect(failed).toMatchObject({ status: 'failed', reason: 'insufficient-texture' });
  });

  it('特征匹配对照支持较大平移并拒绝无纹理', async () => {
    const result = await estimateMotion(patternedInput(10, 6), { algorithm: 'feature-match' });
    expect(result.status).toBe('estimated');
    if (result.status === 'estimated') expect(result.matrix[2]).toBeCloseTo(10, 0);
    const failed = await estimateMotion(makeInput({ value: 127 }), { algorithm: 'feature-match' });
    expect(failed).toMatchObject({ status: 'failed', reason: 'insufficient-texture' });
  });

  it('稀疏光流和特征匹配在局部仿射范围内返回有限结果', async () => {
    const size = { width: 96, height: 64 };
    const matrix = [0.997, -0.06, 4, 0.06, 0.997, 3] as const;
    const input: MotionEstimateInput = { previous: { image: patternedImage(size.width, size.height), frameId: 0, timestampMs: 0 }, current: { image: affineImage(size.width, size.height, matrix), frameId: 1, timestampMs: 33 }, imageSize: size };
    for (const algorithm of ['sparse-flow', 'feature-match'] as const) {
      const result = await estimateMotion(input, { algorithm });
      expect(['estimated', 'failed']).toContain(result.status);
      if (result.status === 'estimated') expect(result.matrix.every(Number.isFinite)).toBe(true);
    }
  });

  it('匹配不足时不把超范围位移伪装为估计成功', async () => {
    for (const [algorithm, x, y] of [['translation', 20, 12], ['sparse-flow', 20, 12], ['feature-match', 90, 50]] as const) {
      const result = await estimateMotion(patternedInput(x, y, { width: 128, height: 96 }), { algorithm });
      expect(result.status).toBe('failed');
      if (result.status === 'failed') expect(result.reason).toBe('quality-threshold');
    }
  });

  it('稀疏光流拒绝搜索半径之外的错误一致矩阵', async () => {
    const result = await estimateMotion(benchmarkPatternInput(20, 12), { algorithm: 'sparse-flow' });
    expect(result).toMatchObject({ status: 'failed', reason: 'quality-threshold' });
  });

  it('周期纹理存在等价峰值时拒绝返回错误平移矩阵', async () => {
    const result = await estimateMotion(repeatedTextureInput(6, 4), { algorithm: 'translation' });
    expect(result.status).toBe('failed');
    expect('matrix' in result).toBe(false);
  });
});
