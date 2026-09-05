/**
 * server/routes/openLibrary.ts
 * ------------------------------------------------------------------
 * Open Library 数据源 API：
 *   GET  /api/ol/search?q=xxx             搜索（书名 / 作者 / ISBN）
 *   GET  /api/ol/book?key=xxx             根据 work key 查询预览（不保存，可带 cover_i）
 *   GET  /api/ol/book?isbn=xxx            根据 ISBN 查询预览（不保存）
 *   POST /api/ol/save                     抓取并保存到书架
 *         body: { key? } 或 { isbn? } 或 { searchResult? }
 */
import { Router } from 'express';
import { searchOpenLibrary, fetchOpenLibraryDetail, fetchOpenLibraryByIsbn } from '../services/openLibrary.js';
import { downloadCover } from '../services/cover.js';
import { createBook, findBookByOpenLibraryKey, getBook, setBookCoverPath } from '../services/bookService.js';
import type { BookType, OpenLibrarySearchResult } from '../../shared/types.js';

export const openLibraryRouter = Router();

/** 用用户看到的搜索结果字段补齐详情（作者/出版社/ISBN 等以搜索聚合为准） */
function mergeSearch(detail: Record<string, unknown>, s: OpenLibrarySearchResult): Record<string, unknown> {
  const out = { ...detail };
  const authors = s.authors ? s.authors.split(',').map((x) => x.trim()).filter(Boolean) : [];
  if (authors.length) out.authors = authors;
  if (s.title) out.title = out.title || s.title;
  if (s.subtitle) out.subtitle = out.subtitle || s.subtitle;
  if (s.publisher) out.publisher = out.publisher || s.publisher;
  if (s.pages) out.pages = out.pages || s.pages;
  if (s.isbn) {
    if (/^\d{13}$/.test(s.isbn)) out.isbn13 = out.isbn13 || s.isbn;
    else if (/^\d{9}[\dXx]$/i.test(s.isbn)) out.isbn10 = out.isbn10 || s.isbn;
  }
  if (s.ratingAverage != null) out.ratingAverage = s.ratingAverage;
  if (s.ratingCount != null) out.ratingCount = s.ratingCount;
  if (s.coverUrl) out.coverUrl = out.coverUrl || s.coverUrl;
  return out;
}

// GET /api/ol/search?q=
openLibraryRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) return res.json([]);
  try {
    res.json(await searchOpenLibrary(q));
  } catch (e: any) {
    res.status(502).json({ error: e.message || 'Open Library 搜索失败' });
  }
});

// GET /api/ol/book?key=xxx 或 ?isbn=xxx —— 预览，不保存
openLibraryRouter.get('/book', async (req, res) => {
  try {
    const { key, isbn, cover_i } = req.query;
    const detail =
      key != null
        ? await fetchOpenLibraryDetail(String(key), cover_i ? Number(cover_i) : undefined)
        : isbn != null
          ? await fetchOpenLibraryByIsbn(String(isbn))
          : null;
    if (!detail) return res.status(400).json({ error: '请提供 key 或 isbn' });
    res.json(detail);
  } catch (e: any) {
    res.status(502).json({ error: e.message || 'Open Library 查询失败' });
  }
});

// POST /api/ol/save  body: { key } 或 { isbn } 或 { searchResult }
openLibraryRouter.post('/save', async (req, res) => {
  try {
    const body = req.body as { isbn?: string; key?: string; searchResult?: OpenLibrarySearchResult; bookType?: BookType };
    let detail: Record<string, unknown>;
    let titleFallback: string | undefined;

    if (body.searchResult?.key) {
      // 从搜索结果直接抓取详情，并用用户看到的搜索结果字段补齐（作者/出版社/ISBN）
      titleFallback = body.searchResult.title;
      detail = mergeSearch(
        await fetchOpenLibraryDetail(body.searchResult.key, body.searchResult.coverId),
        body.searchResult
      );
    } else if (body.key) {
      detail = await fetchOpenLibraryDetail(body.key);
    } else if (body.isbn) {
      detail = await fetchOpenLibraryByIsbn(body.isbn);
    } else {
      return res.status(400).json({ error: '请提供 key、isbn 或搜索结果' });
    }

    const openLibraryKey = String(detail.openLibraryKey);
    // 查重：已在书架中则直接返回已有记录
    const existing = findBookByOpenLibraryKey(openLibraryKey);
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
      openLibraryKey,
      openLibraryUrl: detail.openLibraryUrl as string,
      bookType: body.bookType === 'ebook' ? 'ebook' : 'physical',
      coverUrl: detail.coverUrl as string | null,
      ratingAverage: detail.ratingAverage as number | null,
      ratingCount: detail.ratingCount as number | null,
    });

    // 插入后下载封面到本地
    const coverUrl = detail.coverUrl as string | null;
    if (coverUrl) {
      const name = openLibraryKey.replace('/works/', '') || String(detail.isbn13 ?? bookId);
      // Open Library 封面来自 covers.openlibrary.org，用作品 key 做本地文件名，Referer 带上 openlibrary.org
      const localPath = await downloadCover(name, coverUrl, String(detail.title ?? bookId), 'https://openlibrary.org/');
      if (localPath) setBookCoverPath(bookId, localPath);
    }

    res.status(201).json({ book: getBook(bookId), alreadyExists: false });
  } catch (e: any) {
    res.status(502).json({ error: e.message || '保存失败' });
  }
});
