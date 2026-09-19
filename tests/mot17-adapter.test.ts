import { describe, expect, it } from 'vitest';
// @ts-expect-error 评测适配器是独立于发行包的 JavaScript CLI 模块。
import { parseSequenceInfo, adaptDetections, exportMot, withoutTiming } from '../scripts/evaluation/mot17/adapter.mjs';
import { createTracker } from '../src/index';
// @ts-expect-error 同一执行器也在浏览器真实序列对齐中运行。
import { runSequence } from '../scripts/evaluation/mot17/execute.mjs';

const ini = '[Sequence]\nname=原创\nframeRate=30\nseqLength=3\nimWidth=100\nimHeight=80\n';

describe('MOT17 数据边界', () => {
  it('按一基帧和像素原点转换，保留低分、空帧并裁剪越界框', () => {
    const sequence = adaptDetections('2,-1,-4,2,10,20,0.05\n1,-1,101,1,10,10,0.9\n1,-1,1,1,5,5,1\n', parseSequenceInfo(ini));
    expect(sequence.frames[0].timestampMs).toBe(1000 / 30);
    expect(sequence.frames[1].detections[0]).toEqual({ box: { x: 0, y: 1, width: 5, height: 20 }, score: 0.05, classId: 0 });
    expect(sequence.frames[0].detections[0].box.x).toBe(0);
    expect(sequence.frames[2].detections).toEqual([]);
    expect(sequence.statistics).toEqual({ inputRows: 3, clipped: 2, empty: 1, accepted: 2, maxDetections: 1, numericalClamps: 0 });
  });

  it.each(['1,-1,1,1,5,5,', '1,-1,1,1,5,5,NaN', '1.5,-1,1,1,5,5,1', '4,-1,1,1,5,5,1', '1,-1,1,1,-5,5,1', '1,-1,1,1,5,5,1,2', '1,-1,1,1,5,5,1\n坏行'])('坏检测不静默截断：%s', (data) => {
    expect(() => adaptDetections(data, parseSequenceInfo(ini))).toThrow();
  });

  it('拒绝缺失、非有限、重复或零值元数据', () => {
    for (const value of [ini.replace('frameRate=30', 'frameRate=0'), ini.replace('seqLength=3', ''), ini + 'imWidth=200\n', ini.replace('imWidth=100', 'imWidth=Infinity')]) {
      expect(() => parseSequenceInfo(value)).toThrow();
    }
  });

  it('仅导出已观测且确认的轨迹，恢复 MOT 一基像素坐标', () => {
    const track = { id: 3, box: { x: 0, y: 4, width: 10, height: 20 }, score: 0.1, state: 'tracked', observed: true };
    expect(exportMot(2, { tracks: [track, { ...track, id: 4, state: 'lost', observed: false }, { ...track, id: 5, state: 'tentative' }] })).toBe('2,3,1,5,10,20,0.1,-1,-1,-1\n');
    expect(withoutTiming({ tracks: [track], timings: { totalMs: 123 }, generation: 0 })).toEqual({ tracks: [track], generation: 0 });
  });

  it('真实 SDK 顺序更新空帧，未确认和 lost 不计入 MOT 检测', () => {
    const sequence = adaptDetections('1,-1,1,1,10,10,0.9\n2,-1,1,1,10,10,0.9\n', parseSequenceInfo(ini));
    const runtimeVersion = 'web-sdk-pp-tracking@0.2.0-alpha.0';
    const first = runSequence(createTracker, sequence.frames, {}, runtimeVersion);
    const second = runSequence(createTracker, sequence.frames, {}, runtimeVersion);
    expect(first.mot).toBe('2,1,1,1,10,10,0.9,-1,-1,-1\n');
    expect(first.deterministic).toBe(second.deterministic);
    expect(first.summary.frames).toBe(3);
    expect(first.summary.droppedDetections).toBe(0);
    expect(first.summary.runtimeVersion).toBe(runtimeVersion);
  });

  it('实际运行时版本与候选 package 不一致时拒绝生成评测结果', () => {
    const sequence = adaptDetections('1,-1,1,1,10,10,0.9\n', parseSequenceInfo(ini));
    expect(() => runSequence(createTracker, sequence.frames, {}, 'web-sdk-pp-tracking@9.9.9')).toThrow(/运行时版本不匹配/);
  });

  it('小数框裁到下边界后仍满足 SDK 的浮点边界契约', () => {
    const sequence = adaptDetections('1,-1,1,1.1,10,100,0.9\n', parseSequenceInfo(ini));
    const tracker = createTracker();
    expect(() => tracker.update(sequence.frames[0])).not.toThrow();
    expect(sequence.statistics.numericalClamps).toBe(1);
    tracker.dispose();
  });
});
