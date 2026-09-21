import { afterEach, describe, expect, it, vi } from 'vitest';
import * as reid from '../src/reid/index';
import type { ReIdOptions, ReIdSource } from '../src/reid/types';

const options = { modelId: 'pplcnet-reid-fp32', backend: 'wasm' } as const;
const bytes = 33_704_835;
const sha256 = '24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4';

afterEach(() => vi.unstubAllGlobals());

describe('ReID 公开来源选择', () => {
  it('查询默认 ModelScope，两个来源固定同一模型身份', () => {
    expect(reid.getReIdModelSource().kind).toBe('modelscope');
    for (const kind of ['modelscope', 'huggingface'] as const) {
      const source = reid.getReIdModelSource(kind);
      expect(source).toMatchObject({ kind, bytes, sha256 });
      expect(source.revision).toMatch(/^[a-f\d]{40,64}$/i);
      expect(new URL(source.downloadUrl).protocol).toBe('https:');
    }
  });

  it('来源查询快照改写不会污染后续来源和工厂', async () => {
    const source = reid.getReIdModelSource();
    const original = { ...source };
    Reflect.set(source, 'downloadUrl', 'https://invalid.example/model.onnx');
    expect(reid.getReIdModelSource()).toEqual(original);
    expect(reid.getReIdModelSource()).not.toBe(source);
    const extractor = reid.createReIdExtractor(options);
    expect(extractor.featureSpace.id).toContain(sha256);
    await extractor.dispose();
  });

  it.each([undefined, 'modelscope', 'huggingface'] as const)('工厂来源 %s 只请求对应来源，不静默换源', async kind => {
    const expected = reid.getReIdModelSource(kind);
    const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('caches', undefined);
    const extractor = reid.createReIdExtractor({ ...options, ...(kind ? { source: kind } : {}) });
    await expect(extractor.load()).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(expected.downloadUrl);
    await extractor.dispose();
  });

  it('未知来源查询与工厂同步拒绝', () => {
    expect(() => reid.getReIdModelSource('unknown' as 'modelscope')).toThrowError(expect.objectContaining({ code: 'INVALID_MANIFEST' }));
    expect(() => reid.createReIdExtractor({ ...options, source: 'unknown' } as unknown as ReIdOptions)).toThrowError(expect.objectContaining({ code: 'INVALID_MANIFEST' }));
  });

  it('本地字节独立可用且仍与字符串或显式来源互斥', async () => {
    const modelBytes = new ArrayBuffer(bytes);
    const extractor = reid.createReIdExtractor({ ...options, modelBytes });
    await extractor.dispose();
    for (const source of ['modelscope', 'huggingface', reid.getReIdModelSource()] as const) {
      expect(() => reid.createReIdExtractor({ ...options, modelBytes, source } as unknown as ReIdOptions)).toThrowError(expect.objectContaining({ code: 'INVALID_MANIFEST' }));
    }
  });

  it('既有显式来源保留并在工厂入口复制', async () => {
    const source: ReIdSource = { ...reid.getReIdModelSource(), repository: 'custom/model', path: 'model.onnx', downloadUrl: 'https://custom.example/model.onnx' };
    const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('caches', undefined);
    const extractor = reid.createReIdExtractor({ ...options, source });
    source.downloadUrl = 'https://changed.example/model.onnx';
    await expect(extractor.load()).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
    expect(fetch.mock.calls[0][0]).toBe('https://custom.example/model.onnx');
    await extractor.dispose();
  });
});
