import { MotionEstimateError } from './errors.js';
import type { MotionEstimateInput } from './types.js';

export interface GrayImage { width: number; height: number; data: Float32Array }

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

export function isImageDataLike(value: unknown): value is ImageData {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.width) && Number.isInteger(value.height) && (value.width as number) > 0 && (value.height as number) > 0
    && value.data instanceof Uint8ClampedArray && value.data.length === (value.width as number) * (value.height as number) * 4;
}

export function isVideoFrameLike(value: unknown): value is VideoFrame {
  if (!isRecord(value)) return false;
  const width = value.displayWidth ?? value.codedWidth;
  const height = value.displayHeight ?? value.codedHeight;
  return typeof value.copyTo === 'function' && Number.isInteger(width) && Number.isInteger(height) && (width as number) > 0 && (height as number) > 0;
}

function imageSize(image: ImageData | VideoFrame): { width: number; height: number } {
  if (isImageDataLike(image)) return { width: image.width, height: image.height };
  const frame = image as VideoFrame;
  return { width: frame.displayWidth || frame.codedWidth, height: frame.displayHeight || frame.codedHeight };
}

export function validateMotionInput(input: MotionEstimateInput): void {
  if (!isRecord(input) || !isRecord(input.previous) || !isRecord(input.current) || !isRecord(input.imageSize)) throw new MotionEstimateError('INVALID_INPUT', '运动估计输入不完整');
  const { previous, current, imageSize: expected } = input;
  if (!Number.isSafeInteger(previous.frameId) || !Number.isSafeInteger(current.frameId) || !Number.isFinite(previous.timestampMs) || !Number.isFinite(current.timestampMs)) throw new MotionEstimateError('INVALID_INPUT', '帧编号必须为安全整数，时间必须为有限数');
  if (current.frameId !== previous.frameId + 1 || current.timestampMs <= previous.timestampMs) throw new MotionEstimateError('FRAME_ORDER', '运动估计只接受严格相邻且时间递增的帧');
  if (!Number.isInteger(expected.width) || !Number.isInteger(expected.height) || expected.width <= 0 || expected.height <= 0) throw new MotionEstimateError('INVALID_INPUT', '图像尺寸必须为正整数');
  for (const image of [previous.image, current.image]) {
    if (!isImageDataLike(image) && !isVideoFrameLike(image)) throw new MotionEstimateError('UNSUPPORTED_INPUT', '只支持 ImageData 或 VideoFrame');
    const actual = imageSize(image);
    if (actual.width !== expected.width || actual.height !== expected.height) throw new MotionEstimateError('SIZE_MISMATCH', '输入帧尺寸必须与 imageSize 一致');
  }
}

export async function readMotionImage(image: ImageData | VideoFrame, expected: { width: number; height: number }): Promise<GrayImage> {
  if (!isImageDataLike(image) && !isVideoFrameLike(image)) throw new MotionEstimateError('UNSUPPORTED_INPUT', '只支持 ImageData 或 VideoFrame');
  const actual = imageSize(image);
  if (actual.width !== expected.width || actual.height !== expected.height) throw new MotionEstimateError('SIZE_MISMATCH', '输入帧尺寸必须与 imageSize 一致');
  let rgba: Uint8ClampedArray;
  if (isImageDataLike(image)) rgba = new Uint8ClampedArray(image.data);
  else {
    rgba = new Uint8ClampedArray(expected.width * expected.height * 4);
    try {
      await image.copyTo(rgba, { format: 'RGBA' });
    } catch (error) {
      throw new MotionEstimateError('UNSUPPORTED_INPUT', `VideoFrame 无法复制为 RGBA：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  const data = new Float32Array(expected.width * expected.height);
  for (let i = 0, pixel = 0; i < rgba.length; i += 4, pixel++) data[pixel] = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
  return { ...expected, data };
}

export async function validateAndReadInput(input: MotionEstimateInput): Promise<{ previous: GrayImage; current: GrayImage }> {
  validateMotionInput(input);
  const [previous, current] = await Promise.all([
    readMotionImage(input.previous.image, input.imageSize),
    readMotionImage(input.current.image, input.imageSize),
  ]);
  return { previous, current };
}
