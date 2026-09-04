/**
 * api/amazon.ts —— Amazon 导入相关接口（与 src/server/routes/amazon.ts 对应）。
 */
import type { AmazonSearchResult, Book, BookType } from '../../shared/types';
import { request } from './http';

/** 关键字搜索 */
export function amazonSearch(q: string): Promise<AmazonSearchResult[]> {
  return request<AmazonSearchResult[]>(`/api/amazon/search?q=${encodeURIComponent(q)}`);
}

/** 抓取详情预览（不保存） */
export function amazonPreview(params: { asin?: string; isbn?: string }): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params.asin) qs.set('asin', params.asin);
  if (params.isbn) qs.set('isbn', params.isbn);
  return request(`/api/amazon/book?${qs.toString()}`);
}

/** 抓取并保存到书架 */
export function amazonSave(payload: {
  asin?: string;
  isbn?: string;
  searchResult?: AmazonSearchResult;
  /** 书籍载体类型：实体书 / 电子书（默认实体书） */
  bookType?: BookType;
}): Promise<{ book: Book; alreadyExists: boolean }> {
  return request('/api/amazon/save', { method: 'POST', body: JSON.stringify(payload) });
}
