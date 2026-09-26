import {
  serializeYoloxDetections,
  serializeYoloxDetectionsUnordered,
} from './yolox-serialization.mjs';

export const SAMPLE_COUNT = 5;
export const FIXTURE_WIDTH = 320;
export const FIXTURE_HEIGHT = 240;

// 单帧运行时证据为零阈值，用于覆盖 decode、过滤与 NMS 分支。
export const DETECTOR_OPTIONS = {
  scoreThreshold: 0,
  nmsThreshold: 0.7,
  maxDetections: 100,
};

// 候选默认值取自 src/yolox/model.ts 的 ?? 兜底；两端显式传入同一组值，避免依赖隐式默认。
export const CANDIDATE_DEFAULT_DETECTOR_OPTIONS = {
  scoreThreshold: 0.1,
  nmsThreshold: 0.7,
  maxDetections: 100,
};

export const SEQUENCE_FRAME_COUNT = 7;
export const SEQUENCE_VARIANTS = [
  {
    id: 'candidate-default-threshold',
    purpose: '候选默认阈值下真实 YOLOX 对合成色块零检出，只覆盖空检测调用契约',
    detectorOptions: CANDIDATE_DEFAULT_DETECTOR_OPTIONS,
    hashing: 'ordered',
    detectsRealBoxes: false,
  },
  {
    id: 'zero-threshold-coverage',
    purpose: '零阈值让真实检测框进入跟踪通路；噪声区 topK 边界是 1e-10 级近平局，故按多集合哈希比较',
    detectorOptions: DETECTOR_OPTIONS,
    hashing: 'unordered-bag',
    detectsRealBoxes: true,
  },
];

export const SEQUENCE_SERIALIZERS = {
  ordered: serializeYoloxDetections,
  'unordered-bag': serializeYoloxDetectionsUnordered,
};

export const TRACKER_OPTIONS = {};

// 两端各自 import 本模块并核对对方写入证据的配置，避免浏览器直接采信 Node 的结果文件。
export const sequenceContract = () => ({
  sampleCount: SAMPLE_COUNT,
  fixtureWidth: FIXTURE_WIDTH,
  fixtureHeight: FIXTURE_HEIGHT,
  detectorOptions: DETECTOR_OPTIONS,
  sequenceFrameCount: SEQUENCE_FRAME_COUNT,
  sequenceVariants: SEQUENCE_VARIANTS.map(variant => ({
    id: variant.id,
    hashing: variant.hashing,
    detectorOptions: variant.detectorOptions,
    detectsRealBoxes: variant.detectsRealBoxes,
  })),
  trackerOptions: TRACKER_OPTIONS,
});
