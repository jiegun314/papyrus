/**
 * vite.config.ts —— 前端 React 应用构建配置（根配置）。
 * - root 指向 src/client（index.html 所在目录）
 * - 开发模式默认 http://localhost:5173，/api 与 /covers 代理到后端 3000
 * - 构建产物输出到 dist/client，由 Express 在生产环境静态托管
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const clientRoot = fileURLToPath(new URL('./src/client', import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 后端 API 与本地封面缓存
      '/api': 'http://localhost:3000',
      '/covers': 'http://localhost:3000',
    },
  },
  build: {
    outDir: resolve(clientRoot, '../../dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
