/**
 * api/meta.ts —— 元数据接口：分类 / 标签 / 统计 / 服务器状态。
 */
import type { Category, ServerInfo, ServerSessionStats, Stats, Tag } from '../../shared/types';
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

/* ---------- 统计 ---------- */

export function getStats(): Promise<Stats> {
  return request<Stats>('/api/stats');
}

/* ---------- 服务器状态 ---------- */

/** 服务器状态：IP / 端口 / 运行环境 / 模块版本 / 访问统计 */
export function getServerInfo(): Promise<ServerInfo> {
  return request<ServerInfo>('/api/server-info');
}

/** 上报一次访问心跳，返回最新的在线 / 累计访问统计 */
export function sendHeartbeat(sessionId: string): Promise<ServerSessionStats> {
  return request<ServerSessionStats>('/api/server-info/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}
