import type { Detection } from '../types';
import { acquireModel, verifyBytes } from './assets';
import { aborted, ReIdError, safeError } from './errors';
import { FEATURE_SPACE, INPUT_NAME, OUTPUT_NAME, validateOptions } from './model';
import { createSession, type LoadedSession } from './ort';
import { copyInput, preprocessRgba } from './preprocess';
import type { ReIdExtractor, ReIdLoadResult, ReIdLoadTimings, ReIdOptions, ReIdResult } from './types';

const clock = () => performance.now();
export function createReIdExtractor(options: ReIdOptions): ReIdExtractor {
  const config = validateOptions(options);
  let bytes = config.modelBytes;
  // 模型只由一个字段持有；成功加载或 dispose 后释放本模块的字节引用。
  config.modelBytes = undefined;
  let loaded: LoadedSession | undefined;
  let loadResult: ReIdLoadResult | undefined;
  let active: Promise<unknown> | undefined;
  let controller: AbortController | undefined;
  let disposed = false;
  let disposing: Promise<void> | undefined;
  function guard() {
    if (disposed) throw new ReIdError('DISPOSED', '实例已释放');
    if (active) throw new ReIdError('BUSY', '实例正在加载或提取');
  }
  function operation<T>(signal: AbortSignal | undefined, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const own = new AbortController(); controller = own;
    const abort = () => own.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) own.abort();
    // 延后执行使 active 在所有异步回调和进度回调之前可见。
    const promise = Promise.resolve().then(() => { aborted(own.signal); return task(own.signal); }).finally(() => {
      signal?.removeEventListener('abort', abort); controller = undefined; active = undefined;
    });
    active = promise; return promise;
  }
  return {
    get featureSpace() { return FEATURE_SPACE; },
    load(loadOptions = {}) {
      const start = clock();
      try { guard(); aborted(loadOptions.signal); } catch (error) { return Promise.reject(error); }
      if (loaded && loadResult) return Promise.resolve({ ...loadResult, runtime: { ...loadResult.runtime }, source: { ...loadResult.source }, cache: { ...loadResult.cache }, timings: { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, totalMs: clock() - start } });
      return operation(loadOptions.signal, async signal => {
        const timings: ReIdLoadTimings = { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, totalMs: 0 };
        const notify = loadOptions.onProgress ?? (() => undefined);
        let candidate: LoadedSession | undefined;
        try {
          let acquired;
          if (bytes) { await verifyBytes(bytes, signal, notify, timings); acquired = { bytes, cache: { status: 'not-applicable' as const, bytes: 0 } }; }
          else acquired = await acquireModel(config.source!, signal, notify, timings);
          aborted(signal);
          const sessionStart = clock();
          try {
            notify({ stage: 'session', status: 'start' }); aborted(signal);
            candidate = await createSession(acquired.bytes, config.backend, signal);
            notify({ stage: 'session', status: 'complete' }); aborted(signal);
          } finally { timings.sessionMs = clock() - sessionStart; }
          loaded = candidate; bytes = undefined;
          timings.totalMs = clock() - start;
          loadResult = { runtime: { ...loaded.runtime }, timings, source: config.source ? { ...config.source } : { kind: 'bytes' }, cache: acquired.cache };
          return { ...loadResult, runtime: { ...loadResult.runtime }, timings: { ...timings }, source: { ...loadResult.source }, cache: { ...loadResult.cache } };
        } catch (error) {
          if (candidate) await candidate.session.release().catch(() => undefined);
          aborted(signal); throw safeError(error, 'SESSION_FAILED');
        }
      });
    },
    extract(input, extractOptions = {}) {
      const start = clock();
      let snapshot: ReturnType<typeof copyInput>;
      try {
        guard(); aborted(extractOptions.signal);
        if (!loaded) throw new ReIdError('NOT_LOADED', '请先加载模型');
        snapshot = copyInput(input, config.maxDetections);
      } catch (error) { return Promise.reject(safeError(error, 'INVALID_INPUT')); }
      const validationMs = clock() - start;
      return operation(extractOptions.signal, async signal => {
        const current = loaded!;
        const timings = { decodeMs: 0, preprocessMs: validationMs, inferenceMs: 0, postprocessMs: 0, totalMs: 0 };
        const detections: Detection[] = [];
        try {
          for (const detection of snapshot.detections) {
            aborted(signal);
            let tensor: InstanceType<typeof current.ort.Tensor> | undefined;
            let outputs: Awaited<ReturnType<typeof current.session.run>> | undefined;
            try {
              const preprocessStart = clock();
              try { tensor = new current.ort.Tensor('float32', preprocessRgba(snapshot.image, detection.box).tensor, [1, 3, 192, 64]); }
              finally { timings.preprocessMs += clock() - preprocessStart; }
              aborted(signal);
              const inferenceStart = clock();
              try { outputs = await current.session.run({ [INPUT_NAME]: tensor }); }
              finally { timings.inferenceMs += clock() - inferenceStart; }
              aborted(signal);
              const postprocessStart = clock();
              try {
                const output = outputs[OUTPUT_NAME];
                if (!output || output.type !== 'float32' || output.dims.length !== 2 || output.dims[0] !== 1 || output.dims[1] !== 512) throw new ReIdError('INFERENCE_FAILED', '模型输出形状或类型不匹配');
                // 默认 CPU 输出直接读取；GPU 驻留输出在这里等待回读。
                const values = output.location === 'gpu-buffer' ? await output.getData() : output.data;
                aborted(signal);
                if (!(values instanceof Float32Array) || values.length !== 512) throw new ReIdError('INFERENCE_FAILED', '模型输出维度不匹配');
                let squared = 0;
                for (const value of values) { if (!Number.isFinite(value)) throw new ReIdError('INFERENCE_FAILED', '特征包含非有限值'); squared += value * value; }
                if (!(squared > 0) || !Number.isFinite(squared)) throw new ReIdError('INFERENCE_FAILED', '特征范数无效');
                const norm = Math.sqrt(squared), embedding = new Float32Array(512);
                for (let i = 0; i < 512; i++) embedding[i] = values[i] / norm;
                detections.push({ ...detection, embedding });
              } finally { timings.postprocessMs += clock() - postprocessStart; }
            } finally {
              const releaseStart = clock();
              let releaseError: unknown;
              for (const resource of new Set([...Object.values(outputs ?? {}), ...(tensor ? [tensor] : [])])) {
                try { resource.dispose(); } catch (error) { releaseError ??= error; }
              }
              timings.postprocessMs += clock() - releaseStart;
              if (releaseError !== undefined) throw releaseError;
            }
            aborted(signal);
          }
          aborted(signal); timings.totalMs = clock() - start;
          return { featureSpace: FEATURE_SPACE, detections, runtime: { ...current.runtime }, timings } satisfies ReIdResult;
        } catch (error) { aborted(signal); throw safeError(error, 'INFERENCE_FAILED'); }
      });
    },
    dispose() {
      if (disposing) return disposing;
      disposed = true; controller?.abort();
      disposing = (async () => {
        try { await active; } catch { /* 操作调用者仍收到原错误，释放只等待资源就绪。 */ }
        const current = loaded; loaded = undefined; bytes = undefined; loadResult = undefined;
        if (current) { try { await current.session.release(); } catch (error) { throw safeError(error, 'SESSION_FAILED'); } }
      })();
      return disposing;
    },
  };
}
