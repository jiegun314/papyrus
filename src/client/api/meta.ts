/**
 * api/meta.ts —— 元数据接口：分类 / 标签 / 借阅 / 统计。
 */
import type { Category, Lending, Stats, Tag } from '../../shared/types';
import { request } from './http';

/* ---------- 分类 ---------- */

export function listCategories(): Promise<Category[]> {
  return request<Category[]>('/api/categories');
}

export function createCategory(name: string, color: string): Promise<{ id: number }> {
  return request('/api/categories', { method: 'POST', body: JSON.stringify({ name, color }) });
}

export function updateCategory(id: number, name: string, color: string): Promise<Category> {
  return request<Category>(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, color }),
  });
}

export function deleteCategory(id: number): Promise<{ ok: boolean }> {
  return request(`/api/categories/${id}`, { method: 'DELETE' });
}

/* ---------- 标签 ---------- */

export function listTags(): Promise<Tag[]> {
  return request<Tag[]>('/api/tags');
}

export function deleteTag(id: number): Promise<{ ok: boolean }> {
  return request(`/api/tags/${id}`, { method: 'DELETE' });
}

/* ---------- 借阅 ---------- */

export function listLendings(status?: 'borrowed' | 'returned'): Promise<Lending[]> {
  const qs = status ? `?status=${status}` : '';
  return request<Lending[]>(`/api/lendings${qs}`);
}

/* ---------- 统计 ---------- */

export function getStats(): Promise<Stats> {
  return request<Stats>('/api/stats');
}
