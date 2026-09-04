/**
 * lib/bookType.ts —— 书籍载体类型（实体书 / 电子书）的展示常量。
 */
import type { BookType } from '../../shared/types';

/** 载体类型及其展示顺序 */
export const BOOK_TYPE_OPTIONS: BookType[] = ['physical', 'ebook'];

/** 载体类型 → 中文文案 */
export const BOOK_TYPE_TEXT: Record<BookType, string> = {
  physical: '实体书',
  ebook: '电子书',
};
