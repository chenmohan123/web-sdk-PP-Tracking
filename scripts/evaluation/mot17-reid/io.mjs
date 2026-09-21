import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { protectOutput } from '../output-path.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export async function verifyFile(file, pin) {
  const bytes = await fs.readFile(file);
  if (!pin || bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`文件身份校验失败：${file}`);
  return bytes;
}

export async function newOutput(root, target) {
  const resolvedRoot = await fs.realpath(root);
  const actual = protectOutput(target, path.join(resolvedRoot, 'reports'));
  const relative = path.relative(path.join(resolvedRoot, '.tmp'), actual);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('输出必须位于本仓库 .tmp 内');
  try { await fs.lstat(actual); } catch (error) { if (error.code === 'ENOENT') return actual; throw error; }
  throw new Error(`EEXIST: 不覆盖已有目标 ${actual}`);
}

export async function save(root, target, value) {
  const actual = await newOutput(root, target);
  await fs.mkdir(path.dirname(actual), { recursive: true });
  await fs.writeFile(await newOutput(root, actual), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
