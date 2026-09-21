import type { Box, Detection, FeatureSpace } from '../types';

export interface RgbaImage { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
export interface ReIdDetection { box: Box; score: number; classId: number }
export interface ReIdSource {
  kind: 'modelscope' | 'huggingface'; repository: string; revision: string; path: string;
  downloadUrl: string; bytes: number; sha256: string;
}
export type ReIdOptions = { modelId: 'pplcnet-reid-fp32'; backend: 'wasm' | 'webgpu'; maxDetections?: number } &
  ({ modelBytes: ArrayBuffer; source?: never } | { source?: ReIdSource['kind'] | ReIdSource; modelBytes?: never });
export interface LoadProgress { stage: 'download' | 'cache' | 'integrity' | 'session'; loaded?: number; total?: number; status: 'start' | 'progress' | 'complete' | 'unavailable' | 'miss' }
export interface ReIdLoadOptions { signal?: AbortSignal; onProgress?: (event: LoadProgress) => void }
export interface ReIdRuntimeInfo {
  requestedBackend: 'wasm' | 'webgpu'; actualBackend: 'wasm' | 'webgpu'; executionMode: 'main';
  runtimeVersion: 'web-sdk-pp-tracking@0.2.0-rc.0'; ortVersion: string;
}
export interface ReIdLoadTimings { modelDownloadMs: number; modelCacheReadMs: number; integrityMs: number; sessionMs: number; totalMs: number }
export interface ReIdTimings { decodeMs: number; preprocessMs: number; inferenceMs: number; postprocessMs: number; totalMs: number }
export interface ReIdCacheInfo { status: 'not-applicable' | 'hit' | 'stored' | 'unavailable'; bytes: number }
export interface ReIdLoadResult { runtime: ReIdRuntimeInfo; timings: ReIdLoadTimings; source: { kind: 'bytes' } | Readonly<ReIdSource>; cache: ReIdCacheInfo }
export interface ReIdResult { featureSpace: Readonly<FeatureSpace>; detections: Detection[]; runtime: ReIdRuntimeInfo; timings: ReIdTimings }
export interface ReIdExtractor {
  readonly featureSpace: Readonly<FeatureSpace>;
  load(options?: ReIdLoadOptions): Promise<ReIdLoadResult>;
  extract(input: { image: RgbaImage; detections: readonly ReIdDetection[] }, options?: { signal?: AbortSignal }): Promise<ReIdResult>;
  dispose(): Promise<void>;
}
