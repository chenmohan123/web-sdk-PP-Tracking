import { describe, expect, it } from 'vitest';
// @ts-expect-error 发布脚本由 Node 原生执行，测试只消费纯函数。
import { publishCandidate, registryVersionState, validateReleaseTag } from '../scripts/release.mjs';
import { createHash } from 'node:crypto';

describe('发布候选完整性门禁', () => {
  const integrity = 'sha512-YWJj';
  it.each([['0.2.0-alpha.0', 'next'], ['0.2.0-rc.0', 'next'], ['0.2.0', 'latest']])('版本 %s 显式发布到 %s 通道且已有版本只读', (version, tag) => {
    const bytes = Buffer.from('发布通道候选字节');
    const hash = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    const candidate = { bytes, packageInfo: { name: 'web-sdk-pp-tracking', version }, info: { filename: `web-sdk-pp-tracking-${version}.tgz`, integrity: hash } };
    const present = { status: 0, stdout: JSON.stringify(hash), stderr: '' };
    const missing = { status: 1, stdout: '{"error":{"code":"E404"}}', stderr: '' };
    const calls: string[][] = [];
    const results = [missing, { status: 0, stdout: '', stderr: '' }, present];
    expect(publishCandidate({ ...candidate, runNpm: (args: string[]) => { calls.push(args); return results.shift(); } })).toBe('published');
    expect(calls[1]).toEqual(['publish', `.tmp/${candidate.info.filename}`, '--provenance', '--access', 'public', '--tag', tag, '--registry=https://registry.npmjs.org']);
    calls.length = 0;
    expect(publishCandidate({ ...candidate, runNpm: (args: string[]) => { calls.push(args); return present; } })).toBe('verified-existing');
    expect(calls.map(args => args[0])).toEqual(['view']);
    expect(() => validateReleaseTag(`v${version}`, version)).not.toThrow();
    expect(() => validateReleaseTag('v0.1.0', version)).toThrow();
  });
  it('标签必须精确匹配包版本', () => {
    expect(() => validateReleaseTag('v0.1.0', '0.1.0')).not.toThrow();
    for (const tag of ['', '0.1.0', 'v0.2.0']) expect(() => validateReleaseTag(tag, '0.1.0')).toThrow();
  });
  it('只对相同完整性的已存在版本跳过发布', () => {
    expect(registryVersionState({ status: 0, stdout: JSON.stringify(integrity), stderr: '' }, integrity)).toBe('identical');
    expect(() => registryVersionState({ status: 0, stdout: '"sha512-other"', stderr: '' }, integrity)).toThrow();
    expect(() => registryVersionState({ status: 0, stdout: 'null', stderr: '' }, integrity)).toThrow();
  });
  it('仅接受结构化 E404 或 ENOVERSIONS 缺失响应', () => {
    for (const code of ['E404', 'ENOVERSIONS']) expect(registryVersionState({ status: 1, stdout: JSON.stringify({ error: { code } }), stderr: '' }, integrity)).toBe('missing');
  });
  it('网络、权限、无结构错误及损坏 JSON 都阻止发布', () => {
    for (const code of ['E401', 'E403', 'ETIMEDOUT', 'ECONNRESET']) expect(() => registryVersionState({ status: 1, stdout: JSON.stringify({ error: { code } }), stderr: '' }, integrity)).toThrow();
    expect(() => registryVersionState({ status: 1, stdout: '', stderr: 'E404 网络代理错误' }, integrity)).toThrow();
    expect(() => registryVersionState({ status: 0, stdout: 'invalid', stderr: '' }, integrity)).toThrow();
  });
  it('已有版本不发布，新版本发布后核验，真实发布错误不吞掉', () => {
    const bytes = Buffer.from('候选字节');
    const hash = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    const candidate = { bytes, packageInfo: { name: 'web-sdk-pp-tracking', version: '0.1.0' }, info: { filename: 'web-sdk-pp-tracking-0.1.0.tgz', integrity: hash } };
    const present = { status: 0, stdout: JSON.stringify(hash), stderr: '' };
    const missing = { status: 1, stdout: '{"error":{"code":"E404"}}', stderr: '' };
    const calls: string[][] = [];
    expect(publishCandidate({ ...candidate, runNpm: (args: string[]) => { calls.push(args); return present; } })).toBe('verified-existing');
    expect(calls.map(args => args[0])).toEqual(['view']);
    calls.length = 0;
    const results = [missing, { status: 0, stdout: '', stderr: '' }, missing, present];
    expect(publishCandidate({ ...candidate, wait: () => {}, runNpm: (args: string[]) => { calls.push(args); return results.shift(); } })).toBe('published');
    expect(calls.map(args => args[0])).toEqual(['view', 'publish', 'view', 'view']);
    const failures = [missing, { status: 1, stdout: '', stderr: 'E403' }];
    expect(() => publishCandidate({ ...candidate, runNpm: () => failures.shift() })).toThrow(/发布失败/);
    expect(() => publishCandidate({ ...candidate, bytes: Buffer.from('不同字节'), runNpm: () => present })).toThrow(/候选 tarball/);
    const invisible = [missing, { status: 0, stdout: '', stderr: '' }, missing];
    expect(() => publishCandidate({ ...candidate, attempts: 1, wait: () => {}, runNpm: () => invisible.shift() })).toThrow(/禁止再次发布/);
  });
});
