import { aborted, ReIdError, safeError } from './errors';
import { MODEL_BYTES, MODEL_SHA256 } from './model';
import type { LoadProgress, ReIdCacheInfo, ReIdLoadTimings, ReIdSource } from './types';

const CACHE_NAME = 'web-sdk-pp-tracking-reid-v1';
const CACHE_PREFIX = 'web-sdk-pp-tracking-reid-';
const CACHE_KEY = `https://web-sdk-pp-tracking.invalid/reid/v1/${MODEL_SHA256}`;
type Notify = (event: LoadProgress) => void;
const clock = () => performance.now();

async function readBounded(response: Response, signal: AbortSignal, notify?: Notify): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new ReIdError('INTEGRITY_FAILED', '模型响应没有可读取的字节');
  let complete = false;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    aborted(signal);
    // fetch 返回解压后的正文，传输长度可能不同，且跨源时编码头可能不可见。
    // 只以实际读取的明文字节硬上限、最终长度和随后 SHA 校验确认资产身份。
    const bytes = new Uint8Array(MODEL_BYTES);
    let offset = 0;
    while (true) {
      aborted(signal);
      const part = await reader.read();
      aborted(signal);
      if (part.done) break;
      if (offset + part.value.byteLength > MODEL_BYTES) throw new ReIdError('INTEGRITY_FAILED', '模型响应超过字节硬上限');
      bytes.set(part.value, offset); offset += part.value.byteLength;
      notify?.({ stage: 'download', status: 'progress', loaded: offset, total: MODEL_BYTES });
    }
    if (offset !== MODEL_BYTES) throw new ReIdError('INTEGRITY_FAILED', '模型实际字节数不匹配');
    complete = true;
    return bytes.buffer;
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function verifyBytes(bytes: ArrayBuffer, signal: AbortSignal, notify: Notify, timings: ReIdLoadTimings): Promise<void> {
  aborted(signal);
  const start = clock();
  notify({ stage: 'integrity', status: 'start', total: MODEL_BYTES });
  try {
    if (bytes.byteLength !== MODEL_BYTES) throw new ReIdError('INTEGRITY_FAILED', '模型实际字节数不匹配');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    aborted(signal);
    if (Array.from(hash, value => value.toString(16).padStart(2, '0')).join('') !== MODEL_SHA256) throw new ReIdError('INTEGRITY_FAILED', '模型 SHA-256 不匹配');
    notify({ stage: 'integrity', status: 'complete', loaded: MODEL_BYTES, total: MODEL_BYTES });
    aborted(signal);
  } finally { timings.integrityMs += clock() - start; }
}

export async function acquireModel(source: Readonly<ReIdSource>, signal: AbortSignal, notify: Notify, timings: ReIdLoadTimings): Promise<{ bytes: ArrayBuffer; cache: ReIdCacheInfo }> {
  let cache: Cache | undefined;
  let response: Response | undefined;
  const cacheStart = clock();
  notify({ stage: 'cache', status: 'start' });
  try {
    if (typeof caches !== 'undefined') { cache = await caches.open(CACHE_NAME); response = await cache.match(CACHE_KEY); }
  } catch { cache = undefined; }
  finally { timings.modelCacheReadMs += clock() - cacheStart; }
  if (response) {
    let bytes: ArrayBuffer;
    const readStart = clock();
    try { bytes = await readBounded(response, signal); }
    catch (error) {
      if (error instanceof ReIdError && error.code === 'INTEGRITY_FAILED') await cache!.delete(CACHE_KEY).catch(() => false);
      throw error;
    } finally { timings.modelCacheReadMs += clock() - readStart; }
    try { await verifyBytes(bytes, signal, notify, timings); }
    catch (error) {
      if (error instanceof ReIdError && error.code === 'INTEGRITY_FAILED') await cache!.delete(CACHE_KEY).catch(() => false);
      throw error;
    }
    notify({ stage: 'cache', status: 'complete', loaded: MODEL_BYTES, total: MODEL_BYTES });
    return { bytes, cache: { status: 'hit', bytes: MODEL_BYTES } };
  }
  aborted(signal);
  notify({ stage: 'cache', status: cache ? 'miss' : 'unavailable' });
  const downloadStart = clock();
  let bytes: ArrayBuffer;
  try {
    aborted(signal); notify({ stage: 'download', status: 'start', loaded: 0, total: MODEL_BYTES }); aborted(signal);
    const downloaded = await fetch(source.downloadUrl, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!downloaded.ok) { await downloaded.body?.cancel().catch(() => undefined); throw new ReIdError('DOWNLOAD_FAILED', '当前来源返回非成功状态'); }
    bytes = await readBounded(downloaded, signal, notify);
    notify({ stage: 'download', status: 'complete', loaded: MODEL_BYTES, total: MODEL_BYTES });
  } catch (error) { aborted(signal); throw safeError(error, 'DOWNLOAD_FAILED'); }
  finally { timings.modelDownloadMs += clock() - downloadStart; }
  await verifyBytes(bytes, signal, notify, timings);
  let status: ReIdCacheInfo['status'] = 'unavailable';
  if (cache) {
    aborted(signal);
    try { await cache.put(CACHE_KEY, new Response(bytes)); status = 'stored'; }
    catch { notify({ stage: 'cache', status: 'unavailable' }); }
  }
  aborted(signal);
  return { bytes, cache: { status, bytes: status === 'stored' ? MODEL_BYTES : 0 } };
}

export async function clearReIdCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
}
export async function estimateReIdCache(): Promise<{ bytes: number; entries: number }> {
  const result = { bytes: 0, entries: 0 };
  if (typeof caches === 'undefined') return result;
  for (const name of await caches.keys()) {
    if (!name.startsWith(CACHE_PREFIX)) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (!response) continue;
      const reader = response.body?.getReader();
      if (reader) {
        try { while (true) { const part = await reader.read(); if (part.done) break; result.bytes += part.value.byteLength; } }
        finally { reader.releaseLock(); }
      }
      result.entries++;
    }
  }
  return result;
}
