import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateReleaseTag(tag, version) {
  assert.equal(tag, `v${version}`, '发布标签必须精确匹配 package.json 版本');
}

export function registryVersionState(result, expectedIntegrity) {
  if (result.status === 0) {
    const integrity = JSON.parse(result.stdout);
    assert.equal(typeof integrity, 'string', 'npm 未返回版本完整性');
    assert.equal(integrity, expectedIntegrity, '同版本 npm 包与候选不一致，禁止跳过或覆盖');
    return 'identical';
  }
  // npm --json 的错误对象是唯一可接受的缺版本证据，日志关键词不可信。
  let code;
  try { code = JSON.parse(result.stdout).error?.code; } catch { /* 非结构化错误必须失败。 */ }
  if (code === 'E404' || code === 'ENOVERSIONS') return 'missing';
  throw new Error(`npm 查询失败，禁止推断版本不存在：${code ?? result.error?.message ?? result.stderr ?? '未知错误'}`);
}

function npm(args) {
  assert(args.every(arg => /^[a-zA-Z0-9@/_.:=+-]+$/.test(arg)), 'npm 参数包含不允许的字符');
  return spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args, { encoding: 'utf8' });
}

export function publishCandidate({ packageInfo, info, bytes, runNpm = npm, wait = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000), attempts = 30 }) {
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  assert.equal(info.integrity, integrity, '候选 tarball 与包消费验证记录不一致');
  const query = () => runNpm(['view', `${packageInfo.name}@${packageInfo.version}`, 'dist.integrity', '--json', '--registry=https://registry.npmjs.org']);
  if (registryVersionState(query(), integrity) === 'identical') {
    console.log('npm 已存在相同完整性的版本，仅核验，不重复发布。');
    return 'verified-existing';
  }
  const published = runNpm(['publish', `.tmp/${info.filename}`, '--provenance', '--access', 'public', '--registry=https://registry.npmjs.org']);
  assert.equal(published.status, 0, `npm 发布失败：${published.stderr || published.stdout}`);
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (registryVersionState(query(), integrity) === 'identical') {
      console.log('npm OIDC 发布完成且完整性一致。');
      return 'published';
    }
    if (attempt + 1 < attempts) wait();
  }
  throw new Error('npm 已接受发布，但五分钟内版本元数据仍不可见；禁止再次发布，须人工核验');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const packageInfo = JSON.parse(readFileSync('package.json', 'utf8'));
  validateReleaseTag(process.env.RELEASE_TAG, packageInfo.version);
  if (!process.argv.includes('--validate-tag')) {
    const info = JSON.parse(readFileSync('.tmp/package-check.json', 'utf8'));
    assert.equal(info.filename, `${packageInfo.name}-${packageInfo.version}.tgz`);
    publishCandidate({ packageInfo, info, bytes: readFileSync(resolve('.tmp', info.filename)) });
  }
}
