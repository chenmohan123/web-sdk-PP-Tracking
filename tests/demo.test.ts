import { describe, expect, it } from 'vitest';
import { parseSequence, samples } from '../demo/src/data';
import { Playback } from '../demo/src/playback';

describe('Demo 数据与回放', () => {
  it('原创示例都满足输入结构，低分和遮挡确实出现', () => {
    for (const frames of Object.values(samples)) expect(parseSequence({ frames })).toEqual(frames);
    expect(samples.low.some(f => f.detections.some(d => d.score === 0.25))).toBe(true);
    expect(samples.occlusion.some(f => f.detections.length === 0)).toBe(true);
  });
  it('拒绝结构、时钟、尺寸、分数、类别、框和配额错误', () => {
    const good = samples.straight.slice(0, 2);
    for (const bad of [null, [], {}, { frames: [] }, { frames: Array(3001).fill(good[0]) },
      { frames: [good[0], good[0]] }, { frames: [{ ...good[0], timestampMs: Infinity }] },
      { frames: [good[0], { ...good[1], imageSize: { width: 1, height: 1 } }] },
      ...[{ score: -1 }, { classId: 0.5 }, { box: { x: 639, y: 0, width: 2, height: 1 } }].map(patch => ({ frames: [{ ...good[0], detections: [{ ...good[0].detections[0], ...patch }] }] })),
      { frames: [{ ...good[0], detections: Array(101).fill(good[0].detections[0]) }] }]) expect(() => parseSequence(bad)).toThrow();
  });
  it('完整校验3000帧而不进行跟踪计算', () => {
    expect(parseSequence({ frames: Array.from({ length: 3000 }, (_, i) => ({ ...samples.straight[0], timestampMs: i })) })).toHaveLength(3000);
  });
  it('回放保持记录时间，seek复位并重算，复位清空导出', () => {
    const p = new Playback(samples.low);
    p.step(); p.step();
    expect(p.results.map(r => r.timestampMs)).toEqual([0, 100]);
    p.seek(6);
    expect(p.results).toHaveLength(7);
    expect(p.results[6].tracks[0]).toMatchObject({ id: 1, score: 0.25, observed: true });
    expect(p.results[0].generation).toBe(1);
    p.reset(); expect(p.results).toEqual([]); expect(p.index).toBe(-1);
    p.dispose();
  });
  it('错误参数保留当前结果，合法参数开启新实例', () => {
    const p = new Playback(samples.straight); p.step();
    const before = p.results;
    expect(() => p.configure({ highScoreThreshold: 0.05 })).toThrow();
    expect(p.results).toBe(before); expect(p.index).toBe(0);
    p.configure({ minHits: 1 }); expect(p.results).toEqual([]);
    p.step(); expect(p.results[0].tracks[0].state).toBe('tracked');
    p.dispose();
  });
});
