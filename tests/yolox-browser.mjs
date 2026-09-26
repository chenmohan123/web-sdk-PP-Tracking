import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const WORK_DIR = resolve('.tmp/yolox-module');
const CANDIDATE_PATH = resolve(WORK_DIR, 'dist/yolox.js');
const MODEL_PATH = resolve(
  process.env.TRACKING_YOLOX_MODEL ??
    '.tmp/yolox-reference/yolox_tiny_416_opset17.onnx',
);
const FIXTURE_PATH = resolve(WORK_DIR, 'fixture-rgba.bin');
const NODE_RESULT_PATH = resolve(WORK_DIR, 'node-result.json');
const SERIALIZATION_PATH = resolve('tests/yolox-serialization.mjs');
const CANDIDATE_CONFIG_PATH = resolve('tests/yolox-candidate-config.mjs');
const TRACKER_ENTRY_PATH = resolve('dist/index.js');
const SEQUENCE_MODULE_PATH = resolve('tests/yolox-sequence.mjs');
const SEQUENCE_RUNNER_PATH = resolve('tests/yolox-tracking-sequence.mjs');
const ORT_DIST = resolve(
  process.env.TRACKING_YOLOX_ORT_DIST ?? 'node_modules/onnxruntime-web/dist',
);
const EVIDENCE_PATH = resolve(
  'reports/2026-09-24-yolox-assets/runtime-evidence.json',
);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

await mkdir(resolve(EVIDENCE_PATH, '..'), { recursive: true });
// 在任何可失败步骤之前先失效旧证据：中途抛错不得让上一轮的 passed: true 继续留在报告目录。
await writeFile(
  EVIDENCE_PATH,
  `${JSON.stringify({
    schemaVersion: '1.0',
    kind: 'yolox-node-chromium-runtime-validation',
    generatedAt: new Date().toISOString(),
    verification: { passed: false, note: '本文件为失效占位，说明上一次运行未正常完成或被中断' },
  }, null, 2)}\n`,
);

const nodeResult = JSON.parse(await readFile(NODE_RESULT_PATH, 'utf8'));
assert.equal(nodeResult.verification.passed, true, 'Node WASM 验收必须先通过');
const model = await readFile(MODEL_PATH);
const fixture = await readFile(FIXTURE_PATH);
assert.equal(model.byteLength, nodeResult.model.bytes);
assert.equal(sha256(model), nodeResult.model.sha256);
assert.equal(fixture.byteLength, nodeResult.fixture.bytes);
assert.equal(sha256(fixture), nodeResult.fixture.sha256);

const serverErrors = [];
const routes = new Map([
  ['/yolox.mjs', CANDIDATE_PATH],
  ['/tracking.mjs', TRACKER_ENTRY_PATH],
  ['/yolox-sequence.mjs', SEQUENCE_MODULE_PATH],
  ['/yolox-tracking-sequence.mjs', SEQUENCE_RUNNER_PATH],
  ['/yolox-serialization.mjs', SERIALIZATION_PATH],
  ['/yolox-candidate-config.mjs', CANDIDATE_CONFIG_PATH],
  ['/model.onnx', MODEL_PATH],
  ['/fixture.rgba', FIXTURE_PATH],
]);
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Cache-Control', 'no-store');
    if (pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(
        '<!doctype html><meta charset="utf-8"><title>YOLOX 候选本地验收</title>' +
          '<script type="importmap">{"imports":{"onnxruntime-web":"/ort/ort.all.min.mjs","onnxruntime-web/all":"/ort/ort.all.min.mjs","onnxruntime-web/webgpu":"/ort/ort.all.min.mjs","onnxruntime-web/wasm":"/ort/ort.all.min.mjs"}}</script>',
      );
      return;
    }

    const name = basename(pathname);
    let data;
    if (routes.has(pathname)) {
      data = await readFile(routes.get(pathname));
    } else if (pathname.startsWith('/ort/') && pathname.split('/').length === 3) {
      data = await readFile(join(ORT_DIST, name));
    } else {
      throw new Error('未知验收资源');
    }

    response.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.wasm': 'application/wasm',
        '.onnx': 'application/octet-stream',
        '.rgba': 'application/octet-stream',
      }[extname(name)] ?? 'application/octet-stream',
    );
    response.end(data);
  } catch (error) {
    if (error instanceof Error && error.message === '未知验收资源') {
      response.writeHead(404);
      response.end('验收资源不可用');
      return;
    }
    serverErrors.push(String(error));
    response.writeHead(500);
    response.end('验收资源读取失败');
  }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage();
  const requests = [];
  const consoleMessages = [];
  const pageErrors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(origin);

  const browserResult = await page.evaluate(async expected => {
    const sha256 = async value => {
      const digest = await crypto.subtle.digest('SHA-256', value);
      return Array.from(
        new Uint8Array(digest),
        byte => byte.toString(16).padStart(2, '0'),
      ).join('');
    };
    const { serializeYoloxDetections } = await import('/yolox-serialization.mjs');
    // 单帧与序列都从同一份共享配置取阈值，本端不采信 Node 结果文件里的数值。
    const sharedConfig = await import('/yolox-candidate-config.mjs');
    if (
      expected.configuration.scoreThreshold !== sharedConfig.DETECTOR_OPTIONS.scoreThreshold ||
      expected.configuration.nmsThreshold !== sharedConfig.DETECTOR_OPTIONS.nmsThreshold ||
      expected.configuration.maxDetections !== sharedConfig.DETECTOR_OPTIONS.maxDetections ||
      expected.configuration.measuredRuns !== sharedConfig.SAMPLE_COUNT ||
      expected.fixture.width !== sharedConfig.FIXTURE_WIDTH ||
      expected.fixture.height !== sharedConfig.FIXTURE_HEIGHT
    ) {
      throw new Error('Node 记录的单帧配置与共享配置模块不一致');
    }
    const percentile = (values, fraction) => {
      const sorted = [...values].sort((left, right) => left - right);
      const index = (sorted.length - 1) * fraction;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return sorted[lower];
      return sorted[lower] +
        (sorted[upper] - sorted[lower]) * (index - lower);
    };
    const summarize = values => ({
      minMs: Math.min(...values),
      meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
      p50Ms: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
      maxMs: Math.max(...values),
    });
    const summarizeTimings = samples => Object.fromEntries(
      [
        'validationMs',
        'preprocessMs',
        'inferenceMs',
        'postprocessMs',
        'totalMs',
      ].map(stage => [stage, summarize(samples.map(sample => sample[stage]))]),
    );
    const exposedError = error => ({
      name: error instanceof Error ? error.name : 'Error',
      code:
        error && typeof error === 'object' && typeof error.code === 'string'
          ? error.code
          : null,
      message: (error instanceof Error ? error.message : String(error))
        .replace(/https?:\/\/\S+/g, '[redacted-url]'),
    });
    const run = async (backend, modelBytes, image) => {
      const { createYoloxDetector } = await import('/yolox.mjs');
      const detector = createYoloxDetector({
        modelId: expected.model.id,
        backend,
        modelBytes: modelBytes.slice(0),
        scoreThreshold: sharedConfig.DETECTOR_OPTIONS.scoreThreshold,
        nmsThreshold: sharedConfig.DETECTOR_OPTIONS.nmsThreshold,
        maxDetections: sharedConfig.DETECTOR_OPTIONS.maxDetections,
      });
      const progress = [];
      const samples = [];
      const serializations = [];
      let load;
      let loadWallMs;
      let warmup;
      try {
        const loadStart = performance.now();
        load = await detector.load({ onProgress: event => progress.push(event) });
        loadWallMs = performance.now() - loadStart;
        warmup = await detector.detect({ image });
        if (warmup.generation !== 0 || warmup.detections.length === 0) {
          throw new Error('浏览器预热推理未产生预期非空 generation 0 结果');
        }
        for (let index = 0; index < sharedConfig.SAMPLE_COUNT; index += 1) {
          const result = await detector.detect({ image });
          if (result.generation !== index + 1) {
            throw new Error('浏览器 generation 未连续递增');
          }
          samples.push(result.timings);
          serializations.push(serializeYoloxDetections(result));
        }
      } finally {
        await detector.dispose();
      }
      if (!serializations.every(value => value === serializations[0])) {
        throw new Error(`${backend} 重复推理输出不稳定`);
      }
      const canonicalDetections = serializations[0];
      return {
        runtime: load.runtime,
        coldLoad: { wallMs: loadWallMs, timings: load.timings },
        progress,
        warmup: { generation: warmup.generation, timings: warmup.timings },
        warmDetection: {
          samples,
          summary: summarizeTimings(samples),
        },
        detection: {
          count: warmup.detections.length,
          droppedDetections: warmup.droppedDetections,
          serializedBytes: new TextEncoder().encode(canonicalDetections).byteLength,
          sha256: await sha256(new TextEncoder().encode(canonicalDetections)),
        },
        canonicalDetections,
      };
    };
    const runSequence = async modelBytes => {
      const [
        { createYoloxSyntheticSequence },
        { runYoloxTrackingSequence },
        { createYoloxDetector },
        { createTracker },
        { serializeYoloxDetections, serializeYoloxDetectionsUnordered },
        { SEQUENCE_FRAME_COUNT, SEQUENCE_SERIALIZERS, SEQUENCE_VARIANTS, sequenceContract },
      ] = await Promise.all([
        import('/yolox-sequence.mjs'),
        import('/yolox-tracking-sequence.mjs'),
        import('/yolox.mjs'),
        import('/tracking.mjs'),
        import('/yolox-serialization.mjs'),
        import('/yolox-candidate-config.mjs'),
      ]);
      if (typeof createTracker !== 'function') {
        throw new Error('正式根入口 bundle 未导出 createTracker');
      }
      if (
        serializeYoloxDetections !== SEQUENCE_SERIALIZERS.ordered ||
        serializeYoloxDetectionsUnordered !== SEQUENCE_SERIALIZERS['unordered-bag']
      ) {
        throw new Error('共享配置使用的检测序列化器与验收脚本不是同一实现');
      }
      // 变体与阈值由本端直接 import 的共享配置决定，不接受 Node 结果文件转授。
      const contract = sequenceContract();
      const frames = createYoloxSyntheticSequence();
      if (frames.length !== SEQUENCE_FRAME_COUNT) {
        throw new Error(`共享配置声明 ${SEQUENCE_FRAME_COUNT} 帧，实际生成 ${frames.length} 帧`);
      }
      const sequences = [];
      for (const variant of SEQUENCE_VARIANTS) {
        const serializeDetections = SEQUENCE_SERIALIZERS[variant.hashing];
        if (!serializeDetections) {
          throw new Error(`${variant.hashing} 没有对应的检测序列化器`);
        }
        const detector = createYoloxDetector({
          modelId: expected.model.id,
          backend: 'wasm',
          modelBytes: modelBytes.slice(0),
          ...variant.detectorOptions,
        });
        try {
          const load = await detector.load();
          if (
            load.runtime.actualBackend !== 'wasm' ||
            load.runtime.executionMode !== 'main'
          ) {
            throw new Error(`${variant.id} 变体的序列检测器运行时身份不匹配`);
          }
          const run = () => runYoloxTrackingSequence({
            frames,
            detector,
            tracker: createTracker({ ...variant.trackerOptions }),
            digest: async value =>
              sha256(typeof value === 'string' ? new TextEncoder().encode(value) : value),
            serializeDetections,
          });
          const first = await run();
          const repeat = await run();
          if (
            first.sequence.detectionSha256 !== repeat.sequence.detectionSha256 ||
            first.sequence.trackingSha256 !== repeat.sequence.trackingSha256
          ) {
            throw new Error(`${variant.id} 变体重放未复现一致的序列哈希`);
          }
          if (variant.buildsTracks) {
            if (!first.frames.some(frame => frame.trackedTrackIds.length > 0)) {
              throw new Error(`${variant.id} 变体未确认任何 tracked 轨迹`);
            }
            if (!first.frames.some(frame => frame.lostTrackIds.length > 0)) {
              throw new Error(`${variant.id} 变体未出现 lost 状态`);
            }
            if (!first.frames.some(frame => frame.removedTrackIds.length > 0)) {
              throw new Error(`${variant.id} 变体未发生轨迹移除`);
            }
          }
          sequences.push({
            id: variant.id,
            hashing: variant.hashing,
            detectsRealBoxes: variant.detectsRealBoxes,
            buildsTracks: variant.buildsTracks,
            trackerOptions: variant.trackerOptions,
            runtime: load.runtime,
            frames: first.frames,
            summary: first.sequence,
            repeat: {
              detectionSha256: repeat.sequence.detectionSha256,
              trackingSha256: repeat.sequence.trackingSha256,
            },
          });
        } finally {
          await detector.dispose();
        }
      }
      return { contract, sequences };
    };

    const ort = await import('onnxruntime-web/all');
    ort.env.wasm.wasmPaths = '/ort/';
    const [modelBytes, fixtureBytes] = await Promise.all([
      fetch('/model.onnx').then(response => response.arrayBuffer()),
      fetch('/fixture.rgba').then(response => response.arrayBuffer()),
    ]);
    if (
      modelBytes.byteLength !== expected.model.bytes ||
      (await sha256(modelBytes)) !== expected.model.sha256
    ) {
      throw new Error('浏览器模型身份不匹配');
    }
    if (
      fixtureBytes.byteLength !== expected.fixture.bytes ||
      (await sha256(fixtureBytes)) !== expected.fixture.sha256
    ) {
      throw new Error('浏览器夹具身份不匹配');
    }
    const image = {
      width: expected.fixture.width,
      height: expected.fixture.height,
      data: new Uint8Array(fixtureBytes),
    };
    // 两端必须执行同一批字节：对服务端实际返回的模块字节取哈希，再与 Node 侧磁盘哈希比对。
    // CJS 变体不经浏览器执行，其身份由 scripts/build-yolox-candidate.mjs 的真实 require 消费与哈希记录把关。
    const fetchText = async url =>
      new TextDecoder().decode(await fetch(url).then(response => response.arrayBuffer()));
    const moduleRoutes = {
      candidateEsmSha256: '/yolox.mjs',
      trackerEntrySha256: '/tracking.mjs',
      configSha256: '/yolox-candidate-config.mjs',
      serializationSha256: '/yolox-serialization.mjs',
      sequenceSha256: '/yolox-sequence.mjs',
      runnerSha256: '/yolox-tracking-sequence.mjs',
    };
    const moduleHashes = {};
    for (const [key, url] of Object.entries(moduleRoutes)) {
      moduleHashes[key] = await sha256(new TextEncoder().encode(await fetchText(url)));
    }
    const wasm = await run('wasm', modelBytes, image);
    if (
      wasm.runtime.requestedBackend !== 'wasm' ||
      wasm.runtime.actualBackend !== 'wasm' ||
      wasm.runtime.executionMode !== 'main' ||
      wasm.runtime.ortVersion !== '1.27.0'
    ) {
      throw new Error('Chromium WASM/main 运行时身份不匹配');
    }
    const sequenceReport = await runSequence(modelBytes);
    const browserSequences = sequenceReport.sequences;

    let webgpu;
    try {
      if (!('gpu' in navigator)) {
        webgpu = {
          status: 'unsupported',
          reason: 'navigator.gpu 不可用',
          adapterInfo: null,
        };
      } else {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance',
        });
        if (!adapter) {
          webgpu = {
            status: 'unsupported',
            reason: 'Chromium 未返回 WebGPU adapter',
            adapterInfo: null,
          };
        } else {
          const info = adapter.info ?? {};
          const adapterInfo = {
            vendor: info.vendor ?? '',
            architecture: info.architecture ?? '',
            device: info.device ?? '',
            description: info.description ?? '',
            isFallbackAdapter: info.isFallbackAdapter ?? null,
          };
          const descriptor = Object.values(adapterInfo).join(' ').toLowerCase();
          const software = /swiftshader|software|llvmpipe/.test(descriptor);
          if (adapterInfo.isFallbackAdapter !== false || software) {
            webgpu = {
              status: 'unverified',
              reason: '未证明 adapter 为真实硬件，未运行 WebGPU 推理',
              adapterInfo,
            };
          } else {
            try {
              const result = await run('webgpu', modelBytes, image);
              webgpu = {
                status: 'verified',
                adapterInfo,
                result,
              };
            } catch (error) {
              webgpu = {
                status: 'unverified',
                reason: '真实硬件 adapter 上候选推理未通过',
                adapterInfo,
                error: exposedError(error),
              };
            }
          }
        }
      }
    } catch (error) {
      webgpu = {
        status: 'unverified',
        reason: 'WebGPU 能力探测失败',
        adapterInfo: null,
        error: exposedError(error),
      };
    }

    return {
      browser: {
        userAgent: navigator.userAgent,
        crossOriginIsolated,
      },
      modelSha256: await sha256(modelBytes),
      fixtureSha256: await sha256(fixtureBytes),
      wasm,
      sequences: browserSequences,
      sequenceContract: sequenceReport.contract,
      moduleHashes,
      webgpu,
    };
  }, {
    model: nodeResult.model,
    fixture: nodeResult.fixture,
    configuration: nodeResult.configuration,
  });

  assert.equal(browserResult.modelSha256, nodeResult.model.sha256);
  assert.equal(browserResult.fixtureSha256, nodeResult.fixture.sha256);
  // 两端各自 import 同一份共享配置，再交叉核对，避免浏览器采信 Node 的结果文件。
  assert.deepEqual(
    browserResult.sequenceContract,
    nodeResult.contract,
    'Node 与 Chromium 必须使用同一份组合验收配置',
  );
  assert.equal(
    browserResult.moduleHashes.candidateEsmSha256,
    nodeResult.artifacts.candidateEsmSha256,
    '两端执行的候选 ESM bundle 字节必须一致',
  );
  assert.equal(
    browserResult.moduleHashes.trackerEntrySha256,
    nodeResult.artifacts.trackerEntrySha256,
    '两端执行的正式根入口 bundle 字节必须一致',
  );
  const emptyVariant = browserResult.sequences.find(
    variant => variant.detectsRealBoxes === false,
  );
  assert.ok(emptyVariant, '证据必须标注哪个变体只是空检测契约');
  assert.equal(
    browserResult.wasm.canonicalDetections,
    nodeResult.canonicalDetections,
    'Node 与 Chromium WASM detection 序列化结果必须逐字节一致',
  );
  assert.equal(
    browserResult.wasm.detection.sha256,
    nodeResult.detection.sha256,
    'Node 与 Chromium WASM detection SHA-256 必须一致',
  );
  assert.equal(
    browserResult.sequences.length,
    nodeResult.sequence.variants.length,
    'Node 与 Chromium 必须覆盖相同的序列变体',
  );
  const sequenceComparison = browserResult.sequences.map((variant, index) => {
    const nodeVariant = nodeResult.sequence.variants[index];
    assert.equal(variant.id, nodeVariant.id, '序列变体 id 必须一致');
    assert.equal(variant.hashing, nodeVariant.hashing, '序列变体哈希口径必须一致');
    assert.equal(variant.frames.length, nodeVariant.frames.length, '序列变体帧数必须一致');
    const perFrame = variant.frames.map((frame, frameIndex) => {
      const nodeFrame = nodeVariant.frames[frameIndex];
      assert.equal(frame.id, nodeFrame.id, '序列变体帧 id 顺序必须一致');
      assert.equal(
        frame.detectionCount,
        nodeFrame.detectionCount,
        `${variant.id} 的 ${frame.id} 帧检测数必须在两个运行时一致`,
      );
      assert.equal(
        frame.droppedDetections,
        nodeFrame.droppedDetections,
        `${variant.id} 的 ${frame.id} 帧丢弃数必须在两个运行时一致`,
      );
      assert.equal(
        frame.image.sha256,
        nodeFrame.image.sha256,
        `${variant.id} 的 ${frame.id} 帧图像哈希必须在两个运行时一致`,
      );
      return {
        id: frame.id,
        detectionSha256Match: frame.detectionSha256 === nodeFrame.detectionSha256,
        trackingSha256Match: frame.trackingSha256 === nodeFrame.trackingSha256,
        nodeDetectionSha256: nodeFrame.detectionSha256,
        chromiumDetectionSha256: frame.detectionSha256,
        nodeTrackingSha256: nodeFrame.trackingSha256,
        chromiumTrackingSha256: frame.trackingSha256,
      };
    });
    const framesMatch = perFrame.every(
      frame => frame.detectionSha256Match && frame.trackingSha256Match,
    );
    if (!variant.detectsRealBoxes) {
      // 该变体只是空检测契约：先把"确实为空"钉住，再要求两端一致，避免把 7/7 读成有框一致。
      assert.ok(
        variant.frames.every(frame => frame.detectionCount === 0),
        `${variant.id} 变体声明为零检出契约，但实际检出了框`,
      );
      assert.ok(framesMatch, `${variant.id} 变体的空检测契约必须两端一致`);
    }
    return {
      id: variant.id,
      hashing: variant.hashing,
      detectsRealBoxes: nodeVariant.detectsRealBoxes,
      framesMatch,
      matchedFrameCount: perFrame.filter(frame => frame.detectionSha256Match).length,
      frameCount: perFrame.length,
      minimumAdjacentScoreGaps: variant.frames.map(frame => frame.minimumAdjacentScoreGap),
      nodeSequenceDetectionSha256: nodeVariant.summary.detectionSha256,
      chromiumSequenceDetectionSha256: variant.summary.detectionSha256,
      nodeSequenceTrackingSha256: nodeVariant.summary.trackingSha256,
      chromiumSequenceTrackingSha256: variant.summary.trackingSha256,
      frames: perFrame,
    };
  });
  assert.equal(pageErrors.length, 0, 'Chromium 页面不得产生未处理错误');
  assert.deepEqual(serverErrors, [], '验收服务器不得在资源白名单内发生读取失败');
  assert.ok(
    requests.every(url => url === origin || url.startsWith(`${origin}/`)),
    '候选验收不得发出本机来源之外的请求',
  );

  const sharedSequenceConfigMatch =
    JSON.stringify(browserResult.sequenceContract) === JSON.stringify(nodeResult.contract);
  const servedModuleIdentityMatch = Object.entries(nodeResult.artifacts)
    .filter(([key]) => key in browserResult.moduleHashes)
    .every(([key, value]) => browserResult.moduleHashes[key] === value) &&
    Object.keys(browserResult.moduleHashes).every(
      key => nodeResult.artifacts[key] === browserResult.moduleHashes[key],
    );
  assert.ok(sharedSequenceConfigMatch, '两端共享的组合验收配置必须一致');
  assert.ok(servedModuleIdentityMatch, '两端实际执行与定义的模块字节必须一致');
  assert.deepEqual(
    Object.keys(browserResult.moduleHashes).sort(),
    ['candidateEsmSha256', 'configSha256', 'runnerSha256', 'sequenceSha256', 'serializationSha256', 'trackerEntrySha256'],
    '浏览器侧必须逐一绑定执行与定义所用的每一份模块',
  );

  const {
    canonicalDetections: _nodeCanonical,
    ...nodeEvidence
  } = nodeResult;
  const {
    canonicalDetections: _browserCanonical,
    ...browserWasmEvidence
  } = browserResult.wasm;
  let webgpuEvidence = browserResult.webgpu;
  if (webgpuEvidence.result?.canonicalDetections) {
    const {
      canonicalDetections: _webgpuCanonical,
      ...webgpuResult
    } = webgpuEvidence.result;
    webgpuEvidence = { ...webgpuEvidence, result: webgpuResult };
  }

  const evidence = {
    schemaVersion: '1.0',
    kind: 'yolox-node-chromium-runtime-validation',
    generatedAt: new Date().toISOString(),
    model: nodeResult.model,
    fixture: nodeResult.fixture,
    configuration: nodeResult.configuration,
    node: nodeEvidence,
    chromium: {
      version: browser.version(),
      ...browserResult.browser,
      wasm: browserWasmEvidence,
      sequences: browserResult.sequences,
      sequenceContract: browserResult.sequenceContract,
      moduleHashes: browserResult.moduleHashes,
      webgpu: webgpuEvidence,
      localRequests: requests,
      serverErrors,
      consoleMessages,
      pageErrors,
    },
    comparison: {
      canonicalSerializationMatch: true,
      nodeDetectionSha256: nodeResult.detection.sha256,
      chromiumDetectionSha256: browserResult.wasm.detection.sha256,
      detectionSha256: nodeResult.detection.sha256,
      sequenceVariants: sequenceComparison,
      passed: true,
    },
    claims: {
      nodeWasmMainVerified: true,
      chromiumWasmMainVerified: true,
      chromiumWebgpuVerified: webgpuEvidence.status === 'verified',
      workerVerified: false,
      mobileVerified: false,
      safariVerified: false,
      firefoxVerified: false,
      npuVerified: false,
      webnnVerified: false,
    },
    verification: {
      modelIdentityMatch: true,
      fixtureIdentityMatch: true,
      localNetworkOnly: true,
      nodeRepeatedOutputStable: true,
      chromiumRepeatedOutputStable: true,
      nodeChromiumSerializedOutputMatch: true,
      nodeChromiumDetectionHashMatch: true,
      nodeChromiumEmptySequenceContractMatch:
        sequenceComparison.find(variant => variant.id === 'candidate-default-threshold')?.framesMatch === true,
      nodeChromiumRealBoxSequenceMatch:
        sequenceComparison.find(variant => variant.id === 'zero-threshold-coverage')?.framesMatch === true,
      nodeChromiumLifecycleSequenceMatch:
        sequenceComparison.find(variant => variant.id === 'zero-threshold-lifecycle')?.framesMatch === true,
      sharedSequenceConfigMatch,
      servedModuleIdentityMatch,
      passed: true,
    },
  };

  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    browser: evidence.chromium.version,
    detectionCount: evidence.chromium.wasm.detection.count,
    detectionSha256: evidence.comparison.detectionSha256,
    nodeWarmP50Ms: evidence.node.warmDetection.summary.totalMs.p50Ms,
    chromiumWarmP50Ms: evidence.chromium.wasm.warmDetection.summary.totalMs.p50Ms,
    webgpuStatus: evidence.chromium.webgpu.status,
    sequences: evidence.comparison.sequenceVariants.map(variant => ({
      id: variant.id,
      hashing: variant.hashing,
      framesMatch: variant.framesMatch,
      matchedFrameCount: `${variant.matchedFrameCount}/${variant.frameCount}`,
      detectionSha256: variant.chromiumSequenceDetectionSha256,
      trackingSha256: variant.chromiumSequenceTrackingSha256,
    })),
    passed: true,
  }));
  await page.close();
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
