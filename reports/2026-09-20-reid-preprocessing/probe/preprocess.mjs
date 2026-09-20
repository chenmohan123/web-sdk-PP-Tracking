// 一次性图像契约探针；尚未导出为 SDK API，不调用 DOM 或 Canvas 缩放。
export const PREPROCESSING_ID = 'rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1';
const means = [0.485, 0.456, 0.406], deviations = [0.229, 0.224, 0.225];
function invalid(message) { throw Object.assign(new Error(message), { code: 'INVALID_INPUT' }); }

export function preprocessRgba(image, box) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width <= 0 || image.height <= 0 ||
      image.width > 8192 || image.height > 8192 || image.width * image.height > 16_777_216) invalid('图像尺寸无效或超过上限');
  const { width, height, data } = image;
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray) || !(data.buffer instanceof ArrayBuffer) ||
      data.length !== width * height * 4) invalid('需要独立缓冲的完整 RGBA8 数据');
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0 ||
      !Number.isFinite(box.x + box.width) || !Number.isFinite(box.y + box.height)) invalid('裁剪框无效');
  const left = Math.max(0, box.x), top = Math.max(0, box.y);
  const right = Math.min(width, box.x + box.width), bottom = Math.min(height, box.y + box.height);
  if (right <= left || bottom <= top) invalid('裁剪框与图像没有交集');
  const x0 = Math.floor(left), y0 = Math.floor(top), cw = Math.ceil(right) - x0, ch = Math.ceil(bottom) - y0;
  const tensor = new Float32Array(3 * 192 * 64);
  const composite = (x, y, channel) => {
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
        const value = upper * (1 - fy) + lower * fy;
        tensor[channel * 12288 + y * 64 + x] = (value / 255 - means[channel]) / deviations[channel];
      }
    }
  }
  return { tensor, crop: { x: x0, y: y0, width: cw, height: ch }, preprocessingId: PREPROCESSING_ID };
}
