import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
export const algorithms = ['bytetrack', 'ocsort', 'deepsort'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const safe = (base, path) => {
  const target = resolve(base, path), rel = relative(base, target);
  assert(!rel.startsWith('..') && !isAbsolute(rel), `路径越界：${path}`);
  return target;
};
const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);

export function statistics(values) {
  assert(values.length > 0 && values.every(x => Number.isFinite(x) && x >= 0));
  const sorted = [...values].sort((a,b) => a-b);
  const totalMs = values.reduce((a,b) => a+b, 0);
  return { count: values.length, totalMs, meanMs: totalMs / values.length,
    p50Ms: sorted[Math.floor((sorted.length-1)*.5)], p95Ms: sorted[Math.ceil((sorted.length-1)*.95)] };
}

// cold 为每段首帧；warm 为该段其余帧。分位数直接取全部逐帧样本，绝不拼接阶段分位数。
export function summarize(records) {
  const series = {};
  const push = (key, value, cold) => {
    const bucket = series[key] ??= { all: [], cold: [], warm: [] };
    bucket.all.push(value); bucket[cold ? 'cold' : 'warm'].push(value);
  };
  for (const record of records) {
    record.browser.forEach((row, index) => {
      assert.equal(row.frameNumber, index+1);
      for (const algorithm of algorithms) {
        const pipeline = row.pipelines[algorithm];
        push(`browser.${algorithm}.outerTotalMs`, pipeline.outerTotalMs, index === 0);
        for (const [field,value] of Object.entries(pipeline.tracking)) push(`browser.${algorithm}.tracking.${field}`, value, index === 0);
        assert.equal(pipeline.modelExecuted, algorithm === 'deepsort');
      }
      for (const field of ['imageFetchMs','imageDecodeMs','featureExtractMs']) push(`browser.deepsort.${field}`, row.pipelines.deepsort[field], index === 0);
      for (const field of ['decodeMs','preprocessMs','inferenceMs','postprocessMs','totalMs']) {
        push(`browser.deepsort.chunks.${field}`, row.pipelines.deepsort.chunks.reduce((n,c) => n+c[field],0), index === 0);
      }
      push('browser.benchmarkFrameTotalMs', row.benchmarkFrameTotalMs, index === 0);
    });
    for (const algorithm of algorithms) record.node[algorithm].forEach((rows, repetition) => {
      assert.equal(rows.length, record.browser.length);
      rows.forEach((row,index) => {
        for (const [field,value] of Object.entries(row)) push(`node.${repetition+1}.${algorithm}.${field}`, value, index === 0);
      });
    });
  }
  return Object.fromEntries(Object.entries(series).map(([key,buckets]) => [key,
    Object.fromEntries(Object.entries(buckets).map(([kind,values]) => [kind, statistics(values)]))]));
}

export async function verify() {
  const args = process.argv.slice(2);
  assert(args.every(x => x === '--current'), '仅支持可选 --current');
  const lock = await json(resolve(here, 'evidence.lock.json'));
  for (const [path, entry] of Object.entries(lock.files)) {
    const bytes = await readFile(safe(here,path));
    assert.equal(bytes.length, entry.bytes, `字节数：${path}`);
    assert.equal(sha256(bytes), entry.sha256, `SHA256：${path}`);
  }
  const identityBytes = await readFile(resolve(here,'raw/identity.json'));
  const identity = JSON.parse(identityBytes);
  const original = await json(resolve(here,'raw/summary.json'));
  // 正式run/merge的identitySha256绑定紧凑JSON；归档文件字节另由证据锁绑定。
  assert.equal(sha256(JSON.stringify(identity)), original.identitySha256);
  assert.equal(sha256(await readFile(resolve(here,'media.lock.json'))), identity.mediaLockSha256);
  if (args.includes('--current')) for (const [path,hash] of Object.entries(identity.files)) {
    assert.equal(sha256(await readFile(safe(root,path))),hash,`当前实现/构建身份：${path}`);
  }
  const metrics = await json(resolve(here,'raw/metrics.json'));
  const records = JSON.parse(gunzipSync(await readFile(resolve(here,'timings.json.gz'))));
  const summary = await json(resolve(here,'summary.json'));
  assert.equal(original.complete,true); assert.equal(original.subset,false);
  assert.equal(original.backend,'webgpu');
  assert.equal(records.length,7);
  assert.equal(records.reduce((n,r) => n+r.browser.length,0),5316);
  assert.equal(Object.values(original.sequences).reduce((n,r) => n+r.detections,0),67639);
  assert.deepEqual(summary.timings, summarize(records));
  for (const record of records) {
    const s = original.sequences[record.sequence];
    assert(s); assert.equal(record.browser.length,s.frames); assert.equal(s.droppedDetections,0);
    assert.equal(s.browserLoad.loaded.runtime.actualBackend,'webgpu');
    assert.equal(s.browserLoad.adapter.isFallbackAdapter,false);
    for (const algorithm of algorithms) {
      const node = s.node[algorithm];
      assert.equal(node[0].motSha256,node[1].motSha256);
      assert.equal(node[0].nonTimingSha256,node[1].nonTimingSha256);
      assert(node.every(n => n.browserEqual));
      const bs = statistics(record.browser.map(r => r.pipelines[algorithm].outerTotalMs));
      near(bs.totalMs,s.browser[algorithm].outerTotalMs,'浏览器外围累计');
      near(bs.p50Ms,s.browser[algorithm].p50Ms,'浏览器p50');
      near(bs.p95Ms,s.browser[algorithm].p95Ms,'浏览器p95');
      record.node[algorithm].forEach((rows,i) => {
        const ns = statistics(rows.map(r => r.totalMs));
        near(ns.totalMs,node[i].sdkTotalMs,'Node累计');
        near(ns.p50Ms,node[i].p50Ms,'Node p50'); near(ns.p95Ms,node[i].p95Ms,'Node p95');
      });
    }
  }
  assert.deepEqual(summary.metrics,Object.fromEntries(algorithms.map(a => [a,metrics[a].combined])));
  for (const algorithm of algorithms) {
    const { sequences, combined } = metrics[algorithm];
    assert.deepEqual(Object.keys(sequences).sort(), records.map(r => r.sequence).sort());
    for (const key of ['IDSW','FP','FN','TP','GT','Frag','IDTP','IDFP','IDFN']) {
      assert.equal(combined[key],Object.values(sequences).reduce((n,s) => n+s[key],0),`${algorithm}.${key}`);
    }
    for (const s of [...Object.values(sequences),combined]) {
      near(s.IDF1,2*s.IDTP/(2*s.IDTP+s.IDFP+s.IDFN),'IDF1公式');
      near(s.MOTA,1-(s.FN+s.FP+s.IDSW)/s.GT,'MOTA公式');
      assert.equal(s.TP+s.FN,s.GT);
    }
  }
  assert.deepEqual(summary.modelLoads,Object.fromEntries(Object.entries(original.sequences).map(([name,s]) => [name,s.browserLoad])));
  console.log(`通过：${Object.keys(lock.files).length}份归档SHA256、5316帧计时/cold/warm/分位数、三算法逐段与官方合计公式${args.includes('--current') ? '、当前实现/构建身份' : ''}。未重新运行TrackEval、模型或跟踪器。`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verify();
