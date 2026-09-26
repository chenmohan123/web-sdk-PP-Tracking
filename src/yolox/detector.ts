import { decodeYolox } from './decode';
import { aborted, safeError, YoloxError } from './errors';
import {
  verifyModelBytes,
  INPUT_NAME,
  OUTPUT_NAME,
  validateOptions,
} from './model';
import { createSession, type LoadedSession } from './ort';
import { preprocessYolox } from './preprocess';
import type {
  YoloxDetector,
  YoloxDetectorResult,
  YoloxInput,
  YoloxLoadResult,
  YoloxLoadTimings,
  YoloxOptions,
} from './types';

const clock = () => performance.now();

function copyInput(input: YoloxInput): YoloxInput {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).some(key => key !== 'image')
  ) {
    throw new YoloxError('INVALID_INPUT', '检测输入无效');
  }

  const image = input.image;
  if (
    !image ||
    typeof image !== 'object' ||
    Object.keys(image).some(
      key => key !== 'width' && key !== 'height' && key !== 'data',
    ) ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.width > 8_192 ||
    image.height > 8_192 ||
    image.width * image.height > 16_777_216
  ) {
    throw new YoloxError(
      'INVALID_INPUT',
      '图像尺寸无效或超过上限',
    );
  }

  if (
    !(
      image.data instanceof Uint8Array ||
      image.data instanceof Uint8ClampedArray
    ) ||
    !(image.data.buffer instanceof ArrayBuffer) ||
    image.data.byteOffset !== 0 ||
    image.data.byteLength !== image.data.buffer.byteLength ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new YoloxError(
      'INVALID_INPUT',
      '需要独立缓冲的完整 RGBA8 数据',
    );
  }

  return {
    image: {
      width: image.width,
      height: image.height,
      data: image.data.slice(),
    },
  };
}

function cloneLoadResult(
  result: YoloxLoadResult,
  totalMs: number,
): YoloxLoadResult {
  return {
    runtime: { ...result.runtime },
    timings: {
      modelDownloadMs: 0,
      modelCacheReadMs: 0,
      integrityMs: 0,
      sessionMs: 0,
      totalMs,
    },
    source: { ...result.source },
    cache: { ...result.cache },
  };
}

export function createYoloxDetector(
  options: YoloxOptions,
): YoloxDetector {
  const config = validateOptions(options);
  let bytes = config.modelBytes;
  config.modelBytes = undefined;
  let loaded: LoadedSession | undefined;
  let loadResult: YoloxLoadResult | undefined;
  let active: Promise<unknown> | undefined;
  let controller: AbortController | undefined;
  let disposed = false;
  let disposing: Promise<void> | undefined;
  let generation = 0;

  function guard(): void {
    if (disposed) {
      throw new YoloxError('DISPOSED', '实例已释放');
    }
    if (active) {
      throw new YoloxError('BUSY', '实例正在加载或检测');
    }
  }

  function operation<T>(
    signal: AbortSignal | undefined,
    task: (operationSignal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const own = new AbortController();
    controller = own;
    const abort = () => own.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      own.abort();
    }

    const promise = Promise.resolve()
      .then(() => {
        aborted(own.signal);
        return task(own.signal);
      })
      .finally(() => {
        signal?.removeEventListener('abort', abort);
        controller = undefined;
        active = undefined;
      });
    active = promise;
    return promise;
  }

  return {
    load(loadOptions = {}) {
      const start = clock();
      try {
        guard();
        aborted(loadOptions.signal);
      } catch (error) {
        return Promise.reject(error);
      }

      if (loaded && loadResult) {
        return Promise.resolve(
          cloneLoadResult(loadResult, clock() - start),
        );
      }

      return operation(loadOptions.signal, async signal => {
        const timings: YoloxLoadTimings = {
          modelDownloadMs: 0,
          modelCacheReadMs: 0,
          integrityMs: 0,
          sessionMs: 0,
          totalMs: 0,
        };
        const notify = loadOptions.onProgress ?? (() => undefined);
        let candidate: LoadedSession | undefined;
        try {
          await verifyModelBytes(bytes!, signal, notify, timings);
          aborted(signal);

          const sessionStart = clock();
          try {
            notify({ stage: 'session', status: 'start' });
            aborted(signal);
            candidate = await createSession(bytes!, config.backend, signal);
            notify({ stage: 'session', status: 'complete' });
            aborted(signal);
          } finally {
            timings.sessionMs += clock() - sessionStart;
          }

          loaded = candidate;
          bytes = undefined;
          timings.totalMs = clock() - start;
          loadResult = {
            runtime: { ...loaded.runtime },
            timings: { ...timings },
            source: { kind: 'bytes' },
            cache: { status: 'not-applicable', bytes: 0 },
          };
          return {
            runtime: { ...loadResult.runtime },
            timings: { ...loadResult.timings },
            source: { ...loadResult.source },
            cache: { ...loadResult.cache },
          };
        } catch (error) {
          if (candidate) {
            await candidate.session.release().catch(() => undefined);
          }
          aborted(signal);
          throw safeError(error, 'SESSION_FAILED');
        }
      });
    },

    detect(input, detectOptions = {}) {
      const start = clock();
      let snapshot: YoloxInput;
      try {
        guard();
        aborted(detectOptions.signal);
        if (!loaded) {
          throw new YoloxError('NOT_LOADED', '请先加载模型');
        }
        snapshot = copyInput(input);
      } catch (error) {
        return Promise.reject(safeError(error, 'INVALID_INPUT'));
      }
      const validationMs = clock() - start;

      return operation(detectOptions.signal, async signal => {
        const current = loaded!;
        const timings = {
          validationMs,
          preprocessMs: 0,
          inferenceMs: 0,
          postprocessMs: 0,
          totalMs: 0,
        };
        let tensor: InstanceType<typeof current.ort.Tensor> | undefined;
        let outputs: Awaited<ReturnType<typeof current.session.run>> | undefined;
        let decoded: ReturnType<typeof decodeYolox> | undefined;

        try {
          const preprocessStart = clock();
          let metadata: ReturnType<typeof preprocessYolox>;
          try {
            metadata = preprocessYolox(snapshot);
            tensor = new current.ort.Tensor(
              'float32',
              metadata.tensor,
              [1, 3, 416, 416],
            );
          } finally {
            timings.preprocessMs += clock() - preprocessStart;
          }
          aborted(signal);

          const inferenceStart = clock();
          try {
            outputs = await current.session.run({
              [INPUT_NAME]: tensor,
            });
          } finally {
            timings.inferenceMs += clock() - inferenceStart;
          }
          aborted(signal);

          const postprocessStart = clock();
          try {
            const output = outputs[OUTPUT_NAME];
            if (
              !output ||
              output.type !== 'float32' ||
              output.dims.length !== 3 ||
              output.dims[0] !== 1 ||
              output.dims[1] !== 3_549 ||
              output.dims[2] !== 85
            ) {
              throw new YoloxError(
                'INFERENCE_FAILED',
                '模型输出形状或类型不匹配',
              );
            }

            const values = output.location === 'gpu-buffer'
              ? await output.getData()
              : output.data;
            aborted(signal);
            if (!(values instanceof Float32Array)) {
              throw new YoloxError(
                'INFERENCE_FAILED',
                '模型输出数据类型不匹配',
              );
            }

            decoded = decodeYolox(values, metadata, {
              scoreThreshold: config.scoreThreshold,
              nmsThreshold: config.nmsThreshold,
              maxDetections: config.maxDetections,
            });
            aborted(signal);
          } finally {
            timings.postprocessMs += clock() - postprocessStart;
          }
        } catch (error) {
          aborted(signal);
          throw safeError(error, 'INFERENCE_FAILED');
        } finally {
          const releaseStart = clock();
          let releaseError: unknown;
          for (const resource of new Set([
            ...Object.values(outputs ?? {}),
            ...(tensor ? [tensor] : []),
          ])) {
            try {
              resource.dispose();
            } catch (error) {
              releaseError ??= error;
            }
          }
          timings.postprocessMs += clock() - releaseStart;
          if (releaseError !== undefined) {
            throw safeError(releaseError, 'INFERENCE_FAILED');
          }
        }

        aborted(signal);
        const resultGeneration = generation;
        generation += 1;
        timings.totalMs = clock() - start;
        return {
          generation: resultGeneration,
          detections: decoded!.detections.map(detection => ({
            ...detection,
            box: { ...detection.box },
          })),
          droppedDetections: decoded!.droppedDetections,
          runtime: { ...current.runtime },
          timings,
        } satisfies YoloxDetectorResult;
      });
    },

    dispose() {
      if (disposing) {
        return disposing;
      }
      disposed = true;
      controller?.abort();
      disposing = (async () => {
        try {
          await active;
        } catch {
          // The operation caller receives the original error.
        }
        const current = loaded;
        loaded = undefined;
        bytes = undefined;
        loadResult = undefined;
        if (current) {
          try {
            await current.session.release();
          } catch (error) {
            throw safeError(error, 'SESSION_FAILED');
          }
        }
      })();
      return disposing;
    },
  };
}
