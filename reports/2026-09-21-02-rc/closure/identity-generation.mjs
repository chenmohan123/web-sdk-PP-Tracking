import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const report = resolve(root, 'reports/2026-09-21-02-rc');
const temporary = resolve(root, '.tmp/tracking-02-rc');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => readFile(path, 'utf8').then(JSON.parse);
const save = (path, data) => writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
const walk = async base => {
  const files = [];
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (entry.isDirectory()) for (const child of await walk(resolve(base, entry.name))) files.push(`${entry.name}/${child}`);
    else if (entry.isFile()) files.push(entry.name);
  }
  return files.sort();
};
const hashes = async (base, paths) => Object.fromEntries(await Promise.all(paths.map(async path => {
  const bytes = await readFile(resolve(base, path));
  return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

await mkdir(report, { recursive: true });
const evaluatedCommit = '0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e';
const candidateCommit = git('rev-parse', 'HEAD');
assert.equal(git('diff', '--name-only', 'HEAD', '--', 'src', 'models', 'package.json', 'README.md', 'README.en.md', 'sdk-manifest.yaml', 'scripts/release.mjs', 'demo/src'), '', '候选代码尚有未提交改动');
const sourcePaths = git('ls-tree', '-r', '--name-only', candidateCommit, '--', 'src').split('\n');
assert.deepEqual(sourcePaths, git('ls-tree', '-r', '--name-only', evaluatedCommit, '--', 'src').split('\n'));
const changedFiles = [];
const sources = sourcePaths.map(path => {
  const evaluated = execFileSync('git', ['show', `${evaluatedCommit}:${path}`], { cwd: root });
  const candidate = execFileSync('git', ['show', `${candidateCommit}:${path}`], { cwd: root });
  if (!evaluated.equals(candidate)) changedFiles.push(path);
  const normalized = bytes => sha256(bytes.toString('utf8').replaceAll('0.2.0-alpha.0', '<候选版本>').replaceAll('0.2.0-rc.0', '<候选版本>'));
  assert.equal(normalized(evaluated), normalized(candidate), `运行逻辑改变：${path}`);
  return { path, evaluatedSha256: sha256(evaluated), candidateSha256: sha256(candidate),
    evaluatedNormalizedSha256: normalized(evaluated), candidateNormalizedSha256: normalized(candidate) };
});
assert.deepEqual(changedFiles, ['src/reid/ort.ts', 'src/reid/types.ts', 'src/tracker.ts', 'src/types.ts']);
assert.equal(git('diff', '--name-only', evaluatedCommit, candidateCommit, '--', 'models'), '');
await save(resolve(report, 'runtime-equivalence.json'), { evaluatedCommit, candidateCommit, changedFiles, modelFilesUnchanged: true, sources });
await writeFile(resolve(report, 'runtime-diff.patch'), execFileSync('git', ['diff', evaluatedCommit, candidateCommit, '--', 'src', 'models'], { cwd: root }));
const pkg = await json(resolve(root, '.tmp/package-check.json'));
assert.equal(pkg.filename, 'web-sdk-pp-tracking-0.2.0-rc.0.tgz');
await cp(resolve(root, '.tmp/package-check.json'), resolve(report, 'package-check.json'));
await cp(resolve(temporary, 'remote'), resolve(report, 'remote'), { recursive: true });
await mkdir(resolve(report, 'logs'), { recursive: true });
for (const path of ['release-red.txt', 'release-green.txt', 'verify.txt', 'verify-first-version-test-failure.txt', 'reid-demo.txt', 'source-identity-check.txt']) {
  await cp(resolve(temporary, path), resolve(report, 'logs', path));
}
for (const path of ['browser', 'reid-demo']) await cp(resolve(temporary, path), resolve(report, path), { recursive: true });
await mkdir(resolve(report, 'standard'), { recursive: true });
await cp('C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io/reports/sdk-standard/tracking-02-rc-before-20260921.json', resolve(report, 'standard/before.json'));
await cp(resolve(temporary, 'standard-after.json'), resolve(report, 'standard/after.json'));
await mkdir(resolve(report, 'closure'), { recursive: true });
await cp('C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io/.superpowers/sdd/2026-09-21-tracking-02-rc/task-1-report.md', resolve(report, 'closure/task-1-report.md'));
const inputs = ['package.json', 'README.md', 'README.en.md', 'LICENSE', 'NOTICE', 'sdk-manifest.yaml', 'scripts/release.mjs', '.github/workflows/release.yml', '.github/workflows/pages.yml', ...sourcePaths,
  ...git('ls-files', 'demo/src').split('\n'),
  ...git('ls-files', 'models').split('\n'),
  ...(await walk(resolve(root, 'dist'))).map(path => `dist/${path}`),
  ...(await walk(resolve(root, 'demo/dist'))).map(path => `demo/dist/${path}`)];
await save(resolve(report, 'identity.json'), { capturedAt: new Date().toISOString(), version: '0.2.0-rc.0', commit: candidateCommit,
  package: { filename: pkg.filename, sha256: pkg.sha256, integrity: pkg.integrity, bytes: pkg.size },
  files: await hashes(root, inputs) });
await save(resolve(report, 'evidence.lock.json'), { capturedAt: new Date().toISOString(),
  files: await hashes(report, (await walk(report)).filter(path => path !== 'evidence.lock.json')) });
console.log(`已记录 ${candidateCommit} 候选身份；新增报告后须重新生成 evidence.lock.json。`);
