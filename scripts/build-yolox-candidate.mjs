import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const outputDirectory = '.tmp/yolox-module/dist';
const packageDirectory = '.tmp/yolox-module/candidate';
const typesDirectory = `${outputDirectory}/types`;
const PACKAGE_NAME = 'tracking-yolox-local-candidate';
const CHECK_PATH = '.tmp/yolox-module/consumer-check.json';
const EVIDENCE_PATH = 'reports/2026-09-24-yolox-assets/candidate-consumer-check.json';

await mkdir(typesDirectory, { recursive: true });
for (const [format, extension] of [['esm', 'js'], ['cjs', 'cjs']]) {
  await build({
    entryPoints: ['src/yolox/index.ts'],
    outfile: `${outputDirectory}/yolox.${extension}`,
    bundle: true,
    platform: 'neutral',
    format,
    target: 'es2022',
    external: ['onnxruntime-web', 'onnxruntime-web/*'],
    logLevel: 'info',
  });
}

const declarations = spawnSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--target',
    'ES2022',
    '--module',
    'ESNext',
    '--moduleResolution',
    'Bundler',
    '--resolveJsonModule',
    '--allowSyntheticDefaultImports',
    '--rootDir',
    '.',
    '--strict',
    '--skipLibCheck',
    '--declaration',
    '--emitDeclarationOnly',
    '--newLine',
    'lf',
    '--outDir',
    typesDirectory,
    'src/yolox/index.ts',
  ],
  { stdio: 'inherit' },
);
if (declarations.status !== 0) {
  process.exit(declarations.status ?? 1);
}

// 候选源码沿用无扩展名相对导入，NodeNext 消费要求声明补全扩展名，与正式构建同一处理。
for (const entry of await readdir(typesDirectory, { recursive: true })) {
  const file = String(entry);
  if (!file.endsWith('.d.ts')) continue;
  const path = join(typesDirectory, file);
  const content = await readFile(path, 'utf8');
  await writeFile(
    path,
    content.replace(
      /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,
      (match, before, specifier, after) =>
        /\.[a-z]+$/i.test(specifier) ? match : `${before}${specifier}.js${after}`,
    ),
  );
}

await mkdir(packageDirectory, { recursive: true });
for (const file of ['yolox.js', 'yolox.cjs']) {
  await cp(join(outputDirectory, file), join(packageDirectory, file));
}
await cp(typesDirectory, join(packageDirectory, 'types'), { recursive: true });
await writeFile(
  join(packageDirectory, 'package.json'),
  `${JSON.stringify({
    name: PACKAGE_NAME,
    private: true,
    version: '0.0.0-candidate',
    type: 'module',
    exports: {
      '.': {
        types: './types/src/yolox/index.d.ts',
        import: './yolox.js',
        require: './yolox.cjs',
      },
    },
  }, null, 2)}\n`,
);

const consumer = await mkdtemp(join(tmpdir(), 'tracking-yolox-consumer-'));
await mkdir(join(consumer, 'node_modules'), { recursive: true });
await cp(packageDirectory, join(consumer, 'node_modules', PACKAGE_NAME), { recursive: true });

// 候选未获远程分发授权，消费检查只覆盖工厂与同步校验，不触发 load() 的任何 ORT 会话。
const consumeBody = `
assert.equal(typeof createYoloxDetector, 'function');
// 哨兵：任何网络触达都说明消费路径越过了"仅工厂与同步校验"的边界。
const realFetch = globalThis.fetch;
const fetchCalls = [];
globalThis.fetch = (...args) => { fetchCalls.push(String(args[0])); return Promise.reject(new Error('消费检查不允许网络请求')); };
assert.throws(
  () => createYoloxDetector({ modelId: 'yolox-tiny-416-fp32', backend: 'wasm' }),
  error => error instanceof YoloxError && error.code === 'INVALID_MANIFEST',
);
assert.throws(
  () => createYoloxDetector({
    modelId: 'yolox-tiny-416-fp32',
    backend: 'wasm',
    modelBytes: new ArrayBuffer(1024),
  }),
  error => error instanceof YoloxError && error.code === 'INVALID_INPUT',
);
assert.deepEqual(fetchCalls, [], '候选消费不得触发任何网络请求');
globalThis.fetch = realFetch;
`;

for (const extension of ['mjs', 'cjs']) {
  const file = join(consumer, `consume.${extension}`);
  await writeFile(
    file,
    [
      extension === 'mjs'
        ? `import assert from 'node:assert/strict';`
        : `const assert = require('node:assert/strict');`,
      extension === 'mjs'
        ? `import { createYoloxDetector, YoloxError } from '${PACKAGE_NAME}';`
        : `const { createYoloxDetector, YoloxError } = require('${PACKAGE_NAME}');`,
      consumeBody,
    ].join('\n'),
  );
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${extension} 消费失败：${result.stderr}`);
}

for (const extension of ['mts', 'cts']) {
  const file = join(consumer, `types.${extension}`);
  await writeFile(
    file,
    `import {
  createYoloxDetector,
  YoloxError,
  type YoloxDetector,
  type YoloxDetectorResult,
  type YoloxErrorCode,
  type YoloxOptions,
} from '${PACKAGE_NAME}';
const options: YoloxOptions = {
  modelId: 'yolox-tiny-416-fp32',
  backend: 'wasm',
  modelBytes: new ArrayBuffer(0),
};
const detector: YoloxDetector = createYoloxDetector(options);
const result: Promise<YoloxDetectorResult> | undefined = undefined;
const code: YoloxErrorCode = 'INVALID_MANIFEST';
// @ts-expect-error backend 只允许 wasm 与 webgpu。
const invalidBackend: YoloxOptions = { modelId: 'x', backend: 'cpu' };
// @ts-expect-error 候选错误码不能写成任意字符串。
const invalidCode: YoloxErrorCode = 'NOT_A_CODE';
void detector; void result; void code; void invalidBackend; void invalidCode; void YoloxError;
`,
  );
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      file,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${extension} 类型消费失败：${result.stdout}${result.stderr}`);
}

// 反面对照：剥掉声明里的 .js 后缀，NodeNext 必须报错，证明上面的类型消费不是空转。
const controlRoot = join(consumer, 'control');
const controlPackage = join(controlRoot, 'node_modules', PACKAGE_NAME);
await cp(packageDirectory, controlPackage, { recursive: true });
const controlTypes = join(controlPackage, 'types');
for (const entry of await readdir(controlTypes, { recursive: true })) {
  const file = String(entry);
  if (!file.endsWith('.d.ts')) continue;
  const path = join(controlTypes, file);
  const content = await readFile(path, 'utf8');
  await writeFile(
    path,
    content.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)\.js(['"])/g, '$1$2$3'),
  );
}
const controlFile = join(controlRoot, 'control.mts');
await writeFile(
  controlFile,
  `import { createYoloxDetector } from '${PACKAGE_NAME}';\nvoid createYoloxDetector;\n`,
);
const control = spawnSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
    '--strict',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    controlFile,
  ],
  { encoding: 'utf8' },
);
assert.notEqual(control.status, 0, '剥掉扩展名后 NodeNext 仍然通过，声明补全检查已失效');
assert.match(control.stdout, /TS283[45]/, '反面对照必须报缺少显式文件扩展名');

const hashes = {};
for (const file of ['yolox.js', 'yolox.cjs']) {
  hashes[file] = createHash('sha256').update(await readFile(join(packageDirectory, file))).digest('hex');
}
await rm(consumer, { recursive: true, force: true });
const check = {
  testedAt: new Date().toISOString(),
  package: PACKAGE_NAME,
  packageDirectory: resolve(packageDirectory),
  consumerDirectory: consumer,
  consumerDirectoryCleaned: true,
  hashes,
  nodenextControl: {
    strippedExtensionErrorCode: control.stdout.match(/TS283[45]/)?.[0] ?? null,
    note: '剥掉声明的 .js 后缀后 tsc 必须失败，用于证明 NodeNext 类型消费不是空过',
  },
  checks: [
    'ESM 实际消费',
    'CommonJS 实际消费',
    'NodeNext mts/cts 类型消费',
    'NodeNext 反面对照必须失败',
    '消费期间 fetch 哨兵未被调用',
  ],
};
const serialized = `${JSON.stringify(check, null, 2)}\n`;
await writeFile(CHECK_PATH, serialized);
await writeFile(EVIDENCE_PATH, serialized);

console.log('YOLOX 候选 ESM、CJS 与 NodeNext 类型消费通过，产物仅在 .tmp/yolox-module，未进入正式 exports。');
