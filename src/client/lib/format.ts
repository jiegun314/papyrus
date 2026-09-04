/**
 * lib/format.ts —— 展示格式化工具（承接原 frontend/ui.ts 中的纯函数）。
 */
import type { Book } from '../../shared/types';

/** ISO 时间 → "YYYY-MM-DD HH:mm"（兼容旧数据截断） */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

/** 豆瓣均分显示 */
export function fmtRating(avg: number | null): string {
  return avg == null ? '—' : avg.toFixed(1);
}

/** 作者文本 */
export function authorText(book: Pick<Book, 'authors'>): string {
  return Array.isArray(book.authors) && book.authors.length ? book.authors.join(' / ') : '佚名';
}

/** 用 ★ 文本表达分数（用于「我的评分」等文本场景） */
export function starsText(v: number): string {
  const filled = Math.round(v);
  return '★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled));
}

/** 字节数 → 人类可读大小（如 2.4 MB） */
export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const v = i === 0 ? n : Math.round(n * 10) / 10;
  return `${v} ${units[i]}`;
}
