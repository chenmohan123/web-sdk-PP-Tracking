import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const args = process.argv.slice(2);
assert(args.every(arg => arg === '--current'), '仅支持可选 --current');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (base, path) => {
  const target = resolve(base, path);
  const rel = relative(base, target);
  assert(!rel.startsWith('..') && !isAbsolute(rel), `路径越界：${path}`);
  return target;
};
const check = async (base, files) => {
  for (const [path, expected] of Object.entries(files)) {
    const bytes = await readFile(within(base, path));
    assert.equal(bytes.length, expected.bytes, `字节数不匹配：${path}`);
    assert.equal(hash(bytes), expected.sha256, `SHA256 不匹配：${path}`);
  }
};

const lock = await readJson(resolve(here, 'evidence.lock.json'));
await check(here, lock.files);
const identity = await readJson(resolve(here, 'identity.json'));
const equivalence = await readJson(resolve(here, 'runtime-equivalence.json'));
const pkg = await readJson(resolve(here, 'package-check.json'));
assert.equal(identity.version, '0.2.0-rc.0');
assert.equal(pkg.filename, 'web-sdk-pp-tracking-0.2.0-rc.0.tgz');
assert.equal(identity.package.sha256, pkg.sha256);
assert.equal(identity.package.integrity, pkg.integrity);
assert.equal(equivalence.candidateCommit, identity.commit);
assert.equal(equivalence.evaluatedCommit, '0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e');
assert.deepEqual(equivalence.changedFiles, ['src/reid/ort.ts', 'src/reid/types.ts', 'src/tracker.ts', 'src/types.ts']);
assert(equivalence.sources.length > 0);
for (const entry of equivalence.sources) {
  assert.equal(entry.evaluatedNormalizedSha256, entry.candidateNormalizedSha256, entry.path);
}
assert.equal(equivalence.modelFilesUnchanged, true);
if (args.includes('--current')) {
  await check(root, identity.files);
  const bytes = await readFile(within(root, `.tmp/${pkg.filename}`));
  assert.equal(bytes.length, pkg.size, '当前候选包字节数不匹配');
  assert.equal(hash(bytes), pkg.sha256, '当前候选包 SHA256 不匹配');
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, pkg.integrity);
}
console.log(JSON.stringify({ status: '通过', archivedFiles: Object.keys(lock.files).length,
  currentFiles: args.includes('--current') ? Object.keys(identity.files).length : null,
  version: identity.version, commit: identity.commit,
  scope: '哈希和版本标识等价记录核验，不重新运行浏览器、MOT 评测或远程发布' }, null, 2));
