import { describe, expect, it } from 'vitest';
import { preprocessYolox } from '../src/yolox/preprocess';

const plane = 416 * 416;
const normalized = (value: number, mean: number, deviation: number) => Math.fround((value / 255 - mean) / deviation);

describe('YOLOX 预处理', () => {
  it('按白底合成 RGBA 并输出 RGB CHW float32', () => {
    const opaque = preprocessYolox({ image: { width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]) } });
    expect(opaque.tensor).toBeInstanceOf(Float32Array);
    expect(opaque.tensor.length).toBe(3 * plane);
    expect(opaque.tensor[0]).toBe(normalized(255, 0.485, 0.229));
    expect(opaque.tensor[plane]).toBe(normalized(0, 0.456, 0.224));
    expect(opaque.tensor[2 * plane]).toBe(normalized(0, 0.406, 0.225));

    const transparent = preprocessYolox({ image: { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 0]) } });
    expect(transparent.tensor[0]).toBe(normalized(255, 0.485, 0.229));
    expect(transparent.tensor[plane]).toBe(normalized(255, 0.456, 0.224));
    expect(transparent.tensor[2 * plane]).toBe(normalized(255, 0.406, 0.225));
  });

  it('保持宽高比并把图像放在左上角，右侧使用 114 填充', () => {
    const data = new Uint8Array(2 * 416 * 4);
    for (let offset = 0; offset < data.length; offset += 4) {
      data.set([255, 0, 0, 255], offset);
    }

    const result = preprocessYolox({ image: { width: 2, height: 416, data } });
    expect(result).toMatchObject({ scale: 1, resizedWidth: 2, resizedHeight: 416, imageWidth: 2, imageHeight: 416 });
    expect(result.tensor[0]).toBe(normalized(255, 0.485, 0.229));
    expect(result.tensor[1]).toBe(normalized(255, 0.485, 0.229));
    expect(result.tensor[2]).toBe(normalized(114, 0.485, 0.229));
    expect(result.tensor[plane + 2]).toBe(normalized(114, 0.456, 0.224));
  });

  it('使用 OpenCV 半像素坐标执行双线性缩放', () => {
    const result = preprocessYolox({
      image: {
        width: 2,
        height: 1,
        data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
      },
    });

    expect(result).toMatchObject({ scale: 208, resizedWidth: 416, resizedHeight: 208 });
    expect(result.tensor[100 * 416 + 208]).toBeCloseTo((207 / 416 - 0.485) / 0.229, 6);
    expect(result.tensor[2 * plane + 100 * 416 + 208]).toBeCloseTo((209 / 416 - 0.406) / 0.225, 6);
  });

  it('拒绝无效尺寸、非完整独立 RGBA8 视图和共享缓冲', () => {
    const valid = { width: 1, height: 1, data: new Uint8Array(4) };
    const oversizedBuffer = new Uint8Array(8);
    const invalid = [
      { ...valid, width: 0 },
      { ...valid, width: 8193 },
      { ...valid, width: 8192, height: 8192 },
      { ...valid, data: new Uint8Array(3) },
      { ...valid, data: oversizedBuffer.subarray(2, 6) },
      { ...valid, data: new Uint8Array(new SharedArrayBuffer(4)) },
    ];

    for (const image of invalid) expect(() => preprocessYolox({ image })).toThrow();
  });
});
