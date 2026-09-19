import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { protectOutput, writeReport as writeProtectedReport } from './output-path.mjs';

export const sdkRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const archiveRoot = path.join(sdkRoot, 'reports/2026-09-19-desktop');
export const writeReport = (output, content) => writeProtectedReport(output, content, archiveRoot);

// 参数只控制本地输入输出；复跑结果默认写入忽略目录，不覆盖历史测量。
export function options(defaults) {
  const result = { ...defaults };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !Object.hasOwn(defaults, key) || !args[i + 1]) {
      throw new Error(`无效参数 ${args[i]}；支持 ${Object.keys(defaults).map(x => '--' + x).join('、')}`);
    }
    result[key] = path.resolve(args[i + 1]);
  }
  if (result.out) protectOutput(result.out, archiveRoot);
  return result;
}
