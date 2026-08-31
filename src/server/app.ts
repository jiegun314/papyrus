/**
 * server/app.ts
 * ------------------------------------------------------------------
 * Express 应用装配：静态资源、API 路由、JSON 解析、错误处理。
 */
import express from 'express';
import path from 'node:path';
import { booksRouter } from './routes/books.js';
import { doubanRouter } from './routes/douban.js';
import { metaRouter } from './routes/meta.js';
import { ROOT_DIR, COVERS_DIR, getDb } from './db/index.js';

export function createApp(): express.Express {
  const app = express();

  // 确保数据库初始化（建表 + 种子数据）
  getDb();

  // 中间件
  app.use(express.json({ limit: '2mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // 本地封面缓存
  app.use('/covers', express.static(COVERS_DIR, { maxAge: '30d', immutable: true }));

  // API 路由
  app.use('/api/books', booksRouter);
  app.use('/api/douban', doubanRouter);
  app.use('/api', metaRouter);

  // 健康检查
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // 前端静态资源（public/）
  const publicDir = path.join(ROOT_DIR, 'public');
  app.use(express.static(publicDir));

  // SPA 兜底：未匹配的 GET 请求返回 index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
      if (err) next();
    });
  });

  // 统一错误处理
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[papyrus] 服务器错误:', err);
    res.status(500).json({ error: err.message || '服务器内部错误' });
  });

  return app;
}
