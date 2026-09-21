import { createTracker, type Tracker, type TrackingResult } from 'web-sdk-pp-tracking';
import type { LoadProgress, ReIdDetection, ReIdExtractor, ReIdLoadResult, ReIdResult, RgbaImage } from 'web-sdk-pp-tracking/reid';

type Source = 'modelscope' | 'huggingface';
type Backend = 'wasm' | 'webgpu';
type Dependencies = { create: (source: Source, backend: Backend) => ReIdExtractor; clear: () => Promise<void> };

export class ReIdController {
  source: Source = 'modelscope';
  backend: Backend = 'wasm';
  busy = false;
  frameCount = 0;
  tracking: TrackingResult | null = null;
  model: ReIdResult | null = null;
  loadResult: ReIdLoadResult | null = null;
  progress: LoadProgress | null = null;
  private extractor: ReIdExtractor | null = null;
  private tracker: Tracker | null = null;
  private size: { width: number; height: number } | null = null;
  private abort: AbortController | null = null;
  private active: Promise<void> | null = null;
  private transition: Promise<void> | null = null;
  private disposed = false;
  constructor(private dependencies: Dependencies, private changed = () => {}) {}
  async run(image: RgbaImage, detections: ReIdDetection[]) {
    if (this.disposed) throw new Error('DISPOSED');
    if (this.busy) throw new Error('BUSY');
    if (this.size && (this.size.width !== image.width || this.size.height !== image.height)) throw new Error('IMAGE_SIZE_CHANGED');
    this.busy = true;
    const abort = this.abort = new AbortController();
    this.changed();
    const task = (async () => {
      try {
        const extractor = this.extractor ??= this.dependencies.create(this.source, this.backend);
        this.loadResult = await extractor.load({ signal: abort.signal, onProgress: progress => {
          if (!abort.signal.aborted) { this.progress = progress; this.changed(); }
        } });
        if (abort.signal.aborted) return;
        const model = await extractor.extract({ image, detections }, { signal: abort.signal });
        if (abort.signal.aborted) return;
        const tracker = this.tracker ??= createTracker({ algorithm: 'deepsort', featureSpace: extractor.featureSpace });
        const tracking = tracker.update({ imageSize: { width: image.width, height: image.height }, timestampMs: this.frameCount * 100, detections: model.detections, featureSpaceId: model.featureSpace.id });
        this.model = model; this.tracking = tracking; this.frameCount++;
        this.size = { width: image.width, height: image.height };
      } catch (error) { if (!abort.signal.aborted) throw error; }
      finally { this.abort = null; if (!this.transition) this.busy = false; this.changed(); }
    })();
    this.active = task;
    try { await task; } finally { if (this.active === task) this.active = null; }
  }
  cancel() { this.abort?.abort(); }
  private clearState() {
    this.tracker?.reset(); this.tracking = null; this.model = null; this.frameCount = 0; this.size = null; this.progress = null;
  }
  private async stop(release: boolean, after?: () => Promise<void>) {
    if (this.transition) throw new Error('BUSY');
    this.cancel(); this.busy = true; this.changed();
    const task = (async () => {
      await this.active?.catch(() => {});
      try {
        if (release) { const old = this.extractor; this.extractor = null; await old?.dispose(); this.loadResult = null; }
        this.clearState();
        await after?.();
      } finally { this.busy = false; this.changed(); }
    })();
    this.transition = task;
    try { await task; } finally { this.transition = null; }
  }
  async configure(source: Source, backend: Backend) {
    await this.stop(true, async () => { this.source = source; this.backend = backend; });
  }
  async clear() { await this.stop(true, this.dependencies.clear); }
  async reset() { await this.stop(false); }
  async dispose() {
    this.disposed = true; this.cancel();
    await this.transition?.catch(() => {});
    await this.stop(true); this.tracker?.dispose(); this.tracker = null;
  }
}

type Decoded = { image: RgbaImage; close: () => void };
type ImageDependencies = { decode: (file: File) => Promise<Decoded>; url: (file: File) => string; revoke: (url: string) => void };
export class ImageSelection {
  current: (Decoded & { url: string }) | null = null;
  private revision = 0;
  constructor(private dependencies: ImageDependencies) {}
  async select(file: File) {
    const revision = ++this.revision;
    if (file.size > 20 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
    const url = this.dependencies.url(file);
    let decoded: Decoded | undefined;
    try {
      decoded = await this.dependencies.decode(file);
      if (revision !== this.revision) return false;
      validateImageSize(decoded.image.width, decoded.image.height);
      this.release(); this.current = { ...decoded, url }; decoded = undefined;
      return true;
    } finally {
      decoded?.close();
      if (this.current?.url !== url) this.dependencies.revoke(url);
    }
  }
  private release() { this.current?.close(); if (this.current) this.dependencies.revoke(this.current.url); this.current = null; }
  cancel() { this.revision++; }
  dispose() { this.cancel(); this.release(); }
}

export function validateImageSize(width: number, height: number) {
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16777216) throw new Error('IMAGE_TOO_LARGE');
}

export async function decodeImage(file: File): Promise<Decoded> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'default' });
  try {
    validateImageSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
    if (!context) throw new Error('DECODE_FAILED');
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height, { colorSpace: 'srgb' });
    return { image, close: () => { canvas.width = 0; canvas.height = 0; } };
  } finally { bitmap.close(); }
}
