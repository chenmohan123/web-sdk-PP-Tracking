import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createYoloxDetector } from '../src/yolox/index';
import type { YoloxOptions } from '../src/yolox/types';

const mock = vi.hoisted(() => ({
  imported: false,
  create: vi.fn(),
  run: vi.fn(),
  release: vi.fn(),
  tensors: [] as Array<{
    data: Float32Array;
    dims: number[];
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('onnxruntime-web/all', () => {
  mock.imported = true;
  return {
    env: { wasm: {}, versions: { web: '1.27.0' } },
    InferenceSession: { create: mock.create },
    Tensor: class {
      data: Float32Array;
      dims: number[];
      type = 'float32';
      dispose = vi.fn();

      constructor(_type: string, data: Float32Array, dims: number[]) {
        this.data = data;
        this.dims = dims;
        mock.tensors.push(this);
      }
    },
  };
});

const MODEL_BYTES = 20_258_925;
const MODEL_SHA256 =
  '2e99f041301698ff4a9e898aa1efb4bcdd503d46f5c5c1829be17af9b7adfab6';
const OUTPUT_VALUES = 3_549 * 85;
const raw = new ArrayBuffer(MODEL_BYTES);
new Uint8Array(raw)[0] = 42;

function options(
  patch: Partial<YoloxOptions> = {},
): YoloxOptions {
  return {
    modelId: 'yolox-tiny-416-fp32',
    backend: 'wasm',
    modelBytes: raw,
    ...patch,
  };
}

function input() {
  return {
    image: {
      width: 1,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255]),
    },
  };
}

function output(values = new Float32Array(OUTPUT_VALUES)) {
  return {
    output: {
      data: values,
      dims: [1, 3_549, 85],
      type: 'float32',
      dispose: vi.fn(),
    },
  };
}

function personOutput() {
  const values = new Float32Array(OUTPUT_VALUES);
  const offset = 53 * 85;
  values[offset] = 0.5;
  values[offset + 1] = 0.5;
  values[offset + 4] = 0.9;
  values[offset + 5] = 0.8;
  return output(values);
}

function session() {
  return {
    run: mock.run,
    release: mock.release,
    inputNames: ['images'],
    outputNames: ['output'],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let digest: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mock.create.mockReset().mockResolvedValue(session());
  mock.run.mockReset().mockImplementation(async () => output());
  mock.release.mockReset().mockResolvedValue(undefined);
  mock.tensors.length = 0;
  digest = vi.fn(async (_algorithm: string, bytes: ArrayBuffer) => {
    const hash = new Uint8Array(bytes)[0] === 42
      ? MODEL_SHA256
      : '0'.repeat(64);
    return Uint8Array.from(
      hash.match(/../g)!,
      value => Number.parseInt(value, 16),
    ).buffer;
  });
  vi.stubGlobal('crypto', { subtle: { digest } });
});

afterEach(() => vi.unstubAllGlobals());

describe('YOLOX 候选加载', () => {
  it('导入并创建 detector 时不加载 ORT', async () => {
    expect(mock.imported).toBe(false);
    const detector = createYoloxDetector(options());
    expect(mock.imported).toBe(false);
    await detector.dispose();
  });

  it('同步复制模型字节，完整性通过后建 session，成功 load 幂等', async () => {
    const modelBytes = raw.slice(0);
    const detector = createYoloxDetector(options({ modelBytes }));
    new Uint8Array(modelBytes)[0] = 0;

    const first = await detector.load();
    const second = await detector.load();

    expect(digest).toHaveBeenCalledTimes(1);
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(digest.mock.invocationCallOrder[0])
      .toBeLessThan(mock.create.mock.invocationCallOrder[0]);
    expect(first).toMatchObject({
      source: { kind: 'bytes' },
      cache: { status: 'not-applicable', bytes: 0 },
      runtime: {
        requestedBackend: 'wasm',
        actualBackend: 'wasm',
        executionMode: 'main',
        ortVersion: '1.27.0',
      },
    });
    expect(second.runtime).toEqual(first.runtime);
    expect(second.timings.modelDownloadMs).toBe(0);
    expect(second.timings.modelCacheReadMs).toBe(0);

    await detector.dispose();
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('拒绝未知选项、隐式后端和越界阈值', () => {
    const invalid = [
      { ...options(), backend: 'auto' },
      { ...options(), scoreThreshold: -0.1 },
      { ...options(), nmsThreshold: 1.1 },
      { ...options(), maxDetections: 0 },
      { ...options(), maxDetections: 1_001 },
      { ...options(), classes: ['person'] },
      { ...options(), timestampMs: 0 },
      { ...options(), modelBytes: new SharedArrayBuffer(MODEL_BYTES) },
    ];

    for (const value of invalid) {
      expect(() => createYoloxDetector(value as unknown as YoloxOptions))
        .toThrow();
    }
  });

  it('SHA 不匹配时不创建 session', async () => {
    const detector = createYoloxDetector(
      options({ modelBytes: new ArrayBuffer(MODEL_BYTES) }),
    );

    await expect(detector.load()).rejects.toMatchObject({
      code: 'INTEGRITY_FAILED',
    });
    expect(mock.create).not.toHaveBeenCalled();
    await detector.dispose();
  });

  it('加载中拒绝 load 和 detect，并在失败后允许重试', async () => {
    const gate = deferred<ReturnType<typeof session>>();
    mock.create.mockReturnValueOnce(gate.promise);
    const detector = createYoloxDetector(options());
    const loading = detector.load();

    await expect(detector.load()).rejects.toMatchObject({ code: 'BUSY' });
    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'BUSY',
    });
    gate.resolve(session());
    await loading;
    await detector.dispose();

    const retry = createYoloxDetector(options());
    mock.create.mockRejectedValueOnce(
      new Error('https://user:password@example.test/?token=private'),
    );
    await expect(retry.load()).rejects.toMatchObject({
      code: 'SESSION_FAILED',
    });
    await retry.load();
    await retry.dispose();
  });

  it('会话契约失败时释放半成品并允许重试', async () => {
    mock.create.mockResolvedValueOnce({
      ...session(),
      outputNames: ['wrong'],
    });
    const detector = createYoloxDetector(options());

    await expect(detector.load()).rejects.toMatchObject({
      code: 'SESSION_FAILED',
    });
    expect(mock.release).toHaveBeenCalledTimes(1);
    await detector.load();
    await detector.dispose();
    expect(mock.release).toHaveBeenCalledTimes(2);
  });

  it('调用前取消、未加载和释放后返回稳定错误', async () => {
    const detector = createYoloxDetector(options());
    const controller = new AbortController();
    controller.abort();

    await expect(detector.load({ signal: controller.signal }))
      .rejects.toMatchObject({ code: 'ABORTED' });
    expect(digest).not.toHaveBeenCalled();
    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'NOT_LOADED',
    });

    await detector.dispose();
    await detector.dispose();
    await expect(detector.load()).rejects.toMatchObject({
      code: 'DISPOSED',
    });
    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'DISPOSED',
    });
  });

  it('会话创建期间取消会等待并释放半成品', async () => {
    const gate = deferred<ReturnType<typeof session>>();
    mock.create.mockReturnValueOnce(gate.promise);
    const detector = createYoloxDetector(options());
    const controller = new AbortController();
    const pending = detector.load({ signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'ABORTED',
    });

    await vi.waitFor(() => expect(mock.create).toHaveBeenCalled());
    controller.abort();
    expect(mock.release).not.toHaveBeenCalled();
    gate.resolve(session());
    await rejected;
    expect(mock.release).toHaveBeenCalledTimes(1);

    await detector.load();
    await detector.dispose();
  });

  it('固定 WASM 配置且 WebGPU 禁止 CPU fallback', async () => {
    const ort = await import('onnxruntime-web/all');
    const wasm = createYoloxDetector(options());
    await wasm.load();
    expect(ort.env.wasm.numThreads).toBe(1);
    expect(ort.env.wasm.proxy).toBe(false);
    expect(mock.create.mock.calls[0][1]).toMatchObject({
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'basic',
    });
    await wasm.dispose();

    vi.stubGlobal('navigator', { gpu: {} });
    const gpu = createYoloxDetector(options({ backend: 'webgpu' }));
    await gpu.load();
    expect(mock.create.mock.calls[1][1]).toMatchObject({
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'basic',
      extra: { session: { disable_cpu_ep_fallback: '1' } },
    });
    await gpu.dispose();
  });
});

describe('YOLOX 候选逐帧生命周期', () => {
  it('成功 detect 的 generation 从 0 开始逐次递增', async () => {
    const detector = createYoloxDetector(options());
    await detector.load();

    expect((await detector.detect(input())).generation).toBe(0);
    expect((await detector.detect(input())).generation).toBe(1);

    await detector.dispose();
  });

  it('输入在 API 边界复制，返回 detection 改写不污染后续结果', async () => {
    const gate = deferred<ReturnType<typeof personOutput>>();
    mock.run
      .mockReturnValueOnce(gate.promise)
      .mockResolvedValueOnce(personOutput());
    const detector = createYoloxDetector(options());
    await detector.load();
    const value = input();

    const pending = detector.detect(value);
    value.image.data.fill(0);
    gate.resolve(personOutput());
    const first = await pending;

    expect(mock.tensors[0].data[0])
      .toBe(Math.fround((1 - 0.485) / 0.229));
    expect(first.detections).toHaveLength(1);
    first.detections[0].box.x = 999;
    const second = await detector.detect(input());
    expect(second.detections[0].box.x).not.toBe(999);

    await detector.dispose();
  });

  it('输入失败和推理失败不推进 generation', async () => {
    const detector = createYoloxDetector(options());
    await detector.load();

    await expect(detector.detect({
      image: { width: 1, height: 1, data: new Uint8Array(3) },
    })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    mock.run.mockRejectedValueOnce(new Error('device lost'));
    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'INFERENCE_FAILED',
    });
    expect((await detector.detect(input())).generation).toBe(0);

    await detector.dispose();
  });

  it('运行取消等待 run 并释放输入输出，且不推进 generation', async () => {
    const gate = deferred<ReturnType<typeof output>>();
    const produced = output();
    mock.run.mockReturnValueOnce(gate.promise);
    const detector = createYoloxDetector(options());
    await detector.load();
    const controller = new AbortController();
    const pending = detector.detect(input(), { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'ABORTED',
    });

    await vi.waitFor(() => expect(mock.run).toHaveBeenCalled());
    controller.abort();
    await expect(detector.load()).rejects.toMatchObject({ code: 'BUSY' });
    expect(mock.tensors[0].dispose).not.toHaveBeenCalled();
    gate.resolve(produced);
    await rejected;

    expect(mock.tensors[0].dispose).toHaveBeenCalledTimes(1);
    expect(produced.output.dispose).toHaveBeenCalledTimes(1);
    expect((await detector.detect(input())).generation).toBe(0);
    await detector.dispose();
  });

  it('GPU 回读失败释放全部 tensor 且不推进 generation', async () => {
    const dispose = vi.fn();
    const extraDispose = vi.fn();
    mock.run.mockResolvedValueOnce({
      output: {
        type: 'float32',
        dims: [1, 3_549, 85],
        location: 'gpu-buffer',
        getData: vi.fn(async () => {
          throw new Error('readback failed');
        }),
        dispose,
      },
      extra: { dispose: extraDispose },
    });
    const detector = createYoloxDetector(options());
    await detector.load();

    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'INFERENCE_FAILED',
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(extraDispose).toHaveBeenCalledTimes(1);
    expect(mock.tensors[0].dispose).toHaveBeenCalledTimes(1);
    expect((await detector.detect(input())).generation).toBe(0);

    await detector.dispose();
  });

  it('畸形输出与个别 dispose 失败仍尝试释放其余资源', async () => {
    const primary = output(new Float32Array(3));
    primary.output.dispose.mockImplementationOnce(() => {
      throw new Error('dispose failed');
    });
    const extraDispose = vi.fn();
    mock.run.mockResolvedValueOnce({
      ...primary,
      extra: { dispose: extraDispose },
    });
    const detector = createYoloxDetector(options());
    await detector.load();

    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'INFERENCE_FAILED',
    });
    expect(primary.output.dispose).toHaveBeenCalledTimes(1);
    expect(extraDispose).toHaveBeenCalledTimes(1);
    expect(mock.tensors[0].dispose).toHaveBeenCalledTimes(1);
    expect((await detector.detect(input())).generation).toBe(0);

    await detector.dispose();
  });

  it('dispose 立即拒绝新工作，等待在途推理后释放 session', async () => {
    const gate = deferred<ReturnType<typeof output>>();
    mock.run.mockReturnValueOnce(gate.promise);
    const detector = createYoloxDetector(options());
    await detector.load();
    const pending = detector.detect(input());
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'ABORTED',
    });

    await vi.waitFor(() => expect(mock.run).toHaveBeenCalled());
    const disposing = detector.dispose();
    await expect(detector.detect(input())).rejects.toMatchObject({
      code: 'DISPOSED',
    });
    expect(mock.release).not.toHaveBeenCalled();

    gate.resolve(output());
    await rejected;
    await disposing;
    await detector.dispose();
    expect(mock.release).toHaveBeenCalledTimes(1);
  });
});
