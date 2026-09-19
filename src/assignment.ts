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
  // 归一化避免有限大坐标的面积乘积溢出。
  const scale = Math.max(Math.abs(a.x), Math.abs(a.y), a.width, a.height, Math.abs(b.x), Math.abs(b.y), b.width, b.height, 1);
  const ax = a.x / scale, ay = a.y / scale, aw = a.width / scale, ah = a.height / scale;
  const bx = b.x / scale, by = b.y / scale, bw = b.width / scale, bh = b.height / scale;
  const intersection = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const union = aw * ah + bw * bh - intersection;
  return union > 0 ? Math.max(0, Math.min(1, intersection / union)) : 0;
}
