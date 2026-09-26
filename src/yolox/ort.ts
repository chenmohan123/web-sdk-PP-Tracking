import type * as Ort from 'onnxruntime-web/all';
import { aborted, safeError, YoloxError } from './errors';
import { INPUT_NAME, OUTPUT_NAME } from './model';
import type { YoloxRuntimeInfo } from './types';

export interface LoadedSession {
  session: Ort.InferenceSession;
  ort: typeof Ort;
  runtime: YoloxRuntimeInfo;
}

export async function createSession(
  bytes: ArrayBuffer,
  backend: 'wasm' | 'webgpu',
  signal: AbortSignal,
): Promise<LoadedSession> {
  let session: Ort.InferenceSession | undefined;
  try {
    aborted(signal);
    if (
      backend === 'webgpu' &&
      (typeof navigator === 'undefined' || !('gpu' in navigator))
    ) {
      throw new YoloxError(
        'UNSUPPORTED_BACKEND',
        '当前环境没有 WebGPU',
      );
    }

    const ort = await import('onnxruntime-web/all');
    aborted(signal);
    if (ort.env.versions.web !== '1.27.0') {
      throw new YoloxError(
        'SESSION_FAILED',
        '候选模块需要 ORT Web 1.27.0',
      );
    }
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;

    session = await ort.InferenceSession.create(bytes, {
      executionProviders: [backend],
      graphOptimizationLevel: 'basic',
      ...(backend === 'webgpu'
        ? {
            extra: {
              session: { disable_cpu_ep_fallback: '1' },
            },
          }
        : {}),
    });
    aborted(signal);

    if (
      session.inputNames.length !== 1 ||
      session.inputNames[0] !== INPUT_NAME ||
      session.outputNames.length !== 1 ||
      session.outputNames[0] !== OUTPUT_NAME
    ) {
      throw new YoloxError(
        'SESSION_FAILED',
        '模型会话输入输出名称不匹配',
      );
    }

    return {
      session,
      ort,
      runtime: {
        requestedBackend: backend,
        actualBackend: backend,
        executionMode: 'main',
        runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.2',
        ortVersion: ort.env.versions.web,
      },
    };
  } catch (error) {
    if (session) {
      await session.release().catch(() => undefined);
    }
    aborted(signal);
    throw safeError(error, 'SESSION_FAILED');
  }
}
