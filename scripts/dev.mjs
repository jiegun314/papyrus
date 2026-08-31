#!/usr/bin/env node
/**
 * scripts/dev.mjs —— 开发模式：同时监听前端（esbuild --watch）与后端（tsx watch）。
 * 用法：npm run dev
 *
 * 之前 dev 只跑 `tsx watch src/server/index.ts`，改前端代码不会自动重新打包；
 * 本脚本改为并行启动两个 watcher，Ctrl+C 时一并退出。
 */
import { spawn } from 'node:child_process';

/** 跨平台解析 node_modules/.bin 下的可执行文件 */
const bin = (name) =>
  process.platform === 'win32' ? `node_modules/.bin/${name}.cmd` : `node_modules/.bin/${name}`;

const children = [
  // 前端：打包为 public/app.js（带 sourcemap），改动自动重建
  spawn(
    bin('esbuild'),
    ['src/frontend/main.ts', '--bundle', '--sourcemap', '--watch=forever', '--outfile=public/app.js'],
    { stdio: 'inherit' }
  ),
  // 后端：tsx watch 自动重启
  spawn(bin('tsx'), ['watch', 'src/server/index.ts'], { stdio: 'inherit' }),
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
