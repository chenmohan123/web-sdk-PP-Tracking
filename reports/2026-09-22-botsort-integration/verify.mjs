// 校验归档字节；--local 额外核对当前源码、构建包与原始本地回执。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const lock = await json(resolve(directory, 'evidence.lock.json'));
for (const [path, expected] of Object.entries(lock.files)) assert.equal(await hash(resolve(directory, path)), expected, path);
const provenance = await json(resolve(directory, 'provenance.json'));
if (process.argv.includes('--local')) {
  for (const [path, expected] of Object.entries(provenance.sources)) assert.equal(await hash(resolve(root, path)), expected, path);
  for (const [path, expected] of Object.entries(provenance.localArtifacts)) assert.equal(await hash(resolve(root, path)), expected, path);
  const summary = await json(resolve(directory, 'run-summary.json'));
  const browser = await json(resolve(directory, 'browser.json'));
  assert.equal(await hash(resolve(root, 'dist/index.js')), summary.hashes.candidate);
  assert.equal(browser.bundleSha256, summary.hashes.candidate);
  assert.equal(browser.publicEntry, true);
}
console.log(`归档 ${Object.keys(lock.files).length} 份文件校验通过${process.argv.includes('--local') ? '；来源和本地产物一致' : ''}。`);
