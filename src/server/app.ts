/**
 * server/app.ts
 * ------------------------------------------------------------------
 * Express 应用装配：静态资源、API 路由、JSON 解析、错误处理。
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { booksRouter } from './routes/books.js';
import { doubanRouter } from './routes/douban.js';
import { amazonRouter } from './routes/amazon.js';
import { openLibraryRouter } from './routes/openLibrary.js';
import { metaRouter } from './routes/meta.js';
import { ROOT_DIR, COVERS_DIR, EBOOKS_DIR, getDb } from './db/index.js';

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

  // 电子书文件（在线预览：直接以静态资源暴露；下载走 /api/books/:id/ebook/download）
  app.use('/ebooks', express.static(EBOOKS_DIR));

  // API 路由
  app.use('/api/books', booksRouter);
  app.use('/api/douban', doubanRouter);
  app.use('/api/amazon', amazonRouter);
  app.use('/api/ol', openLibraryRouter);
  app.use('/api', metaRouter);

  // 健康检查
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // React 前端静态资源（dist/client，由 vite build 产出）
  const clientDir = path.join(ROOT_DIR, 'dist', 'client');
  const clientIndex = path.join(clientDir, 'index.html');
  const clientBuilt = fs.existsSync(clientIndex);

  if (clientBuilt) {
    app.use(express.static(clientDir));

    // SPA 兜底：浏览器路由（如 /tags 直接刷新）未匹配到文件时返回 index.html
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api/') || req.path.startsWith('/covers/') || req.path.startsWith('/ebooks/')) return next();
      res.sendFile(clientIndex, (err) => {
        if (err) next();
      });
    });
  }

  // 统一错误处理
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[papyrus] 服务器错误:', err);
    res.status(500).json({ error: err.message || '服务器内部错误' });
  });

  return app;
}
