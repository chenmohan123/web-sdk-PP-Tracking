import type { Box } from '../types';
import { ReIdError, safeError } from './errors';
import { PREPROCESSING_ID } from './model';
import type { ReIdDetection, RgbaImage } from './types';

const means = [0.485, 0.456, 0.406], deviations = [0.229, 0.224, 0.225];
function invalid(message: string): never { throw new ReIdError('INVALID_INPUT', message); }
export function validateImage(image: RgbaImage): void {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width <= 0 || image.height <= 0 ||
      image.width > 8192 || image.height > 8192 || image.width * image.height > 16_777_216) invalid('图像尺寸无效或超过上限');
  if (!(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray) || !(image.data.buffer instanceof ArrayBuffer) ||
      image.data.length !== image.width * image.height * 4) invalid('需要独立缓冲的完整 RGBA8 数据');
}
function validateBox(image: RgbaImage, box: Box): void {
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 ||
      box.x + box.width > image.width || box.y + box.height > image.height) invalid('检测框必须完整处于图像内且具有正尺寸');
}
export function copyInput(input: { image: RgbaImage; detections: readonly ReIdDetection[] }, maxDetections: number) {
  if (!input) invalid('缺少输入');
  validateImage(input.image);
  if (!Array.isArray(input.detections) || input.detections.length > maxDetections) invalid('检测数组无效或超过上限');
  const detections = Array.from(input.detections, detection => {
    if (!detection || !Number.isFinite(detection.score) || detection.score < 0 || detection.score > 1 ||
        !Number.isSafeInteger(detection.classId) || detection.classId < 0) invalid('检测分数或类别无效');
    validateBox(input.image, detection.box);
    return { box: { x: detection.box.x, y: detection.box.y, width: detection.box.width, height: detection.box.height }, score: detection.score, classId: detection.classId };
  });
  try { return { image: { width: input.image.width, height: input.image.height, data: new Uint8Array(input.image.data) }, detections }; }
  catch (error) { throw safeError(error, 'INVALID_INPUT'); }
}
export function preprocessRgba(image: RgbaImage, box: Box) {
  validateImage(image); validateBox(image, box);
  const { width, data } = image;
  const x0 = Math.floor(box.x), y0 = Math.floor(box.y), cw = Math.ceil(box.x + box.width) - x0, ch = Math.ceil(box.y + box.height) - y0;
  const tensor = new Float32Array(3 * 192 * 64);
  const composite = (x: number, y: number, channel: number) => {
    const i = ((y0 + y) * width + x0 + x) * 4;
    return (data[i + channel] * data[i + 3] + 255 * (255 - data[i + 3])) / 255;
  };
  for (let y = 0; y < 192; y++) {
    const sourceY = Math.min(ch - 1, Math.max(0, (y + 0.5) * ch / 192 - 0.5));
    const ya = Math.floor(sourceY), yb = Math.min(ch - 1, ya + 1), fy = sourceY - ya;
    for (let x = 0; x < 64; x++) {
      const sourceX = Math.min(cw - 1, Math.max(0, (x + 0.5) * cw / 64 - 0.5));
      const xa = Math.floor(sourceX), xb = Math.min(cw - 1, xa + 1), fx = sourceX - xa;
      for (let channel = 0; channel < 3; channel++) {
        const upper = composite(xa, ya, channel) * (1 - fx) + composite(xb, ya, channel) * fx;
        const lower = composite(xa, yb, channel) * (1 - fx) + composite(xb, yb, channel) * fx;
        tensor[channel * 12288 + y * 64 + x] = ((upper * (1 - fy) + lower * fy) / 255 - means[channel]) / deviations[channel];
      }
    }
  }
  return { tensor, crop: { x: x0, y: y0, width: cw, height: ch }, preprocessingId: PREPROCESSING_ID };
}
