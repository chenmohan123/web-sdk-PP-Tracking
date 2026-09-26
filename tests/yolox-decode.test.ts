import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeYolox } from '../src/yolox/decode';
import type { PreprocessedYoloxInput } from '../src/yolox/types';

const anchors = 3549;
const channels = 85;

function output(): Float32Array {
  return new Float32Array(anchors * channels);
}

function setAnchor(
  values: Float32Array,
  index: number,
  options: {
    dx?: number;
    dy?: number;
    dw?: number;
    dh?: number;
    objectness: number;
    person: number;
    otherClass?: number;
  },
): void {
  const offset = index * channels;
  values[offset] = options.dx ?? 0;
  values[offset + 1] = options.dy ?? 0;
  values[offset + 2] = options.dw ?? 0;
  values[offset + 3] = options.dh ?? 0;
  values[offset + 4] = options.objectness;
  values[offset + 5] = options.person;
  values[offset + 6] = options.otherClass ?? 0;
}

function metadata(
  overrides: Partial<PreprocessedYoloxInput> = {},
): PreprocessedYoloxInput {
  return {
    tensor: new Float32Array(3 * 416 * 416),
    scale: 2,
    resizedWidth: 200,
    resizedHeight: 200,
    imageWidth: 100,
    imageHeight: 100,
    ...overrides,
  };
}

const options = {
  scoreThreshold: 0.1,
  nmsThreshold: 0.7,
  maxDetections: 100,
};

describe('YOLOX 解码', () => {
  it('按 stride 层级和行主序解码并逆映射裁剪到原图', () => {
    const values = output();

    setAnchor(values, 53, {
      dx: 0.5,
      dy: 0.25,
      dw: Math.log(2),
      dh: Math.log(3),
      objectness: 0.8,
      person: 0.5,
    });
    setAnchor(values, 2704 + 54, {
      dx: 1,
      dy: 1,
      objectness: 0.7,
      person: 0.5,
    });
    setAnchor(values, 2704 + 676 + 28, {
      dx: 2,
      dy: 2,
      objectness: 0.6,
      person: 0.5,
    });

    const result = decodeYolox(values, metadata(), options);

    expect(result.droppedDetections).toBe(0);
    expect(result.detections).toHaveLength(3);
    expect(result.detections[0].classId).toBe(1);
    expect(result.detections[0].box.x).toBeCloseTo(2);
    expect(result.detections[0].box.y).toBeCloseTo(0);
    expect(result.detections[0].box.width).toBeCloseTo(8);
    expect(result.detections[0].box.height).toBeCloseTo(11);
    expect(result.detections[0].score).toBeCloseTo(0.4);
    expect(result.detections[1].classId).toBe(1);
    expect(result.detections[1].box.x).toBeCloseTo(20);
    expect(result.detections[1].box.y).toBeCloseTo(20);
    expect(result.detections[1].box.width).toBeCloseTo(8);
    expect(result.detections[1].box.height).toBeCloseTo(8);
    expect(result.detections[1].score).toBeCloseTo(0.35);
    expect(result.detections[2].classId).toBe(1);
    expect(result.detections[2].box.x).toBeCloseTo(56);
    expect(result.detections[2].box.y).toBeCloseTo(56);
    expect(result.detections[2].box.width).toBeCloseTo(16);
    expect(result.detections[2].box.height).toBeCloseTo(16);
    expect(result.detections[2].score).toBeCloseTo(0.3);
  });

  it('直接使用图内 sigmoid 值且只读取 person 通道', () => {
    const values = output();

    setAnchor(values, 0, {
      objectness: 0.5,
      person: 0.5,
      otherClass: 1,
    });

    const result = decodeYolox(values, metadata(), {
      ...options,
      scoreThreshold: 0.3,
    });

    expect(result).toEqual({
      detections: [],
      droppedDetections: 0,
    });
  });

  function loadForwardFixture() {
    const fixture = JSON.parse(
      readFileSync(new URL('./fixtures/yolox-forward.json', import.meta.url), 'utf8'),
    ) as {
      decode: {
        letterbox: { scale: number; resizedWidth: number; resizedHeight: number };
        originalImageSize: { width: number; height: number };
        scoreThreshold: number;
        nmsThreshold: number;
        maxDetections: number;
        sdkClassId: number;
      };
      rawOutput: { base64: string; bytes: number; elements: number };
      expected: { detections: unknown[]; droppedDetections: number };
    };
    const bytes = Buffer.from(fixture.rawOutput.base64, 'base64');
    expect(bytes.byteLength).toBe(fixture.rawOutput.bytes);
    return {
      fixture,
      values: new Float32Array(bytes.buffer, bytes.byteOffset, fixture.rawOutput.elements),
      frame: metadata({
        scale: fixture.decode.letterbox.scale,
        resizedWidth: fixture.decode.letterbox.resizedWidth,
        resizedHeight: fixture.decode.letterbox.resizedHeight,
        imageWidth: fixture.decode.originalImageSize.width,
        imageHeight: fixture.decode.originalImageSize.height,
      }),
    };
  }

  // 该真实 Python 输出在候选默认阈值 0.1 下期望集为空，因此空对空断言之外必须另测有框路径。
  it('零阈值下必须从真实 Python 张量解出非空且有序的 person 框', () => {
    const { fixture, values, frame } = loadForwardFixture();
    const result = decodeYolox(values, frame, {
      scoreThreshold: 0,
      nmsThreshold: fixture.decode.nmsThreshold,
      maxDetections: fixture.decode.maxDetections,
    });

    expect(result.detections.length).toBeGreaterThan(0);
    expect(result.detections.length).toBeLessThanOrEqual(fixture.decode.maxDetections);
    let previousScore = 1;
    for (const detection of result.detections) {
      expect(detection.classId).toBe(fixture.decode.sdkClassId);
      expect(detection.score).toBeLessThanOrEqual(previousScore);
      previousScore = detection.score;
      const { x, y, width, height } = detection.box;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      // 精确包含（无容差）：生产端保证 x+width 不超过边界，故消费端不得改用减法形式判定。
      expect(x + width).toBeLessThanOrEqual(fixture.decode.originalImageSize.width);
      expect(y + height).toBeLessThanOrEqual(fixture.decode.originalImageSize.height);
    }
  });

  it('候选默认阈值下真实 Python 张量的解码结果与 Python 期望一致', () => {
    const { fixture, values, frame } = loadForwardFixture();
    const result = decodeYolox(values, frame, {
      scoreThreshold: fixture.decode.scoreThreshold,
      nmsThreshold: fixture.decode.nmsThreshold,
      maxDetections: fixture.decode.maxDetections,
    });

    expect(result).toEqual({
      detections: fixture.expected.detections,
      droppedDetections: fixture.expected.droppedDetections,
    });
    expect(fixture.expected.detections).toEqual([]);
  });

  it('拒绝错误输出长度、非有限值和无效元数据', () => {
    expect(() =>
      decodeYolox(
        new Float32Array(anchors * channels - 1),
        metadata(),
        options,
      ),
    ).toThrow();

    const values = output();
    values[4] = Number.NaN;

    expect(() =>
      decodeYolox(values, metadata(), options),
    ).toThrow();
    expect(() =>
      decodeYolox(
        output(),
        metadata({ scale: 0 }),
        options,
      ),
    ).toThrow();
  });
});
