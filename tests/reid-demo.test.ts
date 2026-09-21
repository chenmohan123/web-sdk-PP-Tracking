import { describe, expect, it } from 'vitest';
import { ReIdController, ImageSelection } from '../demo/src/reid-controller';
import type { ReIdExtractor, ReIdResult } from '../src/reid/types';

const image = { width: 20, height: 20, data: new Uint8Array(1600) };
const detections = [{ box: { x: 1, y: 1, width: 8, height: 16 }, score: 0.9, classId: 0 }];
const featureSpace = { id: 'demo-test', dimension: 2 };
const result: ReIdResult = { featureSpace, detections: detections.map(d => ({ ...d, embedding: [1, 0] })), runtime: { requestedBackend: 'wasm', actualBackend: 'wasm', executionMode: 'main', runtimeVersion: 'web-sdk-pp-tracking@0.2.0-alpha.0', ortVersion: '1.27.0' }, timings: { decodeMs: 0, preprocessMs: 0, inferenceMs: 1, postprocessMs: 0, totalMs: 1 } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup(extract: ReIdExtractor['extract'] = async () => result) {
  const events: string[] = [];
  const controller = new ReIdController({ create: () => ({ featureSpace, load: async () => ({ runtime: result.runtime, timings: { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, totalMs: 0 }, source: { kind: 'bytes' }, cache: { status: 'not-applicable', bytes: 0 } }), extract, dispose: async () => { events.push('dispose'); } }), clear: async () => { events.push('clear'); } });
  return { controller, events };
}

describe('图像跟踪控制器', () => {
  it('工厂失败不会把工作台锁死', async () => {
    const c = new ReIdController({ create: () => { throw new Error('INVALID_MANIFEST'); }, clear: async () => {} });
    await expect(c.run(image, detections)).rejects.toThrow('INVALID_MANIFEST');
    expect(c.busy).toBe(false); expect(c.frameCount).toBe(0);
  });
  it('失败帧不推进时间和轨迹，成功帧递增', async () => {
    let fail = false;
    const { controller: c } = setup(async () => { if (fail) throw new Error('INFERENCE_FAILED'); return result; });
    await c.run(image, detections);
    expect(c.tracking?.timestampMs).toBe(0);
    fail = true;
    await expect(c.run(image, detections)).rejects.toThrow('INFERENCE_FAILED');
    expect(c.tracking?.tracks[0].hits).toBe(1);
    fail = false; await c.run(image, detections);
    expect(c.tracking?.timestampMs).toBe(100); expect(c.tracking?.tracks[0].hits).toBe(2);
  });
  it('取消丢弃结果且禁止重复开始', async () => {
    const pending = deferred<ReIdResult>(); const { controller: c } = setup(() => pending.promise);
    const run = c.run(image, detections);
    await Promise.resolve();
    await expect(c.run(image, detections)).rejects.toThrow('BUSY');
    c.cancel(); pending.resolve(result); await run;
    expect(c.tracking).toBeNull(); expect(c.frameCount).toBe(0);
  });
  it('来源后端切换等待活动任务，释放并复位，旧结果不可提交', async () => {
    const pending = deferred<ReIdResult>(); const { controller: c, events } = setup(() => pending.promise);
    const run = c.run(image, detections); await Promise.resolve(); const change = c.configure('huggingface', 'webgpu');
    expect(events).toEqual([]); expect(c.busy).toBe(true);
    pending.resolve(result); await Promise.all([run, change]);
    expect(events).toEqual(['dispose']); expect(c.tracking).toBeNull(); expect(c.source).toBe('huggingface'); expect(c.backend).toBe('webgpu');
  });
  it('完整清理等待任务及释放，再清本 SDK 缓存', async () => {
    const pending = deferred<ReIdResult>(); const { controller: c, events } = setup(() => pending.promise);
    const run = c.run(image, detections); await Promise.resolve(); const clear = c.clear();
    expect(events).toEqual([]); pending.resolve(result); await Promise.all([run, clear]);
    expect(events).toEqual(['dispose', 'clear']); expect(c.frameCount).toBe(0);
  });
  it('相同尺寸换图保留轨迹，尺寸变化拒绝直到显式复位', async () => {
    const { controller: c } = setup(); await c.run(image, detections); await c.run({ ...image, data: image.data.slice() }, detections);
    expect(c.tracking?.tracks[0].hits).toBe(2);
    await expect(c.run({ width: 10, height: 10, data: new Uint8Array(400) }, detections)).rejects.toThrow('IMAGE_SIZE_CHANGED');
    expect(c.frameCount).toBe(2); await c.reset(); expect(c.frameCount).toBe(0);
  });
  it('清理等待真实挂起的提取结束，清理期间禁止再开始', async () => {
    const pending = deferred<ReIdResult>(); const started = deferred<void>();
    const { controller: c, events } = setup(() => { started.resolve(); return pending.promise; });
    const run = c.run(image, detections); await started.promise;
    const clear = c.clear(); await Promise.resolve();
    expect(events).toEqual([]);
    await expect(c.run(image, detections)).rejects.toThrow('BUSY');
    pending.resolve(result); await Promise.all([run, clear]);
    expect(events).toEqual(['dispose', 'clear']); expect(c.tracking).toBeNull();
  });
  it('释放禁止后续运行并丢弃正在执行的结果', async () => {
    const pending = deferred<ReIdResult>(); const { controller: c } = setup(() => pending.promise);
    const run = c.run(image, detections); await Promise.resolve();
    const dispose = c.dispose(); pending.resolve(result); await Promise.all([run, dispose]);
    await expect(c.run(image, detections)).rejects.toThrow('DISPOSED'); expect(c.tracking).toBeNull();
  });
});

describe('图像解码所有权', () => {
  it('旧解码结果不覆盖新图，关闭位图并释放旧 URL', async () => {
    const old = deferred<{ image: typeof image; close: () => void }>(); const events: string[] = [];
    const slot = new ImageSelection({ decode: file => file.name === 'old' ? old.promise : Promise.resolve({ image, close: () => { events.push('close-new'); } }), url: file => file.name, revoke: url => { events.push(`revoke-${url}`); } });
    const first = slot.select({ name: 'old', size: 1 } as File);
    await slot.select({ name: 'new', size: 1 } as File);
    old.resolve({ image, close: () => { events.push('close-old'); } }); await first;
    expect(slot.current?.url).toBe('new'); expect(events).toContain('close-old'); expect(events).toContain('revoke-old');
    slot.dispose(); expect(events).toContain('revoke-new'); expect(events).toContain('close-new');
  });
  it('拒绝超大文件及像素尺寸并释放资源', async () => {
    const events: string[] = [];
    const slot = new ImageSelection({ decode: async () => ({ image: { ...image, width: 8193 }, close: () => { events.push('closed'); } }), url: () => 'url', revoke: () => { events.push('revoked'); } });
    await expect(slot.select({ size: 20 * 1024 * 1024 + 1 } as File)).rejects.toThrow('IMAGE_TOO_LARGE');
    await expect(slot.select({ size: 1 } as File)).rejects.toThrow('IMAGE_TOO_LARGE');
    expect(events).toEqual(['closed', 'revoked']);
  });
  it('取消解码后迟到的图像只释放，不成为新预览', async () => {
    const pending = deferred<{ image: typeof image; close: () => void }>(); const events: string[] = [];
    const slot = new ImageSelection({ decode: () => pending.promise, url: () => 'pending', revoke: url => { events.push(url); } });
    const selected = slot.select({ size: 1 } as File); slot.dispose();
    pending.resolve({ image, close: () => { events.push('close'); } }); await selected;
    expect(slot.current).toBeNull(); expect(events).toEqual(['close', 'pending']);
  });
});
