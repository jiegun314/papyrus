/**
 * vite.config.ts —— 前端 React 应用构建配置（根配置）。
 * - root 指向 src/client（index.html 所在目录）
 * - 开发模式默认 http://localhost:5173，/api 与 /covers 代理到后端 3000
 * - 若在项目根目录存在 certs/{key,cert}.pem（可用 npm run certs 生成），则 Vite 自动切换为
 *   HTTPS（https://localhost:5173），并监听局域网网卡，供安卓手机通过 https://<局域网IP>:5173
 *   访问以启用摄像头扫码（getUserMedia 仅在安全上下文可用）。否则维持 http://localhost:5173。
 * - 构建产物输出到 dist/client，由 Express 在生产环境静态托管
 */
import * as fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const configDir = fileURLToPath(new URL('.', import.meta.url));
const clientRoot = fileURLToPath(new URL('./src/client', import.meta.url));

// 存在证书时启用 HTTPS：本地生成一次即可（npm run certs）。
const keyPath = resolve(configDir, 'certs/key.pem');
const certPath = resolve(configDir, 'certs/cert.pem');
const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);

/**
 * Vite root 是 src/client，因此前端自己的源码模块（src/client/api/books.ts 等）
 * 在浏览器里的加载路径恰好是 /api/books.ts，与下方 server.proxy 的 '/api' 前缀冲突：
 * 若不处理，这类模块请求会被代理到后端 3000 而 404，导致页面空白。
 * 后端 API 的真实调用路径（/api/books、/api/stats、/api/douban/search …）一律不带源码扩展名，
 * 所以凡带 .ts/.tsx/.js/.jsx 等扩展名的 /api 请求都视为前端模块，bypass 代理交由 Vite 本地提供。
 */
function isClientSourceModule(url: string): boolean {
  return /^\/api\/[^?#]*\.(ts|tsx|js|jsx|mjs|cjs)(\?|$)/.test(url);
}

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  server: {
    // 有证书时启用 HTTPS 并监听局域网网卡（host: true），供安卓手机访问；否则维持仅本机可访问。
    host: useHttps ? true : undefined,
    port: 5173,
    https: useHttps
      ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
      : undefined,
    proxy: {
      // 后端 API 与本地封面缓存
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        bypass: (req) => (isClientSourceModule(req.url ?? '') ? req.url : undefined),
      },
      '/covers': 'http://localhost:3000',
    },
  },
  build: {
    outDir: resolve(clientRoot, '../../dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
