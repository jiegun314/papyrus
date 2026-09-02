#!/usr/bin/env node
/**
 * scripts/dev.mjs —— 开发模式：同时启动后端（tsx watch）与前端（Vite dev server，HMR）。
 * 用法：npm run dev
 *
 * 浏览器访问 http://localhost:5173（Vite 已将 /api 与 /covers 代理到后端 3000）。
 * 后端监听 3000，仅提供 API 与本地封面；Ctrl+C 时一并退出两个进程。
 */
import { spawn } from 'node:child_process';

/** 跨平台解析 node_modules/.bin 下的可执行文件 */
const bin = (name) =>
  process.platform === 'win32' ? `node_modules/.bin/${name}.cmd` : `node_modules/.bin/${name}`;

const children = [
  // 后端：Express + SQLite，tsx watch 自动重启
  spawn(bin('tsx'), ['watch', 'src/server/index.ts'], { stdio: 'inherit' }),
  // 前端：Vite dev server（React HMR）
  spawn(bin('vite'), [], { stdio: 'inherit' }),
];

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

for (const c of children) {
  c.on('error', (err) => {
    console.error(`[dev] 子进程启动失败: ${err.message}`);
    shutdown();
  });
  c.on('exit', (code) => {
    if (!stopping && code && code !== 0) {
      console.error(`[dev] 子进程异常退出 (code=${code})，停止 dev。`);
      shutdown();
    }
  });
}

