// 维护者归档工具；仅收集已完成验证的机器记录，不提交模型或图像。
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const work = new URL('../../.tmp/reid-module/', root);
const evidence = new URL('evidence/', root);
await mkdir(evidence, { recursive: true });
for (const name of ['browser-result.json.gz', 'environment.json', 'validation.json', 'sdk-verify.log', 'candidate-browser.log']) {
  await copyFile(new URL(name, work), new URL(name, evidence));
}
await copyFile(new URL('../../.tmp/reid-module-browser-red.log', root), new URL('browser-red.log', evidence));
await copyFile(new URL('../../.tmp/package-check.json', root), new URL('package-check.json', evidence));
await copyFile(new URL('../../.tmp/browser/report.json', root), new URL('sdk-browser.json', evidence));
const rows = [];
for (const name of (await readdir(evidence)).sort()) {
  const data = await readFile(new URL(name, evidence));
  rows.push({ path: `evidence/${name}`, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
for (const path of ['protocol.md', 'verify_archive.mjs', 'archive.mjs', 'summarize.mjs', ...(await readdir(root)).filter(name => name.endsWith('.log'))]) {
  const data = await readFile(new URL(path, root));
  rows.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(new URL('evidence.lock.json', root), JSON.stringify(rows, null, 2) + '\n');
console.log(`已固定 ${rows.length} 份归档文件的字节身份。`);
