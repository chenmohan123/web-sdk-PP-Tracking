import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

describe('真实评测 CLI 输出保护', () => {
  it('在读取数据或调用 Python 之前拒绝历史报告目录', () => {
    expect(() => execFileSync(process.execPath, ['scripts/evaluation/mot17/run.mjs', '--out', 'reports/2026-09-19-mot17/new-run'], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/复跑输出不得写入固定历史归档/);
  });

  it('在已有输出目录上失败，防止覆盖原始结果', () => {
    mkdirSync('.tmp', { recursive: true });
    const output = mkdtempSync(resolve('.tmp/mot17-test-'));
    try {
      expect(() => execFileSync(process.execPath, ['scripts/evaluation/mot17/run.mjs', '--out', output], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/EEXIST/);
    } finally { rmSync(output, { recursive: true }); }
  });

  it('所有下载和自动源码目标先验检查：拒绝报告树、外部、junction及已有目标，且不创建运行目录', () => {
    mkdirSync('.tmp', { recursive: true });
    const fixture = mkdtempSync(resolve('.tmp/mot17-boundary-'));
    const outside = mkdtempSync(resolve(tmpdir(), 'mot17-outside-'));
    const alias = resolve(fixture, 'alias');
    symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const existing = resolve(fixture, 'existing.zip');
    writeFileSync(existing, '保留');
    const run = (args: string[]) => spawnSync(process.execPath, ['scripts/evaluation/mot17/run.mjs', '--python', 'mot17-python-must-not-run', '--out', resolve(fixture, 'run'), ...args], { encoding: 'utf8' });
    try {
      for (const target of [resolve('reports/mot17-must-not-create.zip'), resolve(outside, 'labels.zip'), resolve(alias, 'labels.zip'), existing]) {
        const result = run(['--download-data', '--zip', target]);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/\.tmp|历史归档|EEXIST/);
        expect(existsSync(resolve(fixture, 'run'))).toBe(false);
        if (target !== existing) expect(existsSync(target)).toBe(false);
      }
      for (const target of [resolve('reports/mot17-must-not-create-source'), resolve(outside, 'TrackEval'), resolve(alias, 'TrackEval')]) {
        const result = run(['--zip', existing, '--trackeval', target]);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/\.tmp|历史归档/);
        expect(existsSync(resolve(fixture, 'run'))).toBe(false);
        expect(existsSync(target)).toBe(false);
      }
    } finally {
      rmSync(fixture, { recursive: true });
      rmSync(outside, { recursive: true });
    }
  });

  it('外部已有ZIP和评分checkout作为只读输入不会被写入位置规则误拒绝', () => {
    mkdirSync('.tmp', { recursive: true });
    const fixture = mkdtempSync(resolve('.tmp/mot17-readonly-'));
    const outside = mkdtempSync(resolve(tmpdir(), 'mot17-readonly-'));
    const zip = resolve(outside, 'input.zip');
    writeFileSync(zip, '原创测试占位，不进入真实提取');
    try {
      const result = spawnSync(process.execPath, ['scripts/evaluation/mot17/run.mjs', '--python', 'mot17-python-must-not-run', '--out', resolve(fixture, 'run'), '--zip', zip, '--trackeval', outside], { encoding: 'utf8' });
      expect(result.stderr).toMatch(/prepare 失败/);
      expect(existsSync(resolve(fixture, 'run/prepare.log'))).toBe(true);
    } finally {
      rmSync(fixture, { recursive: true });
      rmSync(outside, { recursive: true });
    }
  });
});
