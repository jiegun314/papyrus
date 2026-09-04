/**
 * server/routes/books.ts
 * ------------------------------------------------------------------
 * 书籍相关 API：增删改查、标签、归类、阅读状态、书评。
 */
import { Router, raw } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  listBooks, getBook, createBook, updateBook, deleteBook,
  setBookTags, setBookCategory, setBookCoverPath,
  addReview, updateReview, deleteReview,
} from '../services/bookService.js';
import { downloadCover, saveCoverImage } from '../services/cover.js';
import { buildEbookDownloadName, saveEbookFile } from '../services/ebook.js';
import { fetchBookDetail, fetchBookByIsbn } from '../services/douban.js';
import { EBOOKS_DIR } from '../db/index.js';
import type { BookInput, ReadingStatus } from '../../shared/types.js';

export const booksRouter = Router();

/* ---------- 列表 ---------- */

// GET /api/books?keyword=&categoryId=&tagId=&readingStatus=&hasReview=&hasTag=&hasCategory=&limit=&offset=
booksRouter.get('/', (req, res) => {
  const { keyword, categoryId, tagId, readingStatus, limit, offset } = req.query;
  const bool = (v: unknown): boolean | undefined =>
    v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : undefined;
  const isReadingStatus = (v: unknown): v is ReadingStatus =>
    v === 'unread' || v === 'reading' || v === 'read' || v === 'abandoned';
  // 书籍载体类型：physical / ebook
  const { bookType } = req.query;
  const parsedBookType =
    bookType === 'physical' || bookType === 'ebook' ? bookType : undefined;
  const books = listBooks({
    keyword: typeof keyword === 'string' ? keyword : undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    tagId: tagId ? Number(tagId) : undefined,
    readingStatus: isReadingStatus(readingStatus) ? readingStatus : undefined,
    bookType: parsedBookType,
    hasReview: bool(req.query.hasReview),
    hasTag: bool(req.query.hasTag),
    hasCategory: bool(req.query.hasCategory),
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

/* ---------- 手动上传封面 ---------- */

// POST /api/books/upload-cover —— 接收上传的封面图片二进制体，保存到本地并返回访问路径。
// 表单直接以图片的原始二进制作为请求体（Content-Type: image/*），故用 raw 解析；无需 multer。
booksRouter.post(
  '/upload-cover',
  raw({ type: ['image/*', 'application/octet-stream'], limit: '20mb' }),
  (req, res) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length < 100) {
      return res.status(400).json({ error: '请选择有效的封面图片' });
    }
    const mime = (req.headers['content-type'] as string) || '';
    const name = typeof req.query.name === 'string' ? req.query.name : 'cover';
    const coverPath = saveCoverImage(buf, mime, name);
    if (!coverPath) return res.status(500).json({ error: '封面保存失败，请重试' });
    res.json({ coverPath });
  }
);

/* ---------- 手动上传电子书 ---------- */

// POST /api/books/upload-ebook —— 接收上传的电子书文件二进制体，保存到本地并返回访问路径与元数据。
// 与封面上传一致：以文件的原始二进制作为请求体（Content-Type: 应用类型，如 application/pdf / octet-stream）。
booksRouter.post(
  '/upload-ebook',
  raw({ type: '*/*', limit: '100mb' }),
  (req, res) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: '请选择有效的电子书文件' });
    }
    const mime = (req.headers['content-type'] as string) || '';
    const name = typeof req.query.name === 'string' ? req.query.name : 'book';
    const saved = saveEbookFile(buf, mime, name);
    if (!saved) return res.status(500).json({ error: '电子书保存失败，请重试' });
    res.json(saved);
  }
);

/* ---------- 电子书下载 ---------- */

// GET /api/books/:id/ebook/download —— 以下载方式返回电子书文件（Content-Disposition: attachment）。
booksRouter.get('/:id/ebook/download', (req, res) => {
  const id = Number(req.params.id);
  const book = getBook(id);
  if (!book) return res.status(404).json({ error: '书籍不存在' });
  if (!book.ebookPath) return res.status(404).json({ error: '该书未上传电子书文件' });
  const filename = path.basename(book.ebookPath);
  const target = path.join(EBOOKS_DIR, filename);
  if (!fs.existsSync(target)) return res.status(404).json({ error: '电子书文件不存在' });
  const downloadName = buildEbookDownloadName(book, filename);
  res.download(target, downloadName);
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

/* ---------- 封面 ---------- */

// POST /api/books/:id/cover —— 重新下载封面（此前豆瓣导入时下载失败可手动重试）
booksRouter.post('/:id/cover', async (req, res) => {
  const id = Number(req.params.id);
  const book = getBook(id);
  if (!book) return res.status(404).json({ error: '书籍不存在' });

  // 优先用已保存的豆瓣封面地址；没有则尝试从豆瓣重新抓取详情
  let coverUrl = book.coverUrl;
  if (!coverUrl) {
    try {
      const detail = book.doubanId
        ? await fetchBookDetail(book.doubanId)
        : book.isbn13 || book.isbn10
          ? await fetchBookByIsbn(book.isbn13 ?? book.isbn10!)
          : null;
      coverUrl = (detail?.coverUrl as string | null) ?? null;
    } catch (e: any) {
      return res.status(502).json({ error: `重新获取封面信息失败：${e.message}` });
    }
  }

  if (!coverUrl) {
    return res.status(400).json({ error: '这本书没有可用的封面来源（未关联豆瓣）' });
  }

  try {
    const localPath = await downloadCover(book.doubanId, coverUrl, book.title);
    if (!localPath) {
      return res.status(502).json({ error: '封面下载失败（豆瓣可能暂时拒绝请求），请稍后再试' });
    }
    setBookCoverPath(id, localPath);
    res.json(getBook(id));
  } catch (e: any) {
    res.status(500).json({ error: e.message || '封面下载失败' });
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
