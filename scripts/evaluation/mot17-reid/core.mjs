import { selectEvaluationMode } from '../mot17/configurations.mjs';
export function validateMerge(runs, names) {
  const seen = new Set();
  for (const run of runs) {
    if (!run.complete || run.subset || run.backend !== 'webgpu' || run.identitySha256 !== runs[0].identitySha256 || JSON.stringify(run.configurations) !== JSON.stringify(runs[0].configurations)) throw new Error('合并运行的范围、身份或参数不匹配');
    for (const [name, sequence] of Object.entries(run.sequences)) {
      if (!names.includes(name) || seen.has(name) || sequence.frames !== sequence.info.length) throw new Error('序列缺失、重复或不完整');
      seen.add(name);
    }
  }
  if (seen.size !== names.length) throw new Error('合并必须包含全部固定序列');
}

export function configurations(defaults, featureSpace) {
  const result = selectEvaluationMode('algorithms', defaults).configurations;
  return { ...result, deepsort: { ...result.ocsort, algorithm: 'deepsort', featureSpace, maxCosineDistance: 0.2, gallerySize: 30 } };
}

export function validateFeatureFrame(features, input, space) {
  if (features.featureSpaceId !== space.id || features.timestampMs !== input.timestampMs ||
    JSON.stringify(features.imageSize) !== JSON.stringify(input.imageSize) || features.detections.length !== input.detections.length) throw new Error('特征帧身份或数量不匹配');
  for (let i = 0; i < input.detections.length; i++) {
    const actual = features.detections[i], expected = input.detections[i];
    if (actual.score !== expected.score || actual.classId !== expected.classId || ['x', 'y', 'width', 'height'].some(k => actual.box[k] !== expected.box[k])) throw new Error(`特征第${i}行错位`);
    if (!actual.embedding || actual.embedding.length !== space.dimension || !Array.from(actual.embedding).every(Number.isFinite)) throw new Error(`特征第${i}行维度或数值无效`);
  }
}

// 任何块失败均不得提交部分检测；空帧也推进所有跟踪器一次。
export async function extractFrame(extractor, image, input, trackers = [], onChunk = () => {}) {
  const detections = [];
  for (let offset = 0; offset < input.detections.length; offset += 64) {
    const batch = input.detections.slice(offset, offset + 64);
    const result = await extractor.extract({ image, detections: batch });
    const chunk = { ...input, featureSpaceId: result.featureSpace.id, detections: result.detections };
    validateFeatureFrame(chunk, { ...input, detections: batch }, extractor.featureSpace);
    detections.push(...result.detections.map(d => ({ ...d, embedding: Array.from(d.embedding) })));
    onChunk(result);
  }
  const features = { ...input, featureSpaceId: extractor.featureSpace.id, detections };
  validateFeatureFrame(features, input, extractor.featureSpace);
  for (const tracker of trackers) tracker.update(features);
  return features;
}
