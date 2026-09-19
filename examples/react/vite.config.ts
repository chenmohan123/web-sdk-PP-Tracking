// React 示例直接构建完整 Demo，避免两套交互实现漂移。
import config from '../../demo/vite.config';
import { defineConfig } from 'vite';
export default defineConfig({ ...config, build: { outDir: '../examples/react/dist', emptyOutDir: true } });
