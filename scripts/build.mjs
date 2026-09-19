import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
for (const [format, extension] of [['esm', 'js'], ['cjs', 'cjs']]) {
  await build({ entryPoints: ['src/index.ts'], bundle: true, platform: 'neutral', format, target: 'es2022', outfile: `dist/index.${extension}` });
}
const types = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', '--declaration', '--emitDeclarationOnly', '--newLine', 'lf', '--outDir', 'dist', 'src/index.ts'], { stdio: 'inherit' });
if (types.status !== 0) process.exit(types.status ?? 1);
console.log('ESM、CommonJS 与类型声明构建完成。');
