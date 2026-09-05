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
import { fetchAmazonDetail, fetchAmazonByIsbn } from '../services/amazon.js';
import { fetchOpenLibraryDetail, fetchOpenLibraryByIsbn } from '../services/openLibrary.js';
import { EBOOKS_DIR } from '../db/index.js';
import type { Book, BookInput, ReadingStatus } from '../../shared/types.js';

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

/** 各数据源封面下载所带的 Referer */
const DOUBAN_REFERER = 'https://book.douban.com/';
const AMAZON_REFERER = 'https://www.amazon.com/';
const OPENLIBRARY_REFERER = 'https://openlibrary.org/';

/** 依据书籍来源挑选 Referer（用于已保存封面 URL 的兜底下载） */
function refererFor(book: Book): string {
  if (book.amazonAsin) return AMAZON_REFERER;
  if (book.openLibraryKey) return OPENLIBRARY_REFERER;
  return DOUBAN_REFERER;
}

/**
 * 解析一本书「重新下载封面」所用的封面地址与本地文件名 / Referer。
 * 按数据源抓取最新详情以拿到最新封面（Amazon / Open Library / 豆瓣），
 * 失败时回退到已保存的 coverUrl，最底兜底尝试按 ISBN 依次请求各个数据源。
 */
async function resolveCoverSource(
  book: Book
): Promise<{ url: string; name: string | null; referer: string } | null> {
  // 1) 优先按来源重新抓取详情，拿到最新封面地址
  if (book.amazonAsin) {
    try {
      const d = await fetchAmazonDetail(book.amazonAsin);
      const url = d.coverUrl as string | undefined;
      if (url) return { url, name: book.amazonAsin, referer: AMAZON_REFERER };
    } catch {
      /* 抓取失败，落入下面的回退 */
    }
  }
  if (book.openLibraryKey) {
    try {
      const d = await fetchOpenLibraryDetail(book.openLibraryKey);
      const url = d.coverUrl as string | undefined;
      if (url)
        return { url, name: book.openLibraryKey.replace('/works/', ''), referer: OPENLIBRARY_REFERER };
    } catch {
      /* ignore */
    }
  }
  if (book.doubanId) {
    try {
      const d = await fetchBookDetail(book.doubanId);
      const url = d.coverUrl as string | undefined;
      if (url) return { url, name: book.doubanId, referer: DOUBAN_REFERER };
    } catch {
      /* ignore */
    }
  }

  // 2) 已保存的封面地址（可能已失效，但至少指向一个来源）
  if (book.coverUrl) {
    const name =
      book.amazonAsin ?? book.openLibraryKey?.replace('/works/', '') ?? book.doubanId ?? null;
    return { url: book.coverUrl, name, referer: refererFor(book) };
  }

  // 3) 仅剩 ISBN：依次尝试 豆瓣 → Amazon → Open Library
  const isbn = book.isbn13 ?? book.isbn10;
  if (isbn) {
    const attempts: Array<{ fetch: () => Promise<Record<string, unknown>>; referer: string }> = [
      { fetch: () => fetchBookByIsbn(isbn), referer: DOUBAN_REFERER },
      { fetch: () => fetchAmazonByIsbn(isbn), referer: AMAZON_REFERER },
      { fetch: () => fetchOpenLibraryByIsbn(isbn), referer: OPENLIBRARY_REFERER },
    ];
    for (const a of attempts) {
      try {
        const d = await a.fetch();
        const url = d.coverUrl as string | undefined;
        if (!url) continue;
        const name =
          (d.asin as string | undefined) ??
          (d.openLibraryKey as string | undefined)?.replace('/works/', '') ??
          (d.doubanId as string | undefined) ??
          null;
        return { url, name, referer: a.referer };
      } catch {
        continue;
      }
    }
  }

  return null;
}

// POST /api/books/:id/cover —— 重新下载封面（豆瓣 / Amazon / Open Library 均可手动重试）
booksRouter.post('/:id/cover', async (req, res) => {
  const id = Number(req.params.id);
  const book = getBook(id);
  if (!book) return res.status(404).json({ error: '书籍不存在' });

  const source = await resolveCoverSource(book);
  if (!source?.url) {
    return res.status(400).json({ error: '这本书没有可用的封面来源' });
  }

  try {
    // force=true：即使本地已缓存同名封面也重新下载，保证「重下」真正生效
    const localPath = await downloadCover(source.name, source.url, book.title, source.referer, true);
    if (!localPath) {
      return res.status(502).json({ error: '封面下载失败，请稍后再试' });
    }
    setBookCoverPath(id, localPath);
    res.json(getBook(id));
  } catch (e: any) {
    res.status(500).json({ error: e.message || '封面下载失败' });
  }
});

/* ---------- 刷新书籍信息 ---------- */

/**
 * 依据书籍已有来源重新抓取详情（豆瓣 / Amazon / Open Library）。
 * 未记录来源标识时按 ISBN 依次尝试三个数据源。
 */
async function refreshBookDetail(book: Book): Promise<Record<string, unknown>> {
  if (book.doubanId) return await fetchBookDetail(book.doubanId);
  if (book.amazonAsin) return await fetchAmazonDetail(book.amazonAsin);
  if (book.openLibraryKey) return await fetchOpenLibraryDetail(book.openLibraryKey);

  const isbn = book.isbn10 ?? book.isbn13 ?? '';
  if (isbn) {
    const attempts: Array<() => Promise<Record<string, unknown>>> = [
      () => fetchBookByIsbn(isbn),
      () => fetchAmazonByIsbn(isbn),
      () => fetchOpenLibraryByIsbn(isbn),
    ];
    let lastErr: unknown;
    for (const fn of attempts) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('按 ISBN 从各数据源查询均失败');
  }
  throw new Error('这本书没有可用的数据来源（豆瓣 / Amazon / Open Library / ISBN）');
}

/** 取详情字段中的字符串（去首尾空白；空串视为无值） */
function detailStr(d: Record<string, unknown>, key: string): string | undefined {
  const v = d[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** 取详情字段中的数字（仅接受有限数字） */
function detailNum(d: Record<string, unknown>, key: string): number | undefined {
  const v = d[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * 将数据源详情映射为「刷新书籍信息」的更新载荷：只把来源已提供（非空）的字段写入，
 * 避免把记录里已有的本地数据覆盖成空；同时刻意不包含：
 *  - 封面本地路径 coverPath（封面图片保持不变，仅刷新封面原始地址 coverUrl）
 *  - 电子书文件（ebookPath / ebookFilename / ebookSize）
 *  - 个人数据（categoryId / readingStatus / notes / bookType）
 *  - 标签、书评（由各自接口单独管理）
 */
function detailToBookInput(d: Record<string, unknown>): Partial<BookInput> {
  const input: Partial<BookInput> = {};
  const setStr = (key: string, out: keyof BookInput) => {
    const v = detailStr(d, key);
    if (v) (input as Record<string, unknown>)[out] = v;
  };

  setStr('title', 'title');
  setStr('subtitle', 'subtitle');
  setStr('originalTitle', 'originalTitle');
  setStr('publisher', 'publisher');
  setStr('pubdate', 'pubdate');
  setStr('price', 'price');
  setStr('binding', 'binding');
  setStr('series', 'series');
  setStr('summary', 'summary');
  setStr('authorIntro', 'authorIntro');
  setStr('catalog', 'catalog');
  setStr('isbn13', 'isbn13');
  setStr('isbn10', 'isbn10');
  setStr('coverUrl', 'coverUrl');

  if (Array.isArray(d.authors) && (d.authors as unknown[]).length > 0) {
    const authors = (d.authors as string[]).map((a) => String(a).trim()).filter(Boolean);
    if (authors.length) input.authors = authors;
  }
  const pages = detailNum(d, 'pages');
  if (pages != null) input.pages = pages;
  const ratingAverage = detailNum(d, 'ratingAverage');
  if (ratingAverage != null) input.ratingAverage = ratingAverage;
  const ratingCount = detailNum(d, 'ratingCount');
  if (ratingCount != null) input.ratingCount = ratingCount;

  // 来源标识与页面 URL（根据本次命中的来源补齐）
  const doubanId = detailStr(d, 'doubanId');
  if (doubanId) {
    input.doubanId = doubanId;
    input.doubanUrl = detailStr(d, 'doubanUrl') ?? `https://book.douban.com/subject/${doubanId}/`;
  }
  const asin = detailStr(d, 'asin');
  if (asin) {
    input.amazonAsin = asin;
    if (detailStr(d, 'amazonUrl')) input.amazonUrl = detailStr(d, 'amazonUrl');
  }
  const olKey = detailStr(d, 'openLibraryKey');
  if (olKey) {
    input.openLibraryKey = olKey;
    input.openLibraryUrl = detailStr(d, 'openLibraryUrl') ?? `https://openlibrary.org${olKey}`;
  }

  return input;
}

// POST /api/books/:id/refresh —— 从原数据源重新抓取并刷新除封面图片外的书籍信息
booksRouter.post('/:id/refresh', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的书籍 id' });
  const book = getBook(id);
  if (!book) return res.status(404).json({ error: '书籍不存在' });

  try {
    const detail = await refreshBookDetail(book);
    const input = detailToBookInput(detail);
    if (Object.keys(input).length === 0) {
      return res.status(502).json({ error: '未能从来源解析到任何可刷新的字段' });
    }
    const updated = updateBook(id, input);
    res.json(updated);
  } catch (e: any) {
    res.status(502).json({ error: e.message || '刷新失败' });
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
