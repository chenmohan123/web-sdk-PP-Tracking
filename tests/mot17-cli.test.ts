import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
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
});
