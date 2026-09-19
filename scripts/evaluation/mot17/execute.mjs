import { exportMot, withoutTiming } from './adapter.mjs';

// 输入准备和导出不计入 SDK totalMs；每段、每次复核均新建实例。
export function runSequence(createTracker, frames, options, expectedRuntimeVersion) {
  const tracker = createTracker(options);
  const outputs = [], rows = [], timings = [];
  let maxTracks = 0, droppedDetections = 0, runtimeVersion;
  try {
    for (const [index, frame] of frames.entries()) {
      const result = tracker.update(frame);
      if (new Set(result.tracks.map(track => track.id)).size !== result.tracks.length) throw new Error('同帧重复轨迹 ID');
      for (const track of [...result.tracks, ...result.removed]) {
        if (!Object.values(track.box).every(Number.isFinite) || track.box.width <= 0 || track.box.height <= 0) throw new Error('无效输出框');
      }
      if (result.runtime.actualBackend !== 'cpu' || result.runtime.executionMode !== 'main') throw new Error('实际运行模式变化');
      if (expectedRuntimeVersion && result.runtime.runtimeVersion !== expectedRuntimeVersion) throw new Error(`运行时版本不匹配：期望 ${expectedRuntimeVersion}，实际 ${result.runtime.runtimeVersion}`);
      if (runtimeVersion && runtimeVersion !== result.runtime.runtimeVersion) throw new Error('同一序列运行时版本变化');
      runtimeVersion = result.runtime.runtimeVersion;
      maxTracks = Math.max(maxTracks, result.tracks.length);
      droppedDetections += result.droppedDetections;
      rows.push(exportMot(index + 1, result));
      outputs.push(JSON.stringify(withoutTiming(result)) + '\n');
      timings.push(result.timings);
    }
  } finally { tracker.dispose(); }
  if (droppedDetections) throw new Error(`容量丢弃 ${droppedDetections}`);
  const samples = timings.map(t => t.totalMs).sort((a, b) => a - b);
  return { mot: rows.join(''), deterministic: outputs.join(''), timings, summary: { frames: frames.length, maxTracks, droppedDetections, runtimeVersion, sdkTotalMs: timings.reduce((sum, value) => sum + value.totalMs, 0), p50Ms: samples[Math.floor((samples.length - 1) * 0.5)], p95Ms: samples[Math.ceil((samples.length - 1) * 0.95)] } };
}
