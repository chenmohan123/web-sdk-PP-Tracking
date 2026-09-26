import type { Detection } from '../types';

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface YoloxInput {
  image: RgbaImage;
}

export interface PreprocessedYoloxInput {
  tensor: Float32Array;
  scale: number;
  resizedWidth: number;
  resizedHeight: number;
  imageWidth: number;
  imageHeight: number;
}

export interface YoloxOptions {
  modelId: 'yolox-tiny-416-fp32';
  backend: 'wasm' | 'webgpu';
  modelBytes: ArrayBuffer;
  scoreThreshold?: number;
  nmsThreshold?: number;
  maxDetections?: number;
}

export interface LoadProgress {
  stage: 'integrity' | 'session';
  loaded?: number;
  total?: number;
  status: 'start' | 'complete';
}

export interface YoloxLoadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: LoadProgress) => void;
}

export interface YoloxRuntimeInfo {
  requestedBackend: 'wasm' | 'webgpu';
  actualBackend: 'wasm' | 'webgpu';
  executionMode: 'main';
  runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.2';
  ortVersion: string;
}

export interface YoloxLoadTimings {
  modelDownloadMs: number;
  modelCacheReadMs: number;
  integrityMs: number;
  sessionMs: number;
  totalMs: number;
}

export interface YoloxTimings {
  validationMs: number;
  preprocessMs: number;
  inferenceMs: number;
  postprocessMs: number;
  totalMs: number;
}

export interface YoloxCacheInfo {
  status: 'not-applicable';
  bytes: 0;
}

export interface YoloxLoadResult {
  runtime: YoloxRuntimeInfo;
  timings: YoloxLoadTimings;
  source: { kind: 'bytes' };
  cache: YoloxCacheInfo;
}

export interface YoloxDetectorResult {
  generation: number;
  detections: Detection[];
  droppedDetections: number;
  runtime: YoloxRuntimeInfo;
  timings: YoloxTimings;
}

export interface YoloxDetector {
  load(options?: YoloxLoadOptions): Promise<YoloxLoadResult>;
  detect(
    input: YoloxInput,
    options?: { signal?: AbortSignal },
  ): Promise<YoloxDetectorResult>;
  dispose(): Promise<void>;
}
