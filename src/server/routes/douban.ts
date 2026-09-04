/**
 * server/routes/douban.ts
 * ------------------------------------------------------------------
 * 豆瓣数据源 API：
 *   GET  /api/douban/search?q=xxx      搜索联想
 *   GET  /api/douban/book?isbn=xxx     根据 ISBN 查询预览（不保存）
 *   GET  /api/douban/book?id=xxx       根据豆瓣 id 查询预览（不保存）
 *   POST /api/douban/save              抓取并保存到书架
 *         body: { isbn?: string } 或 { id?: string } 或 { searchResult?: DoubanSearchResult }
 */
import { Router } from 'express';
import { searchDouban, fetchBookDetail, fetchBookByIsbn } from '../services/douban.js';
import { downloadCover } from '../services/cover.js';
import { createBook, findBookByDoubanId, getBook, setBookCoverPath } from '../services/bookService.js';
import type { BookType, DoubanSearchResult } from '../../shared/types.js';

export const doubanRouter = Router();

// GET /api/douban/search?q=
doubanRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) return res.json([]);
  try {
    res.json(await searchDouban(q));
  } catch (e: any) {
    res.status(502).json({ error: e.message || '豆瓣搜索失败' });
  }
});

// GET /api/douban/book?isbn=xxx 或 ?id=xxx   —— 预览，不保存
doubanRouter.get('/book', async (req, res) => {
  try {
    const { isbn, id } = req.query;
    const detail =
      isbn != null
        ? await fetchBookByIsbn(String(isbn))
        : id != null
          ? await fetchBookDetail(String(id))
          : null;
    if (!detail) return res.status(400).json({ error: '请提供 isbn 或豆瓣 id' });
    res.json(detail);
  } catch (e: any) {
    res.status(502).json({ error: e.message || '豆瓣查询失败' });
  }
});

// POST /api/douban/save  body: { isbn } 或 { id } 或 { searchResult }
doubanRouter.post('/save', async (req, res) => {
  try {
    const body = req.body as { isbn?: string; id?: string; searchResult?: DoubanSearchResult; bookType?: BookType };
    let detail: Record<string, unknown>;
    let titleFallback: string | undefined;

    if (body.searchResult?.id) {
      // 从搜索联想结果直接抓取详情
      titleFallback = body.searchResult.title;
      detail = await fetchBookDetail(body.searchResult.id);
    } else if (body.isbn) {
      detail = await fetchBookByIsbn(body.isbn);
    } else if (body.id) {
      detail = await fetchBookDetail(body.id);
    } else {
      return res.status(400).json({ error: '请提供 isbn、豆瓣 id 或搜索联想结果' });
    }

    const doubanId = String(detail.doubanId);
    // 查重：已在书架中则直接返回已有记录
    const existing = findBookByDoubanId(doubanId);
    if (existing) return res.json({ book: existing, alreadyExists: true });

    const bookId = createBook({
      title: (detail.title as string) || titleFallback || '未命名',
      subtitle: detail.subtitle as string | undefined,
      originalTitle: detail.originalTitle as string | undefined,
      authors: Array.isArray(detail.authors) ? (detail.authors as string[]) : [],
      publisher: detail.publisher as string | undefined,
      pubdate: detail.pubdate as string | undefined,
      price: detail.price as string | undefined,
      pages: detail.pages as number | undefined,
      binding: detail.binding as string | undefined,
      series: detail.series as string | undefined,
      summary: detail.summary as string | undefined,
      authorIntro: detail.authorIntro as string | undefined,
      catalog: detail.catalog as string | undefined,
      isbn13: detail.isbn13 as string | undefined,
      isbn10: detail.isbn10 as string | undefined,
      doubanId,
      doubanUrl: detail.doubanUrl as string,
      bookType: body.bookType === 'ebook' ? 'ebook' : 'physical',
      coverUrl: detail.coverUrl as string | null,
      ratingAverage: detail.ratingAverage as number | null,
      ratingCount: detail.ratingCount as number | null,
    });

    // 插入后下载封面到本地
    const coverUrl = detail.coverUrl as string | null;
    if (coverUrl) {
      const localPath = await downloadCover(doubanId, coverUrl, String(detail.title ?? bookId));
      if (localPath) setBookCoverPath(bookId, localPath);
    }

    res.status(201).json({ book: getBook(bookId), alreadyExists: false });
  } catch (e: any) {
    res.status(502).json({ error: e.message || '保存失败' });
  }
});
