/**
 * frontend/api.ts
 * ------------------------------------------------------------------
 * 前端 API 封装：所有后端接口的调用函数集中在这里。
 * 与 src/server/routes 下的路由一一对应。
 */
import type { Book, BookInput, BookQuery, Category, Tag, Lending, Stats, DoubanSearchResult } from '../shared/types.js';

/** 统一错误类型 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/* ---------- 书籍 ---------- */

export const api = {
  /** 列出书籍（可带筛选） */
  listBooks(query: BookQuery = {}): Promise<Book[]> {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.categoryId) params.set('categoryId', String(query.categoryId));
    if (query.tagId) params.set('tagId', String(query.tagId));
    if (query.status) params.set('status', query.status);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return request(`/api/books${qs ? '?' + qs : ''}`);
  },

  getBook(id: number): Promise<Book> {
    return request(`/api/books/${id}`);
  },

  createBook(input: BookInput): Promise<Book> {
    return request('/api/books', { method: 'POST', body: JSON.stringify(input) });
  },

  updateBook(id: number, input: Partial<BookInput>): Promise<Book> {
    return request(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  },

  deleteBook(id: number): Promise<{ ok: boolean }> {
    return request(`/api/books/${id}`, { method: 'DELETE' });
  },

  setTags(id: number, tags: string[]): Promise<Book> {
    return request(`/api/books/${id}/tags`, { method: 'POST', body: JSON.stringify({ tags }) });
  },

  setCategory(id: number, categoryId: number | null): Promise<Book> {
    return request(`/api/books/${id}/category`, { method: 'POST', body: JSON.stringify({ categoryId }) });
  },

  borrow(id: number, borrower: string, note?: string): Promise<Book> {
    return request(`/api/books/${id}/borrow`, { method: 'POST', body: JSON.stringify({ borrower, note }) });
  },

  returnBook(id: number): Promise<Book> {
    return request(`/api/books/${id}/return`, { method: 'POST' });
  },

  addReview(id: number, rating: number | null, content: string): Promise<Book> {
    return request(`/api/books/${id}/reviews`, { method: 'POST', body: JSON.stringify({ rating, content }) });
  },

  updateReview(reviewId: number, rating: number | null, content: string): Promise<Book> {
    return request(`/api/reviews/${reviewId}`, { method: 'PUT', body: JSON.stringify({ rating, content }) });
  },

  deleteReview(reviewId: number): Promise<Book> {
    return request(`/api/reviews/${reviewId}`, { method: 'DELETE' });
  },

  /* ---------- 豆瓣 ---------- */

  doubanSearch(q: string): Promise<DoubanSearchResult[]> {
    return request(`/api/douban/search?q=${encodeURIComponent(q)}`);
  },

  doubanPreview(params: { isbn?: string; id?: string }): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (params.isbn) qs.set('isbn', params.isbn);
    if (params.id) qs.set('id', params.id);
    return request(`/api/douban/book?${qs.toString()}`);
  },

  doubanSave(payload: { isbn?: string; id?: string; searchResult?: DoubanSearchResult }): Promise<{ book: Book; alreadyExists: boolean }> {
    return request('/api/douban/save', { method: 'POST', body: JSON.stringify(payload) });
  },

  /* ---------- 元数据 ---------- */

  listCategories(): Promise<Category[]> {
    return request('/api/categories');
  },

  createCategory(name: string, color: string): Promise<{ id: number }> {
    return request('/api/categories', { method: 'POST', body: JSON.stringify({ name, color }) });
  },

  updateCategory(id: number, name: string, color: string): Promise<Category> {
    return request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, color }) });
  },

  deleteCategory(id: number): Promise<{ ok: boolean }> {
    return request(`/api/categories/${id}`, { method: 'DELETE' });
  },

  listTags(): Promise<Tag[]> {
    return request('/api/tags');
  },

  deleteTag(id: number): Promise<{ ok: boolean }> {
    return request(`/api/tags/${id}`, { method: 'DELETE' });
  },

  listLendings(status?: 'borrowed' | 'returned'): Promise<Lending[]> {
    const qs = status ? `?status=${status}` : '';
    return request(`/api/lendings${qs}`);
  },

  getStats(): Promise<Stats> {
    return request('/api/stats');
  },
};
