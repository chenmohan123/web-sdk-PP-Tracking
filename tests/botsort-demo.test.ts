import { describe, expect, it } from 'vitest';
import { botSettingsFrom, DEMO_DEFAULT_OPTIONS, optionsFrom, parametersFrom, prepareSequence, sampleInput, samples, serializeSequence, SYNTHETIC_FEATURE_SPACE } from '../demo/src/data';
import { Playback } from '../demo/src/playback';

describe('BoT-SORT Demo 运动序列', () => {
  it('合成平移样例提供连续帧身份和运动回执', async () => {
    const frames = samples.translation;
    expect(frames).toHaveLength(40);
    expect(frames[0]).toMatchObject({ frameId: 0, motion: { status: 'initial', from: null } });
    expect(frames[1]).toMatchObject({ frameId: 1, motion: { status: 'estimated', from: { frameId: 0, timestampMs: 0 } } });
    const prepared = await prepareSequence({ frames }, 'botsort', DEMO_DEFAULT_OPTIONS.botsort);
    const playback = new Playback(prepared.frames, prepared.options);
    playback.seek(frames.length - 1);
    expect(playback.results).toHaveLength(40);
    expect(playback.results.at(-1)).toMatchObject({ algorithm: 'botsort', frameId: 39, motion: { applied: true } });
    playback.dispose();
  });

  it('BoT-SORT 导入缺少运动信息时拒绝且不补造恒等运动', async () => {
    const legacy = { frames: [{ timestampMs: 0, imageSize: { width: 100, height: 100 }, detections: [] }] };
    await expect(prepareSequence(legacy, 'botsort', DEMO_DEFAULT_OPTIONS.botsort)).rejects.toThrow('INVALID_SEQUENCE');
    expect(legacy.frames[0]).not.toHaveProperty('motion');
  });

  it('旧结果报告按当前算法处理，缺省 ByteTrack 参数也可版本化往返', async () => {
    const frames = [{ timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [] }];
    const old = await prepareSequence({ schemaVersion: 1, algorithm: 'bytetrack', frames }, 'ocsort', DEMO_DEFAULT_OPTIONS.ocsort);
    expect(old.options.algorithm).toBe('ocsort');
    const input = JSON.parse(serializeSequence(frames, undefined, {}));
    const prepared = await prepareSequence(input, 'ocsort', DEMO_DEFAULT_OPTIONS.ocsort);
    expect(prepared.options.algorithm).toBe('bytetrack');
  });

  it('版本化外观参数里的非法字段不得被包装特征空间覆盖', async () => {
    for (const options of [DEMO_DEFAULT_OPTIONS.deepsort, { ...DEMO_DEFAULT_OPTIONS.botsort, appearance: { featureSpace: SYNTHETIC_FEATURE_SPACE } }]) {
      const input = sampleInput('straight', options.algorithm, options);
      const value = JSON.parse(serializeSequence(input.frames, input.featureSpace, options));
      const space = options.algorithm === 'botsort' ? value.options.appearance.featureSpace : value.options.featureSpace;
      space.typo = true;
      await expect(prepareSequence(value, 'bytetrack', DEMO_DEFAULT_OPTIONS.bytetrack)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
    }
  });

  it('应用可见参数时保留导入的隐藏阈值、容量及时间限制', () => {
    const options = { ...DEMO_DEFAULT_OPTIONS.botsort, matchIouThreshold: 0.85, lowMatchIouThreshold: 0.7, maxTracks: 1, maxDetections: 75, largeGapMs: 4000 };
    const draft = parametersFrom(options); draft.minHits = '1';
    const applied = optionsFrom('botsort', draft, undefined, botSettingsFrom(options), options);
    expect(applied).toEqual({ ...options, minHits: 1 });
  });

  it('空检测的外观序列可只从版本化选项恢复特征空间', async () => {
    const featureSpace = { id: 'empty-camera-run', dimension: 2 };
    const frame = { timestampMs: 0, imageSize: { width: 100, height: 100 }, detections: [], featureSpaceId: featureSpace.id };
    for (const algorithm of ['deepsort', 'botsort'] as const) {
      const options = algorithm === 'botsort' ? { algorithm, appearance: { featureSpace } } : { algorithm, featureSpace };
      const frames = algorithm === 'botsort' ? [{ ...frame, frameId: 0, motion: { status: 'initial' as const, from: null, to: { frameId: 0, timestampMs: 0 } } }] : [frame];
      const prepared = await prepareSequence(JSON.parse(serializeSequence(frames, undefined, options)), 'bytetrack', DEMO_DEFAULT_OPTIONS.bytetrack);
      expect(prepared.featureSpace).toEqual(featureSpace);
      expect(prepared.frames).toEqual(frames);
    }
  });

  it('运动矩阵和生效选项跨当前算法深复制往返', async () => {
    const frames = samples.translation.slice(0, 2);
    const options = { ...DEMO_DEFAULT_OPTIONS.botsort, minHits: 1 };
    const serialized = serializeSequence(frames, undefined, options);
    const value = JSON.parse(serialized);
    expect(value.algorithm).toBe('botsort');
    expect(value.schemaVersion).toBe(2);
    expect(value.options.minHits).toBe(1);
    expect(value.frames).toEqual(frames);
    const prepared = await prepareSequence(value, 'bytetrack', DEMO_DEFAULT_OPTIONS.bytetrack);
    expect(prepared.options).toEqual(options);
    expect(prepared.frames).toEqual(frames);
    value.frames[1].motion.to.frameId = 999;
    value.frames[1].motion.matrix[2] = 999;
    expect(prepared.frames).toEqual(frames);
  });

  it('拒绝非法末帧矩阵、额外字段与未知导出版本', async () => {
    const value = JSON.parse(serializeSequence(samples.translation, undefined, DEMO_DEFAULT_OPTIONS.botsort));
    for (const mutate of [
      (v: any) => { v.frames.at(-1).motion.matrix = [1, 0, 0, 0, -1, 0]; },
      (v: any) => { v.frames.at(-1).motion.typo = true; },
      (v: any) => { v.frames.at(-1).typo = true; },
      (v: any) => { v.frames.at(-1).imageSize.typo = true; },
      (v: any) => { v.schemaVersion = 99; },
      (v: any) => { v.options.algorithm = 'bytetrack'; },
    ]) {
      const bad = structuredClone(value); mutate(bad);
      await expect(prepareSequence(bad, 'bytetrack', DEMO_DEFAULT_OPTIONS.bytetrack)).rejects.toThrow();
    }
  });

  it('运动连接非法时准备失败且已有回放结果不改变', async () => {
    const playback = new Playback(samples.translation, DEMO_DEFAULT_OPTIONS.botsort);
    playback.step();
    const before = playback.results;
    const invalid = { frames: [samples.translation[0], { ...samples.translation[1], motion: { ...samples.translation[1].motion, from: { frameId: 7, timestampMs: 700 } } }] };
    await expect(prepareSequence(invalid, 'botsort', DEMO_DEFAULT_OPTIONS.botsort)).rejects.toThrow('INVALID_SEQUENCE');
    expect(playback.results).toBe(before);
    expect(playback.index).toBe(0);
    playback.dispose();
  });
});
