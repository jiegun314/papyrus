/**
 * server/index.ts
 * ------------------------------------------------------------------
 * 服务入口。启动命令：npm run dev（开发） / npm run build && npm start（生产）
 */
import { createApp } from './app.js';
import { closeDb, DB_PATH, ROOT_DIR } from './db/index.js';

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  📚  Papyrus 个人书籍管理系统已启动                    │');
  console.log('└──────────────────────────────────────────────────────┘');
  console.log(`    Web 界面 : http://localhost:${PORT}`);
  console.log(`    数据库   : ${DB_PATH}`);
  console.log(`    数据目录 : ${ROOT_DIR}`);
});

// 启动失败（如端口被占用）时给出清晰提示，而不是抛未处理的 error 堆栈
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`❌ 端口 ${PORT} 已被占用，可能有另一个 Papyrus 实例正在运行。`);
    console.error(`   解决方法（任选其一）：`);
    console.error(`   1) 结束占用端口的旧进程后重试，例如：`);
    console.error(`      lsof -nP -iTCP:${PORT} -sTCP:LISTEN   # 查看占用进程 PID`);
    console.error(`      kill <PID>`);
    console.error(`   2) 换个端口启动：`);
    console.error(`      PORT=${Number(PORT) + 1} npm run dev`);
    console.error('');
  } else {
    console.error('[papyrus] 服务器启动失败:', err);
  }
  closeDb();
  process.exit(1);
});

// 优雅退出：关闭数据库
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  });
}

// 兜底：捕获未处理异常 / 未捕获的 Promise 拒绝。
// 默认 Node 行为会直接崩溃（exit 1），这里补一行可读的堆栈便于排查——
// 否则进程会“静默死亡”，tsx watch 的父进程仍在、但其后端子进程已消失，
// 表现为 3000 端口突然 404，这也是此前“页面空白 / API 失效”的一个来源。
process.on('uncaughtException', (err) => {
  console.error('[papyrus] 未捕获异常，进程将退出:', err);
  try { closeDb(); } catch { /* 忽略二次错误 */ }
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[papyrus] 未处理的 Promise 拒绝，进程将退出:', reason);
  try { closeDb(); } catch { /* 忽略二次错误 */ }
  process.exit(1);
});
