/**
 * api/books.ts —— 书籍相关接口（与 src/server/routes/books.ts 对应）。
 */
import type { Book, BookInput, BookQuery } from '../../shared/types';
import { request } from './http';

function toQueryString(query: BookQuery): string {
  const params = new URLSearchParams();
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.categoryId != null) params.set('categoryId', String(query.categoryId));
  if (query.tagId != null) params.set('tagId', String(query.tagId));
  if (query.status) params.set('status', query.status);
  if (query.hasReview) params.set('hasReview', 'true');
  if (query.hasTag) params.set('hasTag', 'true');
  if (query.hasCategory) params.set('hasCategory', 'true');
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** 列出书籍（可带筛选） */
export function listBooks(query: BookQuery = {}): Promise<Book[]> {
  return request<Book[]>(`/api/books${toQueryString(query)}`);
}

/** 书籍详情 */
export function getBook(id: number): Promise<Book> {
  return request<Book>(`/api/books/${id}`);
}

/** 重新下载封面（豆瓣导入时下载失败后手动重试） */
export function retryCover(id: number): Promise<Book> {
  return request<Book>(`/api/books/${id}/cover`, { method: 'POST' });
}

/** 新建书籍 */
export function createBook(input: BookInput): Promise<Book> {
  return request<Book>('/api/books', { method: 'POST', body: JSON.stringify(input) });
}

/** 更新书籍信息 */
export function updateBook(id: number, input: Partial<BookInput>): Promise<Book> {
  return request<Book>(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

/** 删除书籍（级联清理关联数据） */
export function deleteBook(id: number): Promise<{ ok: boolean }> {
  return request(`/api/books/${id}`, { method: 'DELETE' });
}

/** 设置书籍标签 */
export function setTags(id: number, tags: string[]): Promise<Book> {
  return request<Book>(`/api/books/${id}/tags`, { method: 'POST', body: JSON.stringify({ tags }) });
}

/** 设置书籍分类（null = 未分类） */
export function setCategory(id: number, categoryId: number | null): Promise<Book> {
  return request<Book>(`/api/books/${id}/category`, {
    method: 'POST',
    body: JSON.stringify({ categoryId }),
  });
}

/** 借出 */
export function borrowBook(id: number, borrower: string, note?: string): Promise<Book> {
  return request<Book>(`/api/books/${id}/borrow`, {
    method: 'POST',
    body: JSON.stringify({ borrower, note }),
  });
}

/** 归还 */
export function returnBook(id: number): Promise<Book> {
  return request<Book>(`/api/books/${id}/return`, { method: 'POST' });
}

/** 新增书评 */
export function addReview(
  id: number,
  rating: number | null,
  content: string
): Promise<Book> {
  return request<Book>(`/api/books/${id}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, content }),
  });
}

/** 更新书评 */
export function updateReview(
  reviewId: number,
  rating: number | null,
  content: string
): Promise<Book> {
  return request<Book>(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    body: JSON.stringify({ rating, content }),
  });
}

/** 删除书评 */
export function deleteReview(reviewId: number): Promise<Book> {
  return request<Book>(`/api/reviews/${reviewId}`, { method: 'DELETE' });
}
