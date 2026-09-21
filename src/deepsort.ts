import { TrackingError } from './errors.js';

export const MOTION_GATE_THRESHOLD = 9.487729036781154;

export function normalizeEmbedding(value: unknown, dimension: number): number[] {
  const array = Array.isArray(value);
  if ((!array && !(value instanceof Float32Array)) || value.length !== dimension) {
    throw new TrackingError('INVALID_INPUT', '外观向量类型或维度与特征空间不符');
  }
  let maximum = 0;
  const copied = Array<number>(dimension);
  for (let index = 0; index < dimension; index++) {
    if (array && !Object.hasOwn(value, index)) throw new TrackingError('INVALID_INPUT', '外观向量不能包含稀疏槽位');
    const component = value[index];
    if (!Number.isFinite(component)) throw new TrackingError('INVALID_INPUT', '外观向量必须全部为有限数值');
    copied[index] = component;
    maximum = Math.max(maximum, Math.abs(component));
  }
  if (maximum === 0) throw new TrackingError('INVALID_INPUT', '外观向量范数必须大于零');
  const scaled = copied.map(component => component / maximum);
  const norm = Math.sqrt(scaled.reduce((sum, component) => sum + component * component, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new TrackingError('INVALID_INPUT', '外观向量无法归一化');
  return scaled.map(component => component / norm);
}

export function minimumCosineDistance(embedding: ArrayLike<number>, gallery: readonly (readonly number[])[]): number {
  let minimum = Infinity;
  for (const sample of gallery) {
    let dot = 0;
    for (let index = 0; index < embedding.length; index++) dot += embedding[index] * sample[index];
    if (!Number.isFinite(dot)) throw new TrackingError('NUMERICAL_FAILURE', '外观距离不可表示');
    minimum = Math.min(minimum, 1 - Math.max(-1, Math.min(1, dot)));
  }
  if (!Number.isFinite(minimum)) throw new TrackingError('NUMERICAL_FAILURE', '轨迹图库为空或不可表示');
  return minimum;
}

export function appendToGallery(gallery: number[][], embedding: ArrayLike<number>, capacity: number): void {
  gallery.push(Array.from(embedding));
  if (gallery.length > capacity) gallery.splice(0, gallery.length - capacity);
}
