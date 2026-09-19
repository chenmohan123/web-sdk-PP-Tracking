import fs from 'node:fs/promises';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

// 目标可能尚不存在：从最近的既有祖先解析junction/symlink，再接回未建部分。
function resolvedPath(target) {
  let ancestor = path.resolve(target);
  const missing = [];
  while (true) {
    try { lstatSync(ancestor); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      missing.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
  // 悬空链接不会被当作普通的未建目录；realpath失败时直接拒绝。
  return path.join(realpathSync.native(ancestor), ...missing);
}

export function protectOutput(output, archive) {
  const actualOutput = resolvedPath(output);
  const actualArchive = resolvedPath(archive);
  const fold = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const relative = path.relative(fold(actualArchive), fold(actualOutput));
  if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('复跑输出不得写入固定历史归档，请使用 .tmp 中的新文件');
  }
  return actualOutput;
}

export async function writeReport(output, content, archive) {
  const target = protectOutput(output, archive);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const checked = protectOutput(target, archive);
  // 排他创建阻止已有文件、硬链接及检查后的既有文件别名被覆盖。
  await fs.writeFile(checked, content, { flag: 'wx' });
}
