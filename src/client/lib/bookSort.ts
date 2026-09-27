/**
 * lib/bookSort.ts —— 书架排序字段的展示文案与顺序。
 * 在排序下拉（FilterBar）与排序方向按钮中统一使用，
 * 保证「字段 → 文案」的映射只维护一份。
 */
import type { BookSortField, SortDirection } from '../../shared/types';

/** 排序字段及其展示顺序（默认排序由筛选栏的 placeholder 表达，不在此列） */
export const BOOK_SORT_OPTIONS: { value: BookSortField; label: string }[] = [
  { value: 'title', label: '书籍名称' },
  { value: 'author', label: '作者名称' },
  { value: 'rating', label: '豆瓣评分' },
  { value: 'pubdate', label: '出版时间' },
];

/** 排序方向 → 控件上的箭头与短文案 */
export const SORT_DIRECTION_TEXT: Record<SortDirection, { label: string; arrow: string }> = {
  desc: { label: '降序', arrow: '↓' },
  asc: { label: '升序', arrow: '↑' },
};

/** 排序方向 → 悬浮提示（说清「由高到低 / 由低到高」以及点击后的效果） */
export const SORT_DIRECTION_HINT: Record<SortDirection, string> = {
  desc: '当前由高到低（书名 Z→A / 高分在前 / 新书在前），点击切换为由低到高',
  asc: '当前由低到高（书名 A→Z / 低分在前 / 老书在前），点击切换为由高到低',
};
