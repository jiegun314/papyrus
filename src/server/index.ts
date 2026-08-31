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

// 优雅退出：关闭数据库
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  });
}
