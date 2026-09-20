import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createReIdExtractor, clearReIdCache, estimateReIdCache } from '../src/reid/index';
import type { ReIdOptions, ReIdSource } from '../src/reid/types';

const mock = vi.hoisted(() => ({ create: vi.fn(), run: vi.fn(), release: vi.fn(), tensors: [] as { dispose: ReturnType<typeof vi.fn>; data: Float32Array }[] }));
vi.mock('onnxruntime-web/all', () => ({
  env: { wasm: {}, versions: { web: '1.27.0' } },
  InferenceSession: { create: mock.create },
  Tensor: class { data: Float32Array; dims: number[]; type = 'float32'; dispose = vi.fn(); constructor(_type: string, data: Float32Array, dims: number[]) { this.data = data; this.dims = dims; mock.tensors.push(this); } },
}));
const SHA = '24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4';
const BYTES = 33_704_835;
const raw = new ArrayBuffer(BYTES); new Uint8Array(raw)[0] = 42;
const source: ReIdSource = { kind: 'modelscope', repository: 'test/reid', revision: 'a'.repeat(40), path: 'model.onnx', downloadUrl: 'https://modelscope.cn/test/model.onnx', bytes: BYTES, sha256: SHA };
const options = () => ({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', modelBytes: raw } satisfies ReIdOptions);
const input = () => ({ image: { width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]) }, detections: [{ box: { x: 0, y: 0, width: 1, height: 1 }, score: 0.8, classId: 0 }] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function output(values = new Float32Array(512).fill(1)) { return { 'save_infer_model/scale_0.tmp_0': { data: values, dims: [1, 512], type: 'float32', dispose: vi.fn() } }; }
const session = () => ({ run: mock.run, release: mock.release, inputNames: ['crops'], outputNames: ['save_infer_model/scale_0.tmp_0'] });
let digest: ReturnType<typeof vi.fn>;
let stored: Map<string, Response>;
beforeEach(() => {
  vi.clearAllMocks(); mock.tensors.length = 0; mock.create.mockResolvedValue(session()); mock.run.mockImplementation(async () => output()); mock.release.mockResolvedValue(undefined);
  digest = vi.fn(async (_algorithm: string, bytes: ArrayBuffer) => Uint8Array.from((new Uint8Array(bytes)[0] === 42 ? SHA : '0'.repeat(64)).match(/../g)!, value => parseInt(value, 16)).buffer);
  vi.stubGlobal('crypto', { subtle: { digest } });
  stored = new Map();
  const cache = { match: vi.fn(async (key: string | Request) => stored.get(typeof key === 'string' ? key : key.url)?.clone()), put: vi.fn(async (key: string, value: Response) => { stored.set(key, value.clone()); }), delete: vi.fn(async (key: string) => stored.delete(key)), keys: vi.fn(async () => [...stored.keys()].map(url => ({ url }))) };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache), keys: vi.fn(async () => ['web-sdk-pp-tracking-reid-v1', 'unrelated']), delete: vi.fn(async (key: string) => { if (key === 'web-sdk-pp-tracking-reid-v1') stored.clear(); return true; }) });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(raw.slice(0))));
});
afterEach(() => vi.unstubAllGlobals());

describe('ReID 固定身份与生命周期', () => {
  it('工厂同步复制模型，校验完整 SHA 后才建 session，ready load 幂等', async () => {
    const bytes = raw.slice(0), instance = createReIdExtractor({ ...options(), modelBytes: bytes });
    new Uint8Array(bytes)[0] = 0;
    const first = await instance.load(), second = await instance.load();
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(digest.mock.invocationCallOrder[0]).toBeLessThan(mock.create.mock.invocationCallOrder[0]);
    expect(first.runtime).toMatchObject({ requestedBackend: 'wasm', actualBackend: 'wasm', executionMode: 'main', ortVersion: '1.27.0' });
    expect(second.runtime).toEqual(first.runtime);
    expect(instance.featureSpace.id).toContain(SHA); expect(instance.featureSpace.id.length).toBeLessThanOrEqual(256);
    expect(instance.featureSpace).toMatchObject({ dimension: 512 });
    await instance.dispose(); expect(mock.release).toHaveBeenCalledTimes(1);
  });
  it('无效配置和 hash 在 session 前拒绝', async () => {
    for (const bad of [{ ...options(), backend: 'auto' }, { ...options(), maxDetections: 65 }, { ...options(), source }, { ...options(), modelBytes: new SharedArrayBuffer(BYTES) }]) expect(() => createReIdExtractor(bad as ReIdOptions)).toThrow();
    const instance = createReIdExtractor({ ...options(), modelBytes: new ArrayBuffer(BYTES) });
    await expect(instance.load()).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' }); expect(mock.create).not.toHaveBeenCalled(); await instance.dispose();
  });
  it('加载中 load/extract 返回 BUSY，失败可重试', async () => {
    const gate = deferred<ReturnType<typeof session>>(); mock.create.mockReturnValueOnce(gate.promise);
    const instance = createReIdExtractor(options()), loading = instance.load();
    await expect(instance.load()).rejects.toMatchObject({ code: 'BUSY' }); await expect(instance.extract(input())).rejects.toMatchObject({ code: 'BUSY' });
    gate.resolve(session()); await loading; await instance.dispose();
    const retry = createReIdExtractor(options()); mock.create.mockRejectedValueOnce(new Error('https://secret:password@host/?token=private'));
    await expect(retry.load()).rejects.toMatchObject({ code: 'SESSION_FAILED' }); await retry.load(); await retry.dispose();
  });
  it('调用前取消、未加载、释放后均稳定拒绝', async () => {
    const instance = createReIdExtractor(options()), controller = new AbortController(); controller.abort();
    await expect(instance.load({ signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' }); expect(digest).not.toHaveBeenCalled();
    await expect(instance.extract(input())).rejects.toMatchObject({ code: 'NOT_LOADED' });
    await instance.dispose(); await instance.dispose();
    await expect(instance.load()).rejects.toMatchObject({ code: 'DISPOSED' }); await expect(instance.extract(input())).rejects.toMatchObject({ code: 'DISPOSED' });
  });
  it('session 创建期间取消等待并释放半成品，随后可重试', async () => {
    const gate = deferred<ReturnType<typeof session>>(); mock.create.mockReturnValueOnce(gate.promise);
    const instance = createReIdExtractor(options()), controller = new AbortController();
    const pending = instance.load({ signal: controller.signal }); const rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(mock.create).toHaveBeenCalled()); controller.abort(); expect(mock.release).not.toHaveBeenCalled();
    gate.resolve(session()); await rejected; expect(mock.release).toHaveBeenCalledTimes(1); await instance.load(); await instance.dispose();
  });
  it('完整帧验证先于推理，输入数量/分数/类别/图外框失败不会部分运行', async () => {
    const instance = createReIdExtractor(options()); await instance.load();
    for (const patch of [{ score: NaN }, { score: 1.1 }, { classId: -1 }, { classId: 0.5 }, { box: { x: 0.5, y: 0, width: 1, height: 1 } }]) {
      const value = input(); value.detections.push({ ...value.detections[0], ...patch });
      await expect(instance.extract(value)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
    const many = input(); many.detections = Array.from({ length: 33 }, () => many.detections[0]);
    await expect(instance.extract(many)).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(mock.run).not.toHaveBeenCalled();
    const empty = await instance.extract({ ...input(), detections: [] }); expect(empty.detections).toEqual([]); expect(mock.run).not.toHaveBeenCalled(); await instance.dispose();
  });
  it('稀疏检测数组在任何推理前拒绝', async () => {
    const instance = createReIdExtractor(options()); await instance.load(); const value = input(); value.detections.length = 2;
    await expect(instance.extract(value)).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(mock.run).not.toHaveBeenCalled(); await instance.dispose();
  });
  it('SHA 等待期间取消不会创建会话，可重新加载', async () => {
    const gate = deferred<ArrayBuffer>(); digest.mockReturnValueOnce(gate.promise);
    const instance = createReIdExtractor(options()), controller = new AbortController();
    const pending = instance.load({ signal: controller.signal }), rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(digest).toHaveBeenCalled()); controller.abort();
    gate.resolve(new ArrayBuffer(32)); await rejected; expect(mock.create).not.toHaveBeenCalled(); await instance.load(); await instance.dispose();
  });
  it('session 完成进度回调取消释放会话，不提交 ready', async () => {
    const instance = createReIdExtractor(options()), controller = new AbortController();
    await expect(instance.load({ signal: controller.signal, onProgress: event => { if (event.stage === 'session' && event.status === 'complete') controller.abort(); } })).rejects.toMatchObject({ code: 'ABORTED' });
    expect(mock.release).toHaveBeenCalledTimes(1); await expect(instance.extract(input())).rejects.toMatchObject({ code: 'NOT_LOADED' }); await instance.load(); await instance.dispose();
  });
  it('dispose 等待加载中的会话创建再释放，不提前 release', async () => {
    const gate = deferred<ReturnType<typeof session>>(); mock.create.mockReturnValueOnce(gate.promise);
    const instance = createReIdExtractor(options()), pending = instance.load(), rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(mock.create).toHaveBeenCalled()); const disposed = instance.dispose();
    expect(mock.release).not.toHaveBeenCalled(); gate.resolve(session()); await rejected; await disposed; expect(mock.release).toHaveBeenCalledTimes(1);
  });
  it('多检测一一绑定不同方向的向量，后续失败不提交部分结果', async () => {
    const first = new Float32Array(512); first[0] = 2; const second = new Float32Array(512); second[1] = 3;
    mock.run.mockResolvedValueOnce(output(first)).mockResolvedValueOnce(output(second));
    const instance = createReIdExtractor(options()); await instance.load(); const value = input(); value.detections.push({ ...value.detections[0], classId: 1 });
    const result = await instance.extract(value); expect(result.detections[0].embedding![0]).toBe(1); expect(result.detections[1].embedding![1]).toBe(1);
    mock.run.mockResolvedValueOnce(output(first)).mockRejectedValueOnce(new Error('失败'));
    await expect(instance.extract(value)).rejects.toMatchObject({ code: 'INFERENCE_FAILED' }); await instance.extract(input()); await instance.dispose();
  });
  it('GPU 输出回读期间取消继续等待并释放所有输出', async () => {
    const gate = deferred<Float32Array>(), dispose = vi.fn(), extraDispose = vi.fn();
    mock.run.mockResolvedValueOnce({ 'save_infer_model/scale_0.tmp_0': { type: 'float32', dims: [1, 512], location: 'gpu-buffer', getData: vi.fn(() => gate.promise), dispose }, extra: { dispose: extraDispose } });
    const instance = createReIdExtractor(options()); await instance.load(); const controller = new AbortController();
    const pending = instance.extract(input(), { signal: controller.signal }), rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(mock.run).toHaveBeenCalled()); controller.abort(); expect(dispose).not.toHaveBeenCalled();
    gate.resolve(new Float32Array(512).fill(1)); await rejected; expect(dispose).toHaveBeenCalledTimes(1); expect(extraDispose).toHaveBeenCalledTimes(1); await instance.dispose();
  });
  it('个别 Tensor 释放报错仍尝试释放其余输出和输入', async () => {
    const first = output(), extraDispose = vi.fn(); first['save_infer_model/scale_0.tmp_0'].dispose.mockImplementationOnce(() => { throw new Error('资源异常'); });
    mock.run.mockResolvedValueOnce({ ...first, extra: { dispose: extraDispose } });
    const instance = createReIdExtractor(options()); await instance.load(); await expect(instance.extract(input())).rejects.toMatchObject({ code: 'INFERENCE_FAILED' });
    expect(extraDispose).toHaveBeenCalledTimes(1); expect(mock.tensors[0].dispose).toHaveBeenCalledTimes(1); await instance.dispose();
  });
  it('featureSpace 在运行时只读且不能替换，结果改写不污染内部身份', async () => {
    const instance = createReIdExtractor(options());
    expect(() => { (instance as { featureSpace: unknown }).featureSpace = {}; }).toThrow();
    expect(() => { (instance.featureSpace as { id: string }).id = 'wrong'; }).toThrow();
    const loaded = await instance.load(); loaded.runtime.actualBackend = 'webgpu';
    expect((await instance.extract(input())).runtime.actualBackend).toBe('wasm'); await instance.dispose();
  });
  it('WebGPU 禁止 CPU fallback，WASM 固定单线程 basic', async () => {
    const ort = await import('onnxruntime-web/all'); const wasm = createReIdExtractor(options()); await wasm.load();
    expect(ort.env.wasm.numThreads).toBe(1); expect(mock.create.mock.calls[0][1]).toMatchObject({ executionProviders: ['wasm'], graphOptimizationLevel: 'basic' }); await wasm.dispose();
    vi.stubGlobal('navigator', { gpu: {} }); const gpu = createReIdExtractor({ ...options(), backend: 'webgpu' });
    expect((await gpu.load()).runtime.actualBackend).toBe('webgpu'); expect(mock.create.mock.calls[1][1]).toMatchObject({ executionProviders: ['webgpu'], extra: { session: { disable_cpu_ep_fallback: '1' } } }); await gpu.dispose();
  });
  it('明确 OOM 稳定归类，未知设备错误不猜测 OOM', async () => {
    const instance = createReIdExtractor(options()); mock.create.mockRejectedValueOnce(new Error('out of memory'));
    await expect(instance.load()).rejects.toMatchObject({ code: 'OUT_OF_MEMORY' }); await instance.load(); mock.run.mockRejectedValueOnce(new Error('device lost'));
    await expect(instance.extract(input())).rejects.toMatchObject({ code: 'INFERENCE_FAILED' }); await instance.dispose();
  });
  it('图像和元数据在入口复制，输出按顺序绑定且保留分数框', async () => {
    const gate = deferred<ReturnType<typeof output>>(); mock.run.mockReturnValueOnce(gate.promise).mockResolvedValueOnce(output(new Float32Array(512).fill(2)));
    const instance = createReIdExtractor(options()); await instance.load();
    const value = input(); value.detections.push({ box: { x: 0.2, y: 0.3, width: 0.6, height: 0.5 }, score: 0.4, classId: 1 });
    const pending = instance.extract(value); value.image.data.fill(0); value.detections[1].box.x = 99; value.detections[1].score = 0;
    gate.resolve(output()); const result = await pending;
    expect(result.detections[1]).toMatchObject({ box: { x: 0.2, y: 0.3, width: 0.6, height: 0.5 }, score: 0.4, classId: 1 });
    expect(mock.tensors[1].data[0]).toBe(Math.fround((1 - 0.485) / 0.229));
    for (const detection of result.detections) expect(Math.hypot(...detection.embedding!)).toBeCloseTo(1, 6);
    expect(result.timings.decodeMs).toBe(0); expect(mock.tensors.every(tensor => tensor.dispose.mock.calls.length === 1)).toBe(true); await instance.dispose();
  });
  it('运行取消等待 run，释放所有 Tensor，丢弃整帧且下一帧可恢复', async () => {
    const gate = deferred<ReturnType<typeof output>>(), out = output(); mock.run.mockReturnValueOnce(gate.promise);
    const instance = createReIdExtractor(options()); await instance.load(); const controller = new AbortController();
    const pending = instance.extract(input(), { signal: controller.signal }); const rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(mock.run).toHaveBeenCalled()); controller.abort();
    await expect(instance.load()).rejects.toMatchObject({ code: 'BUSY' }); await expect(instance.extract(input())).rejects.toMatchObject({ code: 'BUSY' });
    expect(mock.tensors[0].dispose).not.toHaveBeenCalled(); gate.resolve(out); await rejected;
    expect(out['save_infer_model/scale_0.tmp_0'].dispose).toHaveBeenCalledTimes(1); expect(mock.tensors[0].dispose).toHaveBeenCalledTimes(1);
    await instance.extract(input()); await instance.dispose();
  });
  it('dispose 等待 run 再 release，立即拒绝新工作且幂等', async () => {
    const gate = deferred<ReturnType<typeof output>>(); mock.run.mockReturnValueOnce(gate.promise);
    const instance = createReIdExtractor(options()); await instance.load(); const pending = instance.extract(input()); const rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(mock.run).toHaveBeenCalled()); const disposed = instance.dispose();
    await expect(instance.load()).rejects.toMatchObject({ code: 'DISPOSED' }); expect(mock.release).not.toHaveBeenCalled();
    gate.resolve(output()); await rejected; await disposed; await instance.dispose(); expect(mock.release).toHaveBeenCalledTimes(1);
  });
  it.each(['zero', 'nan', 'short', 'run'])('输出 %s 失败整帧原子性与下一帧恢复', async kind => {
    const instance = createReIdExtractor(options()); await instance.load(); const out = output(kind === 'short' ? new Float32Array(3) : new Float32Array(512).fill(kind === 'nan' ? NaN : 0));
    if (kind === 'run') mock.run.mockRejectedValueOnce(new Error('secret-url')); else mock.run.mockResolvedValueOnce(out);
    await expect(instance.extract(input())).rejects.toMatchObject({ code: 'INFERENCE_FAILED' });
    if (kind !== 'run') expect(out['save_infer_model/scale_0.tmp_0'].dispose).toHaveBeenCalledTimes(1);
    await instance.extract(input()); await instance.dispose();
  });
});

describe('ReID 资产边界', () => {
  it('来源固定版本/大小/SHA/HTTPS 校验且同步复制来源 metadata', async () => {
    for (const patch of [{ revision: 'main' }, { sha256: '0'.repeat(64) }, { bytes: 1 }, { downloadUrl: 'http://example.com/model' }, { downloadUrl: 'https://user:pass@example.com/model' }]) {
      expect(() => createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source: { ...source, ...patch } })).toThrowError(expect.objectContaining({ code: 'INVALID_MANIFEST' }));
    }
    const chosen = { ...source }; const instance = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source: chosen }); chosen.downloadUrl = 'https://wrong.invalid';
    expect((await instance.load()).source).toEqual(source); expect(fetch).toHaveBeenCalledWith(source.downloadUrl, expect.anything()); await instance.dispose();
  });
  it('下载缓存仍校验 SHA，错误缓存删除且不换源', async () => {
    const first = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source }); await first.load(); await first.dispose();
    expect(await estimateReIdCache()).toEqual({ bytes: BYTES, entries: 1 });
    const second = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source }); const hit = await second.load(); await second.dispose();
    expect(hit.cache.status).toBe('hit'); expect(fetch).toHaveBeenCalledTimes(1); expect(digest).toHaveBeenCalledTimes(2);
    const key = [...stored.keys()][0]; stored.set(key, new Response(new Uint8Array([1])));
    const corrupt = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    await expect(corrupt.load()).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' }); expect(stored.size).toBe(0); expect(fetch).toHaveBeenCalledTimes(1); await corrupt.dispose();
    await clearReIdCache(); expect(caches.delete).toHaveBeenCalledWith('web-sdk-pp-tracking-reid-v1'); expect(caches.delete).not.toHaveBeenCalledWith('unrelated');
  });
  it('本地模型不缓存，缓存不可用明确报告', async () => {
    const local = createReIdExtractor(options()); const result = await local.load(); expect(result.cache.status).toBe('not-applicable'); expect(caches.open).not.toHaveBeenCalled(); await local.dispose();
    vi.stubGlobal('caches', undefined); const remote = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    expect((await remote.load()).cache.status).toBe('unavailable'); await remote.dispose();
  });
  it('网络错误使用安全原因且仅请求显式来源', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('https://user:password@host/?secret=token'));
    const instance = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    try { await instance.load(); throw new Error('应失败'); } catch (error) { expect(error).toMatchObject({ code: 'DOWNLOAD_FAILED' }); expect(String(error)).not.toMatch(/password|secret=token/); }
    expect(fetch).toHaveBeenCalledTimes(1); await instance.dispose();
  });
  it('下载硬上限触发 reader 取消，短文件拒绝', async () => {
    const cancel = vi.fn(); vi.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(BYTES + 1)); }, cancel })));
    const instance = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    await expect(instance.load()).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' }); expect(cancel).toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array(5))); await expect(instance.load()).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' }); await instance.dispose();
  });
  it('下载 pending read 取消能结束读取并释放 reader', async () => {
    const cancel = vi.fn(); vi.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream({ pull() {}, cancel })));
    const instance = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source }), controller = new AbortController();
    const pending = instance.load({ signal: controller.signal }); const rejected = expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled()); controller.abort(); await rejected; expect(cancel).toHaveBeenCalled(); await instance.dispose();
  });
  it('fetch 刚返回响应时取消也会关闭响应体', async () => {
    const controller = new AbortController(), cancel = vi.fn();
    vi.mocked(fetch).mockImplementationOnce(async () => { controller.abort(); return new Response(new ReadableStream({ pull() {}, cancel })); });
    const instance = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm', source });
    await expect(instance.load({ signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' }); expect(cancel).toHaveBeenCalledTimes(1); await instance.dispose();
  });
});
