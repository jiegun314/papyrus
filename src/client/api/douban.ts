/**
 * api/douban.ts —— 豆瓣导入相关接口（与 src/server/routes/douban.ts 对应）。
 */
import type { Book, BookType, DoubanSearchResult } from '../../shared/types';
import { request } from './http';

/** 关键字搜索联想 */
export function doubanSearch(q: string): Promise<DoubanSearchResult[]> {
  return request<DoubanSearchResult[]>(`/api/douban/search?q=${encodeURIComponent(q)}`);
}

/** 抓取详情预览（不保存） */
export function doubanPreview(params: { isbn?: string; id?: string }): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params.isbn) qs.set('isbn', params.isbn);
  if (params.id) qs.set('id', params.id);
  return request(`/api/douban/book?${qs.toString()}`);
}

/** 抓取并保存到书架 */
export function doubanSave(payload: {
  isbn?: string;
  id?: string;
  searchResult?: DoubanSearchResult;
  /** 书籍载体类型：实体书 / 电子书（默认实体书） */
  bookType?: BookType;
}): Promise<{ book: Book; alreadyExists: boolean }> {
  return request('/api/douban/save', { method: 'POST', body: JSON.stringify(payload) });
}
