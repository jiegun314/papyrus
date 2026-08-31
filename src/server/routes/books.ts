/**
 * server/routes/books.ts
 * ------------------------------------------------------------------
 * 书籍相关 API：增删改查、标签、归类、借出/归还、书评。
 */
import { Router } from 'express';
import {
  listBooks, getBook, createBook, updateBook, deleteBook,
  setBookTags, setBookCategory, borrowBook, returnBook,
  addReview, updateReview, deleteReview,
} from '../services/bookService.js';
import type { BookInput } from '../../shared/types.js';

export const booksRouter = Router();

/* ---------- 列表 ---------- */

// GET /api/books?keyword=&categoryId=&tagId=&status=&limit=&offset=
booksRouter.get('/', (req, res) => {
  const { keyword, categoryId, tagId, status, limit, offset } = req.query;
  const books = listBooks({
    keyword: typeof keyword === 'string' ? keyword : undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    tagId: tagId ? Number(tagId) : undefined,
    status: status === 'in' || status === 'out' ? status : undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  res.json(books);
});

/* ---------- 详情 ---------- */

// GET /api/books/:id
booksRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的书籍 id' });
  const book = getBook(id);
  if (!book) return res.status(404).json({ error: '书籍不存在' });
  res.json(book);
});

/* ---------- 新建 ---------- */

// POST /api/books  手动录入书籍
booksRouter.post('/', (req, res) => {
  const input = req.body as BookInput;
  if (!input?.title?.trim()) return res.status(400).json({ error: '书名不能为空' });
  try {
    const id = createBook({ ...input, authors: input.authors ?? [] });
    res.status(201).json(getBook(id));
  } catch (e: any) {
    res.status(500).json({ error: e.message || '保存失败' });
  }
});

/* ---------- 修改 / 删除 ---------- */

// PUT /api/books/:id
booksRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  try {
    const book = updateBook(id, req.body as BookInput);
    if (!book) return res.status(404).json({ error: '书籍不存在' });
    res.json(book);
  } catch (e: any) {
    res.status(500).json({ error: e.message || '更新失败' });
  }
});

// DELETE /api/books/:id
booksRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!deleteBook(id)) return res.status(404).json({ error: '书籍不存在' });
  res.json({ ok: true });
});

/* ---------- 标签 / 归类 ---------- */

// POST /api/books/:id/tags  body: { tags: string[] }
booksRouter.post('/:id/tags', (req, res) => {
  const id = Number(req.params.id);
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
  setBookTags(id, tags);
  res.json(getBook(id));
});

// POST /api/books/:id/category  body: { categoryId: number | null }
booksRouter.post('/:id/category', (req, res) => {
  const id = Number(req.params.id);
  const cat = req.body?.categoryId == null ? null : Number(req.body.categoryId);
  const book = setBookCategory(id, cat);
  if (!book) return res.status(404).json({ error: '书籍不存在' });
  res.json(book);
});

/* ---------- 借出 / 归还 ---------- */

// POST /api/books/:id/borrow  body: { borrower, note }
booksRouter.post('/:id/borrow', (req, res) => {
  const id = Number(req.params.id);
  const borrower = req.body?.borrower?.trim();
  if (!borrower) return res.status(400).json({ error: '请填写借阅人姓名' });
  try {
    const book = borrowBook(id, borrower, req.body?.note);
    res.json(book);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '借出失败' });
  }
});

// POST /api/books/:id/return
booksRouter.post('/:id/return', (req, res) => {
  const id = Number(req.params.id);
  try {
    const book = returnBook(id);
    res.json(book);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '归还失败' });
  }
});

/* ---------- 书评 ---------- */

// POST /api/books/:id/reviews  body: { rating?, content }
booksRouter.post('/:id/reviews', (req, res) => {
  const id = Number(req.params.id);
  const rating = req.body?.rating == null || req.body.rating === '' ? null : Number(req.body.rating);
  const content = req.body?.content?.trim() ?? '';
  if (content === '' && rating == null)
    return res.status(400).json({ error: '评分和内容至少填一项' });
  try {
    res.status(201).json(addReview(id, rating, content));
  } catch (e: any) {
    res.status(500).json({ error: e.message || '保存书评失败' });
  }
});

// PUT /api/reviews/:rid
booksRouter.put('/reviews/:rid', (req, res) => {
  const rid = Number(req.params.rid);
  const rating = req.body?.rating == null || req.body.rating === '' ? null : Number(req.body.rating);
  const content = req.body?.content?.trim() ?? '';
  try {
    res.json(updateReview(rid, rating, content));
  } catch (e: any) {
    res.status(500).json({ error: e.message || '更新书评失败' });
  }
});

// DELETE /api/reviews/:rid
booksRouter.delete('/reviews/:rid', (req, res) => {
  const rid = Number(req.params.rid);
  const bookId = deleteReview(rid);
  if (!bookId) return res.status(404).json({ error: '书评不存在' });
  res.json(getBook(bookId));
});
