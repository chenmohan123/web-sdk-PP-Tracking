import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { protectOutput, writeReport } from '../output-path.mjs';
import { parseSequenceInfo, adaptDetections } from './adapter.mjs';
import { runSequence } from './execute.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const archive = path.join(root, 'reports');
const lock = JSON.parse(await fs.readFile(new URL('./lock.json', import.meta.url), 'utf8'));
const { values } = parseArgs({ options: { python: { type: 'string', default: 'python' }, zip: { type: 'string' }, trackeval: { type: 'string' }, out: { type: 'string' }, 'download-data': { type: 'boolean' }, 'skip-browser': { type: 'boolean' } }, strict: true });
const sha256 = content => createHash('sha256').update(content).digest('hex');
const output = protectOutput(path.resolve(values.out ?? path.join(root, '.tmp', `mot17-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`)), archive);
await fs.mkdir(path.join(root, '.tmp'), { recursive: true });
const tmp = await fs.realpath(path.join(root, '.tmp'));
const relative = path.relative(tmp, output);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('真实数据输出必须使用本仓库 .tmp 内的新目录');
await fs.mkdir(output);
const save = (relative, value) => writeReport(path.join(output, relative), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', archive);
const evaluator = path.join(root, 'scripts/evaluation/mot17/evaluator.py');
async function command(name, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  await save(`${name}.log`, `$ ${executable} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.error || result.status !== 0) throw new Error(`${name} 失败，见 ${output}/${name}.log`, { cause: result.error });
}
const zip = path.resolve(values.zip ?? path.join(output, 'MOT17Labels.zip'));
await command('prepare', values.python, [evaluator, 'prepare', '--archive', zip, '--output', path.join(output, 'input'), ...(values['download-data'] ? ['--download'] : [])]);
const trackeval = path.resolve(values.trackeval ?? path.join(root, '.tmp', 'TrackEval-' + lock.trackeval.commit));
try { await fs.access(trackeval); }
catch {
  await command('trackeval-init', 'git', ['init', trackeval]);
  await command('trackeval-fetch', 'git', ['-C', trackeval, 'fetch', '--depth', '1', lock.trackeval.repository, lock.trackeval.commit]);
  await command('trackeval-checkout', 'git', ['-C', trackeval, 'checkout', '--detach', 'FETCH_HEAD']);
}
const sdk = path.join(root, 'dist/index.js');
const { createTracker } = await import(pathToFileURL(sdk));
const configurations = { default: lock.defaultOptions, 'no-low': { ...lock.defaultOptions, lowScoreThreshold: lock.defaultOptions.highScoreThreshold } };
const summary = {
  testedAt: new Date().toISOString(), dataset: lock.dataset,
  sdk: { version: 'web-sdk-pp-tracking@0.1.0', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), entrySha256: sha256(await fs.readFile(sdk)) },
  environment: { node: process.version, platform: process.platform, release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, actualBackend: 'cpu', executionMode: 'main' },
  configurations, inputHashes: JSON.parse(await fs.readFile(path.join(output, 'input-hashes.json'), 'utf8')), adapter: {}, runs: {}, browser: { status: '未运行' }, scripts: {},
};
for (const name of ['adapter.mjs', 'execute.mjs', 'evaluator.py', 'run.mjs', 'lock.json']) summary.scripts[name] = sha256(await fs.readFile(new URL(name, import.meta.url)));
let browserInput, expectedBrowser;
for (const name of lock.dataset.sequences) {
  const input = path.join(output, 'input', name);
  const sequence = adaptDetections(await fs.readFile(path.join(input, 'det/det.txt'), 'utf8'), parseSequenceInfo(await fs.readFile(path.join(input, 'seqinfo.ini'), 'utf8')));
  summary.adapter[name] = { ...sequence.info, ...sequence.statistics, framesSha256: sha256(JSON.stringify(sequence.frames)) };
  for (const [configuration, options] of Object.entries(configurations)) {
    const cpuStart = process.cpuUsage(), started = performance.now();
    const result = runSequence(createTracker, sequence.frames, options);
    const elapsedMs = performance.now() - started, cpu = process.cpuUsage(cpuStart);
    const repeat = runSequence(createTracker, sequence.frames, options);
    assert.equal(result.deterministic, repeat.deterministic, `${name}/${configuration} 非耗时输出不确定`);
    assert.equal(result.mot, repeat.mot);
    await save(`trackers/${configuration}/data/${name}.txt`, result.mot);
    await save(`raw/${configuration}/${name}.jsonl`, result.deterministic);
    await save(`raw/${configuration}/${name}-timings.json`, result.timings);
    (summary.runs[configuration] ??= {})[name] = { ...result.summary, elapsedMs, cpuMs: (cpu.user + cpu.system) / 1000, deterministicRepeat: true, nonTimingSha256: sha256(result.deterministic), motSha256: sha256(result.mot) };
    if (name === lock.dataset.sequences[0] && configuration === 'default') { browserInput = sequence.frames; expectedBrowser = result; }
    console.log(`${name}/${configuration}: ${result.summary.frames} 帧；确定性通过；最大轨迹 ${result.summary.maxTracks}`);
  }
}
await command('score', values.python, [evaluator, 'score', '--trackeval', trackeval, '--run', output]);
summary.metrics = JSON.parse(await fs.readFile(path.join(output, 'metrics.json'), 'utf8'));
if (!values['skip-browser']) {
  const { chromium } = await import('playwright');
  const assets = new Map([
    ['/sdk.mjs', await fs.readFile(sdk)],
    ['/adapter.mjs', await fs.readFile(new URL('./adapter.mjs', import.meta.url))],
    ['/execute.mjs', await fs.readFile(new URL('./execute.mjs', import.meta.url))],
  ]);
  const server = createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><title>本地 MOT17 数值复核</title>'); }
    else if (assets.has(req.url)) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(assets.get(req.url)); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async ({ frames, options }) => {
      const { createTracker } = await import('/sdk.mjs');
      const { runSequence } = await import('/execute.mjs');
      return runSequence(createTracker, frames, options);
    }, { frames: browserInput, options: configurations.default });
    assert.equal(result.deterministic, expectedBrowser.deterministic, 'Chromium/Node 非耗时输出不一致');
    assert.equal(result.mot, expectedBrowser.mot);
    await save('raw/chromium/MOT17-02-FRCNN.jsonl', result.deterministic);
    await save('raw/chromium/MOT17-02-FRCNN-timings.json', result.timings);
    summary.browser = { status: '通过', version: browser.version(), playwright: JSON.parse(await fs.readFile(path.join(root, 'node_modules/playwright/package.json'), 'utf8')).version, sequence: lock.dataset.sequences[0], ...result.summary, nonTimingSha256: sha256(result.deterministic), nodeEqual: true, actualBackend: 'cpu', executionMode: 'main' };
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
await save('summary.json', summary);
console.log(`完整报告：${path.join(output, 'summary.json')}`);
