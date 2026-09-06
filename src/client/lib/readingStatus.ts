/**
 * lib/readingStatus.ts —— 阅读状态（未读 / 阅读中 / 已读 / 放弃）的展示常量。
 * 在筛选下拉、封面角标、详情弹窗、统计卡与表单中统一使用。
 */
import type { ReadingStatus } from '../../shared/types';

/** 阅读状态及其展示顺序（未读 → 阅读中 → 已读 → 放弃） */
export const READING_STATUS_OPTIONS: ReadingStatus[] = ['unread', 'reading', 'read', 'abandoned'];

/** 阅读状态 → 中文文案 */
export const READING_STATUS_TEXT: Record<ReadingStatus, string> = {
  unread: '未读',
  reading: '阅读中',
  read: '已读',
  abandoned: '放弃',
};

/** 阅读状态 → 图标（使用跨平台单字符 emoji，简单直观便于识别） */
export const READING_STATUS_ICON: Record<ReadingStatus, string> = {
  unread: '🔖',
  reading: '📖',
  read: '✅',
  abandoned: '🚫',
};
