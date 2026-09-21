import { build } from 'esbuild';
import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
for (const [format, extension] of [['esm', 'js'], ['cjs', 'cjs']]) {
  await build({ entryPoints: ['src/index.ts'], bundle: true, platform: 'neutral', format, target: 'es2022', outfile: `dist/index.${extension}` });
  await build({ entryPoints: ['src/reid/index.ts'], bundle: true, platform: 'neutral', format, target: 'es2022', outfile: `dist/reid/index.${extension}`, external: ['onnxruntime-web', 'onnxruntime-web/*'] });
}
// JSON 只打入运行时 bundle；声明先输出到临时目录，避免把模型目录带入包。
await rm('.tmp/package-types', { recursive: true, force: true });
const types = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--resolveJsonModule', '--strict', '--skipLibCheck', '--declaration', '--emitDeclarationOnly', '--newLine', 'lf', '--rootDir', '.', '--outDir', '.tmp/package-types', 'src/index.ts', 'src/reid/index.ts'], { stdio: 'inherit' });
if (types.status !== 0) process.exit(types.status ?? 1);
await cp('.tmp/package-types/src', 'dist', { recursive: true });
// 声明需兼容 NodeNext 消费，补全历史候选模块使用的无扩展名相对导入。
for (const file of await readdir('dist', { recursive: true })) {
  if (!file.endsWith('.d.ts')) continue;
  const path = join('dist', file);
  const content = await readFile(path, 'utf8');
  await writeFile(path, content.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (match, before, specifier, after) => /\.[a-z]+$/i.test(specifier) ? match : `${before}${specifier}.js${after}`));
}
console.log('算法与 ReID 独立 ESM、CommonJS 和 NodeNext 类型声明构建完成。');
