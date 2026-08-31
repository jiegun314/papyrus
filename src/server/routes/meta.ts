/**
 * server/routes/meta.ts
 * ------------------------------------------------------------------
 * 分类、标签、借阅记录、统计信息 API。
 */
import { Router } from 'express';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listTags, deleteTag, listLendings, getStats,
} from '../services/bookService.js';

export const metaRouter = Router();

/* ---------- 分类 ---------- */

// GET /api/categories
metaRouter.get('/categories', (_req, res) => {
  res.json(listCategories());
});

// POST /api/categories  body: { name, color? }
metaRouter.post('/categories', (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: '分类名不能为空' });
  try {
    const id = createCategory(name, req.body?.color);
    res.status(201).json({ id });
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: '该分类已存在' });
    }
    res.status(500).json({ error: e.message || '创建失败' });
  }
});

// PUT /api/categories/:id  body: { name?, color? }
metaRouter.put('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  const cat = updateCategory(id, req.body?.name, req.body?.color);
  if (!cat) return res.status(404).json({ error: '分类不存在' });
  res.json(cat);
});

// DELETE /api/categories/:id
metaRouter.delete('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!deleteCategory(id)) return res.status(404).json({ error: '分类不存在' });
  res.json({ ok: true });
});

/* ---------- 标签 ---------- */

// GET /api/tags
metaRouter.get('/tags', (_req, res) => {
  res.json(listTags());
});

// DELETE /api/tags/:id
metaRouter.delete('/tags/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!deleteTag(id)) return res.status(404).json({ error: '标签不存在' });
  res.json({ ok: true });
});

/* ---------- 借阅记录 ---------- */

// GET /api/lendings?status=borrowed|returned
metaRouter.get('/lendings', (req, res) => {
  const status = req.query.status;
  const s = status === 'borrowed' || status === 'returned' ? status : undefined;
  res.json(listLendings(s));
});

/* ---------- 统计 ---------- */

// GET /api/stats
metaRouter.get('/stats', (_req, res) => {
  res.json(getStats());
});
