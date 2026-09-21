import { createTracker } from '/tracking.mjs';
import { createReIdExtractor } from '/reid.mjs';
import { configurations, extractFrame } from './core.mjs';
import { exportMot, withoutTiming } from '../mot17/adapter.mjs';

let extractor, trackers, backend;
export async function start(options) {
  backend = options.backend;
  const ort = await import('onnxruntime-web/all');
  ort.env.wasm.wasmPaths = '/ort/';
  const started = performance.now();
  const response = await fetch('/model.onnx');
  if (!response.ok) throw new Error('本地模型读取失败');
  const bytes = await response.arrayBuffer(), modelFetchMs = performance.now() - started;
  extractor = createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend, maxDetections: 64, modelBytes: bytes });
  const loaded = await extractor.load();
  if (loaded.runtime.actualBackend !== backend) throw new Error('实际后端不匹配');
  const device = backend === 'webgpu' ? await ort.env.webgpu.device : null;
  const adapter = device?.adapterInfo ? { vendor: device.adapterInfo.vendor, architecture: device.adapterInfo.architecture, device: device.adapterInfo.device, description: device.adapterInfo.description, isFallbackAdapter: device.adapterInfo.isFallbackAdapter } : null;
  if (backend === 'webgpu' && adapter?.isFallbackAdapter !== false) throw new Error('必须使用真实WebGPU设备');
  return { loaded, adapter, modelFetchMs, modelLoadOuterMs: performance.now() - started, featureSpace: extractor.featureSpace };
}

export function beginSequence(defaults) {
  for (const tracker of Object.values(trackers ?? {})) tracker.dispose();
  trackers = Object.fromEntries(Object.entries(configurations(defaults, extractor.featureSpace)).map(([name, options]) => [name, createTracker(options)]));
}

export async function processFrame({ input, imagePath, frameNumber }) {
  const benchmarkStarted = performance.now(), outputs = {}, pipelines = {};
  const start = performance.now(), fetchStart = performance.now();
  const response = await fetch('/image/' + imagePath, { cache: 'no-store' });
  if (!response.ok) throw new Error('图片身份校验或读取失败');
  const blob = await response.blob(), imageFetchMs = performance.now() - fetchStart;
  const decodeStart = performance.now(), bitmap = await createImageBitmap(blob);
  let image;
  try {
    if (bitmap.width !== input.imageSize.width || bitmap.height !== input.imageSize.height) throw new Error('图片尺寸与检测序列不一致');
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    image = context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally { bitmap.close(); }
  const imageDecodeMs = performance.now() - decodeStart, extractStart = performance.now();
  const chunks = [];
  const features = await extractFrame(extractor, image, input, [], result => {
    if (result.runtime.actualBackend !== backend) throw new Error('提取实际后端变化');
    chunks.push(result.timings);
  });
  const featureExtractMs = performance.now() - extractStart;
  const result = trackers.deepsort.update(features);
  pipelines.deepsort = { modelExecuted: input.detections.length > 0, imageFetchMs, imageDecodeMs, featureExtractMs, chunks, tracking: result.timings, outerTotalMs: performance.now() - start };
  outputs.deepsort = { result: withoutTiming(result), mot: exportMot(frameNumber, result) };
  // 两个基线在DeepSORT外围计时结束后执行，不分摊模型成本。
  for (const name of ['bytetrack', 'ocsort']) {
    const start = performance.now(), result = trackers[name].update(input);
    pipelines[name] = { modelExecuted: false, outerTotalMs: performance.now() - start, tracking: result.timings };
    outputs[name] = { result: withoutTiming(result), mot: exportMot(frameNumber, result) };
  }
  for (const value of Object.values(outputs)) {
    if (value.result.droppedDetections !== 0 || value.result.runtime.actualBackend !== 'cpu' || value.result.runtime.executionMode !== 'main') throw new Error('跟踪容量或实际运行模式异常');
  }
  return { features, outputs, timings: { pipelines, benchmarkFrameTotalMs: performance.now() - benchmarkStarted } };
}

export async function stop() {
  for (const tracker of Object.values(trackers ?? {})) tracker.dispose();
  await extractor?.dispose();
}
