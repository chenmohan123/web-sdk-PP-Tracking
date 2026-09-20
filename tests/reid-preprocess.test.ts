import { describe, expect, it } from 'vitest';
import { preprocessRgba } from '../src/reid/preprocess';

const box = { x: 0, y: 0, width: 1, height: 1 };
describe('ReID 像素契约', () => {
  it('单个红像素使用 RGB 平面与 ImageNet 手算值', () => {
    const { tensor } = preprocessRgba({ width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]) }, box);
    expect(tensor.length).toBe(3 * 192 * 64);
    expect(tensor[0]).toBe(Math.fround((1 - 0.485) / 0.229));
    expect(tensor[12288]).toBe(Math.fround(-0.456 / 0.224));
    expect(tensor[24576]).toBe(Math.fround(-0.406 / 0.225));
  });
  it('透明像素先合成白底，半透明在浮点域合成', () => {
    for (const alpha of [0, 128]) {
      const { tensor } = preprocessRgba({ width: 1, height: 1, data: new Uint8Array([255, 0, 0, alpha]) }, box);
      expect(tensor[12288]).toBe(Math.fround(((255 - alpha) / 255 - 0.456) / 0.224));
    }
  });
  it('非方形方向和分数框按 floor/ceil 覆盖，half-pixel 不转置', () => {
    const data = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);
    const result = preprocessRgba({ width: 2, height: 1, data }, { x: 0.2, y: 0, width: 1.2, height: 1 });
    expect(result.crop).toEqual({ x: 0, y: 0, width: 2, height: 1 });
    expect(result.tensor[0]).toBe(Math.fround((1 - 0.485) / 0.229));
    expect(result.tensor[63]).toBe(Math.fround(-0.485 / 0.229));
    expect(result.tensor[32]).toBe(Math.fround(((1 - (32.5 * 2 / 64 - 0.5)) - 0.485) / 0.229));
    expect(result.tensor[191 * 64]).toBe(result.tensor[0]);
  });
  it('拒绝图外框、错误尺寸与共享缓冲', () => {
    const image = { width: 1, height: 1, data: new Uint8Array(4) };
    for (const invalid of [{ ...image, width: 8193 }, { ...image, width: 8192, height: 8192 }, { ...image, data: new Uint8Array(3) }, { ...image, data: new Uint8Array(new SharedArrayBuffer(4)) }]) {
      expect(() => preprocessRgba(invalid, box)).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    }
    expect(() => preprocessRgba(image, { ...box, x: -0.1 })).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});
