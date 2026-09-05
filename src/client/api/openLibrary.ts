/**
 * api/openLibrary.ts —— Open Library 导入相关接口（与 src/server/routes/openLibrary.ts 对应）。
 */
import type { Book, BookType, OpenLibrarySearchResult } from '../../shared/types';
import { request } from './http';

/** 关键字搜索（书名 / 作者 / ISBN） */
export function openLibrarySearch(q: string): Promise<OpenLibrarySearchResult[]> {
  return request<OpenLibrarySearchResult[]>(`/api/ol/search?q=${encodeURIComponent(q)}`);
}

/** 抓取详情预览（不保存） */
export function openLibraryPreview(params: { key?: string; isbn?: string; coverId?: number }): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params.key) qs.set('key', params.key);
  if (params.isbn) qs.set('isbn', params.isbn);
  if (params.coverId != null) qs.set('cover_i', String(params.coverId));
  return request(`/api/ol/book?${qs.toString()}`);
}

/** 抓取并保存到书架 */
export function openLibrarySave(payload: {
  key?: string;
  isbn?: string;
  searchResult?: OpenLibrarySearchResult;
  /** 书籍载体类型：实体书 / 电子书（默认实体书） */
  bookType?: BookType;
}): Promise<{ book: Book; alreadyExists: boolean }> {
  return request('/api/ol/save', { method: 'POST', body: JSON.stringify(payload) });
}
