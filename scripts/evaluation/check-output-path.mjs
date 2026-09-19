import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import * as evaluation from './options.mjs';

const scratch = await fs.mkdtemp(path.join(evaluation.sdkRoot, '.tmp/output-safety-'));
const alias = path.join(scratch, 'archive-alias');
await fs.symlink(evaluation.archiveRoot, alias, 'junction');
function parse(out) {
  const previous = process.argv;
  try { process.argv = ['node', 'check', '--out', out]; return evaluation.options({ out: '' }); }
  finally { process.argv = previous; }
}
test('拒绝规范归档路径及归档目录本身', () => {
  for (const out of [evaluation.archiveRoot, path.join(evaluation.archiveRoot, 'benchmark.json')]) assert.throws(() => parse(out), /归档/);
});
test('拒绝Windows大小写别名', { skip: process.platform !== 'win32' }, () => {
  assert.throws(() => parse(path.join(evaluation.archiveRoot, 'benchmark.json').toLowerCase()), /归档/);
});
test('拒绝junction别名及其尚不存在的子目录', () => {
  for (const out of [path.join(alias, 'benchmark.json'), path.join(alias, 'new-directory/new.json')]) assert.throws(() => parse(out), /归档/);
});
test('允许.tmp新输出，写入时仍拒绝归档别名且不覆盖既有文件', async () => {
  const output = path.join(scratch, 'new/result.json');
  assert.equal(parse(output).out, output);
  await evaluation.writeReport(output, '首份输出');
  await assert.rejects(evaluation.writeReport(output, '覆盖输出'), /EEXIST/);
  assert.equal(await fs.readFile(output, 'utf8'), '首份输出');
  await assert.rejects(evaluation.writeReport(path.join(alias, 'new-directory/new.json'), '禁止写入'), /归档/);
});
