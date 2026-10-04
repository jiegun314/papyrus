/**
 * routes/export.ts
 * ------------------------------------------------------------------
 * 离线快照导出接口：
 *   GET /api/export/data —— 一次性返回整库数据（书籍 + 分类 + 标签 + 统计），
 *   供前端在浏览器里组装成单文件 HTML 快照（封面缩图在前端用 canvas 完成，
 *   因此服务端不需要任何图像处理依赖）。
 *
 * 说明：封面路径仍是 /covers/xxx 这样的相对地址，前端导出时会替换为内嵌缩略图；
 * 电子书文件不参与导出（体积不可控），快照里只保留文件名与大小信息。
 */
import { Router } from 'express';
import { getStats, listAllBooks, listCategories, listTags } from '../services/bookService.js';
import { APP_VERSION } from '../services/serverInfo.js';
import type { SnapshotData } from '../../shared/types.js';

export const exportRouter = Router();

// GET /api/export/data
exportRouter.get('/data', async (_req, res) => {
  try {
    const [books, categories, tags, stats] = await Promise.all([
      listAllBooks(),
      listCategories(),
      listTags(),
      getStats(),
    ]);
    const payload: SnapshotData = {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      books,
      categories,
      tags,
      stats,
    };
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '导出数据失败' });
  }
});
