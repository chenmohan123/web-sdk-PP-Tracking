import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { crc32 } from 'node:zlib';
import { newOutput, verifyFile, sha256, hashFile, readJson, save } from './io.mjs';
import { configurations, validateFeatureFrame } from './core.mjs';
import { parseSequenceInfo, adaptDetections, exportMot, withoutTiming } from '../mot17/adapter.mjs';

const root = await fs.realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const { values } = parseArgs({ options: Object.fromEntries(['input', 'images', 'model', 'python', 'trackeval', 'out', 'sequence', 'limit', 'backend'].map(key => [key, { type: 'string' }])), strict: true });
const backend = values.backend ?? 'webgpu';
if (!['webgpu', 'wasm'].includes(backend)) throw new Error('未知后端');
const subset = values.limit !== undefined;
if ((subset && (values.limit !== '30' || values.sequence !== 'MOT17-02-FRCNN')) || (backend === 'wasm' && !subset)) throw new Error('补充验证只允许固定02前30帧');
if (!values.out) throw new Error('必须指定新的 --out');
const out = await newOutput(root, path.resolve(values.out));
for (const key of ['input', 'images', 'model', 'python', 'trackeval']) if (!values[key]) throw new Error(`缺少 --${key}`);
const inputRoot = path.resolve(values.input), images = path.resolve(values.images);
const lock = await readJson(path.join(root, 'scripts/evaluation/mot17/lock.json'));
const selected = values.sequence ? [values.sequence] : lock.dataset.sequences;
if (selected.some(s => !lock.dataset.sequences.includes(s))) throw new Error('未知固定序列');
const model = await readJson(path.join(root, 'models/pplcnet-reid/0.1.0/model.json'));
const modelBytes = await verifyFile(path.resolve(values.model), model);
const reference = await readJson(path.join(root, 'reports/2026-09-19-mot17/summary.json'));
assert.deepEqual(reference.dataset, lock.dataset);
const mediaFile = path.join(images, '../media.lock.json');
const archivedMedia = await fs.readFile(path.join(root, 'reports/2026-09-21-mot-reid/media.lock.json'));
const media = JSON.parse((await verifyFile(mediaFile, { bytes: archivedMedia.length, sha256: sha256(archivedMedia) })).toString());
assert.equal(media.url, 'https://motchallenge.net/data/MOT17.zip');
assert.equal(media.archiveBytes, 5860214001); assert.equal(media.archiveEtag, '"15d4bc4f1-5b6c01991f807"');
assert.equal(media.frameCount, 5316); assert.equal(media.entries.length, 5316);
const imagePins = new Map(media.entries.map(entry => [entry.path, entry]));
assert.equal(imagePins.size, 5316);
const sequences = {};
for (const name of lock.dataset.sequences) {
  const seqBytes = await verifyFile(path.join(inputRoot, name, 'seqinfo.ini'), reference.inputHashes[name]['seqinfo.ini']);
  const info = parseSequenceInfo(seqBytes.toString()); assert.equal(info.name, name);
  for (let frame = 1; frame <= info.length; frame++) {
    const relative = `${name}/img1/${String(frame).padStart(6, '0')}.jpg`, pin = imagePins.get(relative);
    assert(pin && pin.zipMember === `MOT17/train/${relative}` && Number.isInteger(pin.zipCrc32), '媒体锁条目缺失');
  }
  if (selected.includes(name)) {
    const bytes = await verifyFile(path.join(inputRoot, name, 'det/det.txt'), reference.inputHashes[name]['det/det.txt']);
    const sequence = adaptDetections(bytes.toString(), info);
    if (subset) sequence.frames = sequence.frames.slice(0, 30);
    sequences[name] = sequence;
  }
}
const identityFiles = ['dist/index.js', 'dist/reid/index.js', 'models/pplcnet-reid/0.1.0/model.json', 'scripts/evaluation/mot17/adapter.mjs', 'scripts/evaluation/mot17/configurations.mjs', 'scripts/evaluation/mot17/lock.json', 'scripts/evaluation/mot17/evaluator.py'];
for (const file of await fs.readdir(path.join(root, 'scripts/evaluation/mot17-reid'))) if (/\.(mjs|py)$/.test(file)) identityFiles.push('scripts/evaluation/mot17-reid/' + file);
for (const file of execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/)) identityFiles.push(file);
const hashes = {};
for (const file of identityFiles.sort()) hashes[file] = sha256(await fs.readFile(path.join(root, file)));
const identity = { files: hashes, model: { bytes: model.bytes, sha256: model.sha256 }, mediaLockSha256: sha256(await fs.readFile(mediaFile)), inputHashes: reference.inputHashes, dataset: lock.dataset };
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(await newOutput(root, out));
const write = (relative, value) => save(root, path.join(out, relative), value);
await write('identity.json', identity);
const summary = { testedAt: new Date().toISOString(), complete: false, subset, backend, identitySha256: sha256(JSON.stringify(identity)), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), environment: { node: process.version, platform: process.platform, release: os.release(), cpu: os.cpus()[0].model }, configurations: null, sequences: {}, exclusions: ['检测器', '渲染', '评分', '落盘与Playwright IPC'], timingScope: 'Node仅冻结特征关联；浏览器DeepSORT外围含本地图片获取/解码/ReID/关联，基线算法不执行模型' };

const { build } = await import('esbuild');
await build({ entryPoints: [path.join(root, 'dist/reid/index.js')], outfile: path.join(out, 'reid.mjs'), bundle: true, format: 'esm', platform: 'browser', external: ['onnxruntime-web', 'onnxruntime-web/*'] });
const routes = new Map([
  ['/reid.mjs', path.join(out, 'reid.mjs')], ['/tracking.mjs', path.join(root, 'dist/index.js')],
  ...['browser.mjs', 'core.mjs'].map(file => ['/mot17-reid/' + file, path.join(root, 'scripts/evaluation/mot17-reid', file)]),
  ...['adapter.mjs', 'configurations.mjs'].map(file => ['/mot17/' + file, path.join(root, 'scripts/evaluation/mot17', file)]),
]);
const serverErrors = [];
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (url === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><meta charset="utf-8"><title>真实序列本地评测</title><script type="importmap">{"imports":{"onnxruntime-web/all":"/ort/ort.all.min.mjs"}}</script>'); return; }
    let bytes, type = 'text/javascript';
    if (url === '/model.onnx') { bytes = modelBytes; type = 'application/octet-stream'; }
    else if (url.startsWith('/image/')) {
      const relative = url.slice(7), pin = imagePins.get(relative);
      if (!pin) throw new Error('未锁定图片');
      bytes = await verifyFile(path.join(images, relative), pin);
      if (crc32(bytes) !== pin.zipCrc32) throw new Error('图片CRC32不匹配');
      type = 'image/jpeg';
    } else if (routes.has(url)) bytes = await fs.readFile(routes.get(url));
    else if (/^\/ort\/[\w.-]+\.(mjs|wasm)$/.test(url)) { bytes = await fs.readFile(path.join(root, 'node_modules/onnxruntime-web/dist', path.basename(url))); type = url.endsWith('.wasm') ? 'application/wasm' : type; }
    else { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', type); response.end(bytes);
  } catch (error) { serverErrors.push(String(error)); response.writeHead(500); response.end('身份校验或读取失败'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = await import('playwright');
const { createTracker } = await import(pathToFileURL(path.join(root, 'dist/index.js')).href);
let browser;
async function open(relative) {
  const file = await newOutput(root, path.join(out, relative));
  await fs.mkdir(path.dirname(file), { recursive: true });
  return fs.open(await newOutput(root, file), 'wx');
}
try {
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(180000);
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(String(error)));
  // 离线本机评测不得隐式接触模型hub或其他远程资源。
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await page.goto(origin);
  summary.browser = { version: browser.version(), playwright: (await readJson(path.join(root, 'node_modules/playwright/package.json'))).version, ...await page.evaluate(async backend => { globalThis.harness = await import('/mot17-reid/browser.mjs'); return globalThis.harness.start({ backend }); }, backend) };
  const space = summary.browser.featureSpace, options = configurations(lock.defaultOptions, space);
  summary.configurations = options;
  for (const [name, sequence] of Object.entries(sequences)) {
    if (Object.keys(summary.sequences).length) {
      await page.evaluate(() => globalThis.harness.stop());
      summary.browser = { version: browser.version(), playwright: summary.browser.playwright, ...await page.evaluate(backend => globalThis.harness.start({backend}), backend) };
      assert.deepEqual(summary.browser.featureSpace, space);
    }
    await page.evaluate(defaults => globalThis.harness.beginSequence(defaults), lock.defaultOptions);
    const features = await open(`features/${name}.jsonl`), timingFile = await open(`browser/${name}-timings.jsonl`), browserFiles = {};
    for (const algorithm of Object.keys(options)) browserFiles[algorithm] = { json: await open(`browser/${algorithm}/${name}.jsonl`), mot: await open(`browser/${algorithm}/${name}.txt`) };
    const costs = [];
    try {
      for (const [index, input] of sequence.frames.entries()) {
        const frameNumber = index + 1, imagePath = `${name}/img1/${String(frameNumber).padStart(6, '0')}.jpg`;
        const result = await page.evaluate(args => globalThis.harness.processFrame(args), { input, imagePath, frameNumber });
        validateFeatureFrame(result.features, input, space);
        await features.write(JSON.stringify({ sequence: name, frameNumber, inputSha256: sha256(JSON.stringify(input)), features: result.features }) + '\n');
        await timingFile.write(JSON.stringify({ frameNumber, ...result.timings }) + '\n'); costs.push(result.timings);
        for (const [algorithm, value] of Object.entries(result.outputs)) { await browserFiles[algorithm].json.write(JSON.stringify(value.result) + '\n'); await browserFiles[algorithm].mot.write(value.mot); }
        if (frameNumber % 25 === 0 || frameNumber === sequence.frames.length) console.log(`${backend} ${name} ${frameNumber}/${sequence.frames.length}`);
      }
    } finally { await features.close(); await timingFile.close(); for (const files of Object.values(browserFiles)) { await files.json.close(); await files.mot.close(); } }
    const result = { info: sequence.info, frames: sequence.frames.length, detections: sequence.frames.reduce((n,f) => n + f.detections.length, 0), adapterStatistics: sequence.statistics, droppedDetections: 0, browserLoad: summary.browser, browser: {}, node: {}, lifecycle: '每序列新会话和跟踪器；首帧cold，其余warm；模型本地读取及load单列' };
    for (const algorithm of Object.keys(options)) {
      const sample = costs.map(c => c.pipelines[algorithm].outerTotalMs).sort((a,b) => a-b);
      result.browser[algorithm] = { modelExecuted: algorithm === 'deepsort', outerTotalMs: sample.reduce((a,b) => a+b,0), p50Ms: sample[Math.floor((sample.length-1)*0.5)], p95Ms: sample[Math.ceil((sample.length-1)*0.95)], trackingTotalMs: costs.reduce((n,c) => n+c.pipelines[algorithm].tracking.totalMs,0) };
    }
    result.browser.deepsort.stages = Object.fromEntries(['imageFetchMs','imageDecodeMs','featureExtractMs'].map(k => [k, costs.reduce((n,c)=>n+c.pipelines.deepsort[k],0)]));
    for (let repetition = 1; repetition <= 2; repetition++) {
      const trackers = Object.fromEntries(Object.entries(options).map(([key,value]) => [key,createTracker(value)])), files = {}, timings = {}, samples = {};
      for (const algorithm of Object.keys(options)) { files[algorithm] = { json: await open(`node-${repetition}/${algorithm}/${name}.jsonl`), mot: await open(`${repetition===1?'trackers':'trackers-repeat'}/${algorithm}/data/${name}.txt`), timings: await open(`node-${repetition}/${algorithm}/${name}-timings.jsonl`) }; timings[algorithm] = 0; samples[algorithm] = []; }
      let index = 0;
      try {
        for await (const line of createInterface({ input: createReadStream(path.join(out, `features/${name}.jsonl`)), crlfDelay: Infinity })) {
          const row = JSON.parse(line), input = sequence.frames[index]; assert(input, '特征行超量');
          assert.equal(row.sequence, name); assert.equal(row.frameNumber, index+1); assert.equal(row.inputSha256, sha256(JSON.stringify(input))); validateFeatureFrame(row.features, input, space);
          for (const [algorithm, tracker] of Object.entries(trackers)) {
            const output = tracker.update(algorithm === 'deepsort' ? row.features : input);
            assert.equal(output.droppedDetections, 0); assert.equal(output.runtime.actualBackend, 'cpu'); assert.equal(output.runtime.executionMode, 'main');
            await files[algorithm].json.write(JSON.stringify(withoutTiming(output)) + '\n'); await files[algorithm].mot.write(exportMot(index+1, output)); await files[algorithm].timings.write(JSON.stringify(output.timings)+'\n');
            timings[algorithm] += output.timings.totalMs; samples[algorithm].push(output.timings.totalMs);
          }
          index++;
        }
        assert.equal(index, sequence.frames.length);
      } finally { for (const tracker of Object.values(trackers)) tracker.dispose(); for (const handles of Object.values(files)) for (const handle of Object.values(handles)) await handle.close(); }
      for (const algorithm of Object.keys(options)) {
        const json = await fs.readFile(path.join(out, `node-${repetition}/${algorithm}/${name}.jsonl`)), mot = await fs.readFile(path.join(out, `${repetition===1?'trackers':'trackers-repeat'}/${algorithm}/data/${name}.txt`));
        assert.equal(sha256(json), sha256(await fs.readFile(path.join(out, `browser/${algorithm}/${name}.jsonl`))), `${name}/${algorithm}浏览器与Node不一致`);
        assert.equal(sha256(mot), sha256(await fs.readFile(path.join(out, `browser/${algorithm}/${name}.txt`))));
        samples[algorithm].sort((a,b)=>a-b);
        (result.node[algorithm] ??= []).push({ repetition, sdkTotalMs: timings[algorithm], p50Ms: samples[algorithm][Math.floor((index-1)*0.5)], p95Ms: samples[algorithm][Math.ceil((index-1)*0.95)], nonTimingSha256: sha256(json), motSha256: sha256(mot), browserEqual: true });
      }
    }
    result.featureSha256 = await hashFile(path.join(out, `features/${name}.jsonl`));
    summary.sequences[name] = result;
    await write(`completed/${name}.json`, result);
  }
  assert.deepEqual(serverErrors, []); assert.deepEqual(pageErrors, []);
  await page.evaluate(() => globalThis.harness.stop());
  summary.complete = true;
  await write('summary.json', summary);
  // 部分序列只产出待合并证据；固定子集永不评分。
  if (!subset && selected.length === lock.dataset.sequences.length) {
    const result = execFileSync(values.python, ['-B', path.join(root,'scripts/evaluation/mot17-reid/score.py'), '--input',inputRoot,'--trackeval',path.resolve(values.trackeval),'--run',out], { cwd:root,encoding:'utf8',maxBuffer:16*1024*1024 });
    await write('score.log',result);
  }
  console.log(`完成：${out}`);
} catch (error) { await write('failure.json', { error: String(error), serverErrors, summary }); throw error; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
