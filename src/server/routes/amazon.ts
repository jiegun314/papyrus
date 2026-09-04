/**
 * server/routes/amazon.ts
 * ------------------------------------------------------------------
 * Amazon 数据源 API：
 *   GET  /api/amazon/search?q=xxx      搜索（解析搜索结果卡片）
 *   GET  /api/amazon/book?asin=xxx     根据 ASIN 查询预览（不保存）
 *   GET  /api/amazon/book?isbn=xxx     根据 ISBN 查询预览（不保存）
 *   POST /api/amazon/save              抓取并保存到书架
 *         body: { isbn?: string } 或 { asin?: string } 或 { searchResult?: AmazonSearchResult }
 */
import { Router } from 'express';
import { searchAmazon, fetchAmazonDetail, fetchAmazonByIsbn } from '../services/amazon.js';
import { downloadCover } from '../services/cover.js';
import { createBook, findBookByAmazonAsin, getBook, setBookCoverPath } from '../services/bookService.js';
import type { AmazonSearchResult } from '../../shared/types.js';

export const amazonRouter = Router();

// GET /api/amazon/search?q=
amazonRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) return res.json([]);
  try {
    res.json(await searchAmazon(q));
  } catch (e: any) {
    res.status(502).json({ error: e.message || 'Amazon 搜索失败' });
  }
});

// GET /api/amazon/book?asin=xxx 或 ?isbn=xxx   —— 预览，不保存
amazonRouter.get('/book', async (req, res) => {
  try {
    const { asin, isbn } = req.query;
    const detail =
      asin != null
        ? await fetchAmazonDetail(String(asin))
        : isbn != null
          ? await fetchAmazonByIsbn(String(isbn))
          : null;
    if (!detail) return res.status(400).json({ error: '请提供 asin 或 isbn' });
    res.json(detail);
  } catch (e: any) {
    res.status(502).json({ error: e.message || 'Amazon 查询失败' });
  }
});

// POST /api/amazon/save  body: { asin } 或 { isbn } 或 { searchResult }
amazonRouter.post('/save', async (req, res) => {
  try {
    const body = req.body as { isbn?: string; asin?: string; searchResult?: AmazonSearchResult };
    let detail: Record<string, unknown>;
    let titleFallback: string | undefined;

    if (body.searchResult?.asin) {
      // 从搜索结果直接抓取详情
      titleFallback = body.searchResult.title;
      detail = await fetchAmazonDetail(body.searchResult.asin);
    } else if (body.asin) {
      detail = await fetchAmazonDetail(body.asin);
    } else if (body.isbn) {
      detail = await fetchAmazonByIsbn(body.isbn);
    } else {
      return res.status(400).json({ error: '请提供 asin、isbn 或搜索结果' });
    }

    const asin = String(detail.asin);
    // 查重：已在书架中则直接返回已有记录
    const existing = findBookByAmazonAsin(asin);
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
      amazonAsin: asin,
      amazonUrl: detail.amazonUrl as string,
      coverUrl: detail.coverUrl as string | null,
      ratingAverage: detail.ratingAverage as number | null,
      ratingCount: detail.ratingCount as number | null,
    });

    // 插入后下载封面到本地
    const coverUrl = detail.coverUrl as string | null;
    if (coverUrl) {
      // Amazon 封面取自 m.media-amazon.com，用当前 ASIN 作为本地文件名，Referer 带上 Amazon 域名
      const localPath = await downloadCover(asin, coverUrl, String(detail.title ?? bookId), 'https://www.amazon.com/');
      if (localPath) setBookCoverPath(bookId, localPath);
    }

    res.status(201).json({ book: getBook(bookId), alreadyExists: false });
  } catch (e: any) {
    res.status(502).json({ error: e.message || '保存失败' });
  }
});
