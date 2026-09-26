import { describe, expect, it, vi } from 'vitest';
import packageJson from '../package.json';
import model from '../models/yolox-tiny/0.1.0/model.json';
import sources from '../models/yolox-tiny/0.1.0/sources.json';
import { createYoloxDetector } from '../src/yolox/index';
import type { YoloxOptions } from '../src/yolox/types';

const MODEL_BYTES = 20_258_925;

function baseOptions() {
  return {
    modelId: 'yolox-tiny-416-fp32',
    backend: 'wasm',
  } as const;
}

describe('YOLOX 候选来源边界', () => {
  it('模型注册固定已验证身份且分发仍待授权', () => {
    expect(model).toMatchObject({
      id: 'yolox-tiny-416-fp32',
      bytes: MODEL_BYTES,
      sha256:
        '2e99f041301698ff4a9e898aa1efb4bcdd503d46f5c5c1829be17af9b7adfab6',
      input: { name: 'images', shape: [1, 3, 416, 416] },
      output: { name: 'output', shape: [1, 3_549, 85] },
      distributionStatus: 'pending-authorization',
    });
    expect(sources).toMatchObject({
      status: 'pending-authorization',
      distributions: [],
    });
  });

  it('无授权分发时必须显式提供固定长度 modelBytes', () => {
    expect(() => createYoloxDetector(
      baseOptions() as unknown as YoloxOptions,
    )).toThrowError(expect.objectContaining({
      code: 'INVALID_MANIFEST',
    }));

    expect(() => createYoloxDetector({
      ...baseOptions(),
      modelBytes: new ArrayBuffer(MODEL_BYTES - 1),
    })).toThrowError(expect.objectContaining({
      code: 'INVALID_INPUT',
    }));
  });

  it('字符串或自定义远程来源均拒绝且不触发 fetch', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    for (const source of [
      'modelscope',
      'huggingface',
      {
        kind: 'modelscope',
        downloadUrl: 'https://example.test/model.onnx',
      },
    ]) {
      expect(() => createYoloxDetector({
        ...baseOptions(),
        source,
      } as unknown as YoloxOptions)).toThrowError(
        expect.objectContaining({ code: 'INVALID_MANIFEST' }),
      );
    }

    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('modelBytes 与来源组合仍同步拒绝', () => {
    expect(() => createYoloxDetector({
      ...baseOptions(),
      modelBytes: new ArrayBuffer(MODEL_BYTES),
      source: 'modelscope',
    } as unknown as YoloxOptions)).toThrowError(
      expect.objectContaining({ code: 'INVALID_MANIFEST' }),
    );
  });

  it('候选入口不进入正式 package exports', () => {
    expect(packageJson.exports).not.toHaveProperty('./yolox');
    expect(Object.keys(packageJson.exports)).toEqual([
      '.',
      './reid',
      './motion',
    ]);
  });
});
