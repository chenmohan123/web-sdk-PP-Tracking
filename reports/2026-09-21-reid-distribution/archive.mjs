// 完成验收后运行的维护者工具；固定原始证据，不下载或重新推理模型。
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root = new URL('./', import.meta.url);
const sdk = new URL('../../', root);
const evidence = new URL('evidence/', root);
await mkdir(evidence, { recursive: true });
const copies = {
  '.tmp/reid-distribution/browser/report.json': 'sources-browser.json',
  '.tmp/reid-distribution/browser.log': 'sources-browser.log',
  '.tmp/reid-distribution/demo/report.json': 'demo-browser.json',
  '.tmp/reid-distribution/demo-browser.log': 'demo-browser.log',
  '.tmp/reid-distribution/environment.json': 'environment.json',
  '.tmp/reid-distribution/verify.log': 'sdk-verify.log',
  '.tmp/reid-distribution/final-fix-cache-ui.json': 'final-fix-cache-ui.json',
  '.tmp/reid-distribution/final-fix-cache-ui.log': 'final-fix-cache-ui.log',
  '.tmp/browser/report.json': 'sdk-browser.json',
  '.tmp/package-check.json': 'package-check.json',
  '.tmp/task-2/sources-red.log': 'sources-red.log',
  '.tmp/task-2/package-red.log': 'package-red.log',
  '.tmp/task-2/unit-green.log': 'entry-unit-green.log',
  'models/pplcnet-reid/0.1.0/model.json': 'model.json',
  'models/pplcnet-reid/0.1.0/sources.json': 'sources.json',
};
for (const [from, to] of Object.entries(copies)) await copyFile(new URL(from, sdk), new URL(to, evidence));
for (const name of ['desktop.png', 'mobile-en.png', 'mobile-zh-CN.png']) await copyFile(new URL(`.tmp/reid-distribution/demo/${name}`, sdk), new URL(name, evidence));
const reference = JSON.parse(gunzipSync(await readFile(new URL('../2026-09-20-reid-preprocessing/evidence/python-result.json.gz', root))));
const fixture = reference.fixtures.find(row => row.real);
await writeFile(new URL('reference.json', evidence), JSON.stringify({ provenance: '2026-09-20 固定Paddle原始向量；仅首个真实裁剪，不包含图像', fixture }, null, 2) + '\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['package.json', 'pnpm-lock.yaml', 'sdk-manifest.yaml', 'scripts/build.mjs', 'scripts/check-package.mjs', 'scripts/distribute-reid.py', 'demo/vite.config.ts', 'tests/reid-distribution-browser.mjs', 'tests/reid-demo-browser.mjs', 'tests/reid-cache-ui-browser.mjs', 'tests/reid-demo.test.ts'];
async function collect(path) {
  for (const item of await readdir(new URL(path, sdk), { withFileTypes: true })) {
    const child = `${path}${item.name}`;
    if (item.isDirectory()) await collect(`${child}/`); else sourceFiles.push(child);
  }
}
await collect('src/'); await collect('demo/src/');
const sourceSha256 = {};
for (const path of sourceFiles.sort()) sourceSha256[path] = sha((await readFile(new URL(path, sdk), 'utf8')).replace(/\r\n/g, '\n'));
const distSha256 = {};
for (const path of ['dist/index.js', 'dist/index.cjs', 'dist/reid/index.js', 'dist/reid/index.cjs']) distSha256[path] = sha(await readFile(new URL(path, sdk)));
await writeFile(new URL('identity.json', evidence), JSON.stringify({ createdAt: new Date().toISOString(), sourceTextEncoding: 'UTF-8/LF', sourceSha256, distSha256 }, null, 2) + '\n');
const paths = ['distribution.json', 'upload-inventory.json', 'upstream-evidence.json', 'protocol.md', 'archive.mjs', 'verify_archive.mjs', ...(await readdir(evidence)).sort().map(name => `evidence/${name}`)];
const lock = [];
for (const path of paths) { const bytes = await readFile(new URL(path, root)); lock.push({ path, bytes: bytes.length, sha256: sha(bytes) }); }
await writeFile(new URL('evidence.lock.json', root), JSON.stringify(lock, null, 2) + '\n');
console.log(`已固定${lock.length}份证据与${sourceFiles.length}份源码身份。`);
