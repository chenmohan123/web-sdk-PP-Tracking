// 独立手工像素期望，防止颜色、轴顺序、边界及输入校验回归。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preprocessRgba } from './preprocess.mjs';

const image = (width, height, data) => ({ width, height, data: new Uint8ClampedArray(data) });
const box = (x, y, width, height) => ({ x, y, width, height });
const white = image(1, 1, [255, 255, 255, 255]);
const full = box(0, 0, 1, 1);
function close(actual, expected) { assert(Math.abs(actual - expected) < 2e-6, `${actual} != ${expected}`); }

test('纯红保持RGB与CHW，单像素被复制到整个目标图', () => {
  const result = preprocessRgba(image(1, 1, [255, 0, 0, 255]), full);
  assert.equal(result.tensor.length, 36864);
  assert.deepEqual(result.crop, { x: 0, y: 0, width: 1, height: 1 });
  for (const value of result.tensor.subarray(0, 12288)) close(value, 2.2489082969432315);
  for (const value of result.tensor.subarray(12288, 24576)) close(value, -2.0357142857142856);
  for (const value of result.tensor.subarray(24576)) close(value, -1.8044444444444445);
});
test('非方形图保留水平和垂直方向，half-pixel线性插值', () => {
  const source = image(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
  const tensor = preprocessRgba(source, box(0, 0, 2, 1)).tensor;
  // 目标x=16映射源x=0.015625，灰度为3.984375；x=47映射0.984375。
  close(tensor[16], -2.0496724890829694);
  close(tensor[47], 2.1806768558951966);
  close(tensor[0], -2.1179039301310043);
  close(tensor[63], 2.2489082969432315);
  assert.deepEqual(Array.from(tensor.subarray(0, 64)), Array.from(tensor.subarray(191 * 64, 192 * 64)));
});
test('裁剪交集外扩整数边界，输出不引用或修改输入', () => {
  const source = image(3, 1, [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
  const snapshot = source.data.slice();
  const result = preprocessRgba(source, box(-0.2, 0, 1.4, 1));
  assert.deepEqual(result.crop, { x: 0, y: 0, width: 2, height: 1 });
  assert.deepEqual(source.data, snapshot);
  close(result.tensor[0], 2.2489082969432315);
  close(result.tensor[63], -2.1179039301310043);
  source.data.fill(0);
  close(result.tensor[0], 2.2489082969432315);
});
test('透明像素先以白底合成再插值，忽略透明像素中的隐藏颜色', () => {
  const a = preprocessRgba(image(1, 1, [0, 20, 200, 0]), full).tensor;
  const b = preprocessRgba(white, full).tensor;
  assert.deepEqual(a, b);
  const half = preprocessRgba(image(1, 1, [0, 0, 0, 128]), full).tensor;
  close(half[0], 0.05693980649028225);
});
test('只采样裁剪内像素，单行单列不会读取相邻框', () => {
  const source = image(2, 2, [255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,255,255]);
  const output = preprocessRgba(source, box(1, 1, 1, 1));
  assert.deepEqual(output.tensor, preprocessRgba(white, full).tensor);
});
test('异常图像元数据、数据类型、大小与共享缓冲拒绝', () => {
  for (const source of [null, {}, {...white, width: 0}, {...white, width: 1.2}, {...white, height: Infinity},
    {...white, width: 8193}, {...white, width: 8192, height: 8192}, {...white, data: new Float32Array(4)},
    {...white, data: new Uint8Array(3)}, {...white, data: new Uint8Array(new SharedArrayBuffer(4))}]) {
    assert.throws(() => preprocessRgba(source, full), error => error.code === 'INVALID_INPUT');
  }
});
test('空交集、非有限或负框拒绝，不尝试生成无意义向量', () => {
  for (const invalid of [null, {}, box(2,0,1,1), box(-3,0,1,1), box(0,0,0,1), box(0,0,-1,1),
    box(NaN,0,1,1), box(0,Infinity,1,1), box(1e308,0,1e308,1)]) {
    assert.throws(() => preprocessRgba(white, invalid), error => error.code === 'INVALID_INPUT');
  }
});
