/**
 * server/routes/meta.ts
 * ------------------------------------------------------------------
 * 分类、标签、统计信息 API。
 */
import { Router } from 'express';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listTags, deleteTag, getStats,
} from '../services/bookService.js';

export const metaRouter = Router();

/* ---------- 分类 ---------- */

// GET /api/categories
metaRouter.get('/categories', async (_req, res) => {
  try {
    res.json(await listCategories());
  } catch (e: any) {
    res.status(500).json({ error: e.message || '查询分类失败' });
  }
});

// POST /api/categories  body: { name, color? }
metaRouter.post('/categories', async (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: '分类名不能为空' });
  try {
    const id = await createCategory(name, req.body?.color);
    res.status(201).json({ id });
  } catch (e: any) {
    const msg = String(e.message || '');
    if (msg.includes('UNIQUE')) return res.status(400).json({ error: '该分类已存在' });
    if (msg.includes('颜色')) return res.status(400).json({ error: msg });
    res.status(500).json({ error: msg || '创建失败' });
  }
});

// PUT /api/categories/:id  body: { name?, color? }
metaRouter.put('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const cat = await updateCategory(id, req.body?.name, req.body?.color);
    if (!cat) return res.status(404).json({ error: '分类不存在' });
    res.json(cat);
  } catch (e: any) {
    const msg = String(e.message || '');
    if (msg.includes('颜色')) return res.status(400).json({ error: msg });
    res.status(500).json({ error: msg || '更新失败' });
  }
});

// DELETE /api/categories/:id
metaRouter.delete('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (!(await deleteCategory(id))) return res.status(404).json({ error: '分类不存在' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '删除分类失败' });
  }
});

/* ---------- 标签 ---------- */

// GET /api/tags
metaRouter.get('/tags', async (_req, res) => {
  try {
    res.json(await listTags());
  } catch (e: any) {
    res.status(500).json({ error: e.message || '查询标签失败' });
  }
});

// DELETE /api/tags/:id
metaRouter.delete('/tags/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (!(await deleteTag(id))) return res.status(404).json({ error: '标签不存在' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || '删除标签失败' });
  }
});

/* ---------- 统计 ---------- */

// GET /api/stats
metaRouter.get('/stats', async (_req, res) => {
  try {
    res.json(await getStats());
  } catch (e: any) {
    res.status(500).json({ error: e.message || '查询统计失败' });
  }
});
