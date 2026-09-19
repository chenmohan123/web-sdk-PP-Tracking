// 只接收公开检测与图像尺寸，GT 从不进入 SDK 适配路径。
export function parseSequenceInfo(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim() === '[Sequence]') continue;
    const match = /^([^=]+)=(.*)$/.exec(line.trim());
    if (!match || Object.hasOwn(values, match[1])) throw new Error('无效或重复 seqinfo 字段');
    values[match[1]] = match[2];
  }
  const info = { name: values.name, fps: Number(values.frameRate), length: Number(values.seqLength), width: Number(values.imWidth), height: Number(values.imHeight) };
  if (!info.name || !Number.isFinite(info.fps) || info.fps <= 0 || ![info.length, info.width, info.height].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('无效 seqinfo');
  return info;
}

export function adaptDetections(text, info) {
  const frames = Array.from({ length: info.length }, (_, index) => ({ timestampMs: (index + 1) * 1000 / info.fps, imageSize: { width: info.width, height: info.height }, detections: [] }));
  const statistics = { inputRows: 0, clipped: 0, empty: 0, accepted: 0, maxDetections: 0, numericalClamps: 0 };
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const columns = line.split(',');
    const values = columns.map(Number);
    const [frame, , left, top, width, height, score] = values;
    if (![7, 10].includes(columns.length) || columns.some(v => !v.trim()) || !values.every(Number.isFinite) || !Number.isSafeInteger(frame) || frame < 1 || frame > info.length || width <= 0 || height <= 0 || score < 0 || score > 1) throw new Error(`检测第 ${index + 1} 行无效`);
    statistics.inputRows++;
    // MOTChallenge 帧号及像素原点为一基；SDK 坐标为零基半开区间。
    const x = Math.max(0, left - 1), y = Math.max(0, top - 1);
    const right = Math.min(info.width, left - 1 + width), bottom = Math.min(info.height, top - 1 + height);
    if (x !== left - 1 || y !== top - 1 || right !== left - 1 + width || bottom !== top - 1 + height) statistics.clipped++;
    if (right <= x || bottom <= y) { statistics.empty++; continue; }
    let clippedWidth = right - x, clippedHeight = bottom - y;
    // 向内缩一个图像尺度的机器精度，避免相减舍入使合法贴边框落到边界外。
    const clampX = x > info.width - clippedWidth, clampY = y > info.height - clippedHeight;
    if (clampX) clippedWidth -= Number.EPSILON * info.width;
    if (clampY) clippedHeight -= Number.EPSILON * info.height;
    if (clampX || clampY) statistics.numericalClamps++;
    if (clippedWidth <= 0 || clippedHeight <= 0) { statistics.empty++; continue; }
    frames[frame - 1].detections.push({ box: { x, y, width: clippedWidth, height: clippedHeight }, score, classId: 0 });
    statistics.accepted++;
  }
  statistics.maxDetections = Math.max(...frames.map(frame => frame.detections.length));
  return { info, frames, statistics };
}

export function withoutTiming({ timings, ...result }) { return result; }

export function exportMot(frameNumber, result) {
  return result.tracks.filter(track => track.observed && track.state === 'tracked').map(track => {
    const { x, y, width, height } = track.box;
    return [frameNumber, track.id, x + 1, y + 1, width, height, track.score, -1, -1, -1].join(',') + '\n';
  }).join('');
}
