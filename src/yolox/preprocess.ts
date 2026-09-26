import { TrackingError } from '../errors';
import type {
  PreprocessedYoloxInput,
  RgbaImage,
  YoloxInput,
} from './types';

const SIZE = 416;
const PLANE = SIZE * SIZE;
const MEANS = [0.485, 0.456, 0.406] as const;
const DEVIATIONS = [0.229, 0.224, 0.225] as const;

function invalid(message: string): never {
  throw new TrackingError('INVALID_INPUT', message);
}

function validateImage(image: RgbaImage): void {
  if (
    !image ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.width > 8192 ||
    image.height > 8192 ||
    image.width * image.height > 16_777_216
  ) {
    invalid('图像尺寸无效或超过上限');
  }

  if (
    !(
      image.data instanceof Uint8Array ||
      image.data instanceof Uint8ClampedArray
    ) ||
    !(image.data.buffer instanceof ArrayBuffer) ||
    image.data.byteOffset !== 0 ||
    image.data.byteLength !== image.data.buffer.byteLength ||
    image.data.length !== image.width * image.height * 4
  ) {
    invalid('需要独立缓冲的完整 RGBA8 数据');
  }
}

function composite(
  image: RgbaImage,
  x: number,
  y: number,
  channel: number,
): number {
  const offset = (y * image.width + x) * 4;
  const alpha = image.data[offset + 3];

  return (
    image.data[offset + channel] * alpha +
    255 * (255 - alpha)
  ) / 255;
}

export function preprocessYolox(
  input: YoloxInput,
): PreprocessedYoloxInput {
  if (!input) {
    invalid('缺少输入');
  }

  const { image } = input;
  validateImage(image);

  const scale = Math.min(
    SIZE / image.height,
    SIZE / image.width,
  );
  const resizedWidth = Math.trunc(image.width * scale);
  const resizedHeight = Math.trunc(image.height * scale);
  const tensor = new Float32Array(3 * PLANE);

  for (let channel = 0; channel < 3; channel += 1) {
    tensor.fill(
      Math.fround(
        (114 / 255 - MEANS[channel]) /
          DEVIATIONS[channel],
      ),
      channel * PLANE,
      (channel + 1) * PLANE,
    );
  }

  for (let y = 0; y < resizedHeight; y += 1) {
    const sourceY = Math.min(
      image.height - 1,
      Math.max(
        0,
        (y + 0.5) * image.height / resizedHeight - 0.5,
      ),
    );
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(image.height - 1, y0 + 1);
    const fy = sourceY - y0;

    for (let x = 0; x < resizedWidth; x += 1) {
      const sourceX = Math.min(
        image.width - 1,
        Math.max(
          0,
          (x + 0.5) * image.width / resizedWidth - 0.5,
        ),
      );
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(image.width - 1, x0 + 1);
      const fx = sourceX - x0;
      const outputOffset = y * SIZE + x;

      for (let channel = 0; channel < 3; channel += 1) {
        const upper =
          composite(image, x0, y0, channel) * (1 - fx) +
          composite(image, x1, y0, channel) * fx;
        const lower =
          composite(image, x0, y1, channel) * (1 - fx) +
          composite(image, x1, y1, channel) * fx;
        const value = upper * (1 - fy) + lower * fy;

        tensor[channel * PLANE + outputOffset] = Math.fround(
          (value / 255 - MEANS[channel]) /
            DEVIATIONS[channel],
        );
      }
    }
  }

  return {
    tensor,
    scale,
    resizedWidth,
    resizedHeight,
    imageWidth: image.width,
    imageHeight: image.height,
  };
}
