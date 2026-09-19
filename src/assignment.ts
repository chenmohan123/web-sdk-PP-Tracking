import type { Box } from './types.js';

/** 门限内优先最大匹配数，再最小化 1-IoU；行列原顺序打破平局。 */
export function assign(similarities: number[][], threshold: number): [number, number][] {
  const n = similarities.length, m = similarities[0]?.length ?? 0;
  if (!n || !m) return [];
  const columns = m + n, unmatched = n + 1, forbidden = (n + 1) ** 3;
  const cost = (i: number, j: number) => j >= m ? unmatched : similarities[i][j] >= threshold ? 1 - similarities[i][j] : forbidden;
  // 矩形匈牙利：虚拟列数量足以让每行均未匹配，真实检测也允许不被占用。
  const u = Array(n + 1).fill(0), v = Array(columns + 1).fill(0);
  const owner = Array(columns + 1).fill(0), previous = Array(columns + 1).fill(0);
  for (let row = 1; row <= n; row++) {
    owner[0] = row;
    let column = 0;
    const distances = Array(columns + 1).fill(Infinity), used = Array(columns + 1).fill(false);
    do {
      used[column] = true;
      const current = owner[column];
      let delta = Infinity, next = 0;
      for (let j = 1; j <= columns; j++) {
        if (used[j]) continue;
        const reduced = cost(current - 1, j - 1) - u[current] - v[j];
        if (reduced < distances[j]) { distances[j] = reduced; previous[j] = column; }
        if (distances[j] < delta) { delta = distances[j]; next = j; }
      }
      for (let j = 0; j <= columns; j++) {
        if (used[j]) { u[owner[j]] += delta; v[j] -= delta; }
        else distances[j] -= delta;
      }
      column = next;
    } while (owner[column] !== 0);
    do {
      const prev = previous[column]; owner[column] = owner[prev]; column = prev;
    } while (column !== 0);
  }
  const pairs: [number, number][] = [];
  for (let j = 1; j <= m; j++) if (owner[j] !== 0 && similarities[owner[j] - 1][j - 1] >= threshold) pairs.push([owner[j] - 1, j - 1]);
  return pairs.sort((a, b) => a[0] - b[0]);
}

export function iou(a: Box, b: Box): number {
  // 先按相对位移求交集，避免绝对坐标缩放后再相减损失框宽精度。
  const dx = b.x - a.x, dy = b.y - a.y;
  const width = Math.max(0, Math.min(a.width, b.width, a.width - dx, b.width + dx));
  const height = Math.max(0, Math.min(a.height, b.height, a.height - dy, b.height + dy));
  if (width === 0 || height === 0) return 0;
  // 各轴独立归一化面积；相同框的边长比例均精确为1，不给门限添加容差。
  const scaleX = Math.max(a.width, b.width), scaleY = Math.max(a.height, b.height);
  const aw = a.width / scaleX, ah = a.height / scaleY;
  const bw = b.width / scaleX, bh = b.height / scaleY;
  const intersection = (width / scaleX) * (height / scaleY);
  const union = aw * ah + bw * bh - intersection;
  return union > 0 ? Math.max(0, Math.min(1, intersection / union)) : 0;
}
