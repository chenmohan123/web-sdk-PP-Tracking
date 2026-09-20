import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// 候选目录与正式 dist 隔离；仅开发依赖包含 ORT，包 exports 与 files 不变。
await mkdir('.tmp/reid-module/dist', { recursive: true });
await build({ entryPoints: ['src/reid/index.ts'], outfile: '.tmp/reid-module/dist/reid.js', bundle: true, platform: 'neutral', format: 'esm', target: 'es2022', external: ['onnxruntime-web', 'onnxruntime-web/*'] });
const types = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', '--declaration', '--emitDeclarationOnly', '--newLine', 'lf', '--outDir', '.tmp/reid-module/dist/types', 'src/reid/index.ts'], { stdio: 'inherit' });
if (types.status !== 0) process.exit(types.status ?? 1);
console.log('ReID 候选 ESM 与类型声明已构建到 .tmp/reid-module/dist；尚未正式导出。');
