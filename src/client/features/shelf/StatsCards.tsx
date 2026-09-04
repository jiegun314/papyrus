/**
 * features/shelf/StatsCards.tsx —— 书架统计卡片行。
 * 数量 > 0 时可点击，弹出对应书籍清单。
 */
import type { BookQuery, ReadingStatus, Stats } from '../../../shared/types';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT } from '../../lib/readingStatus';

/** 每个阅读状态对应的统计数字颜色 */
const READING_COLOR: Record<ReadingStatus, string> = {
  unread: 'gray',
  reading: 'teal',
  read: 'green',
  abandoned: 'danger',
};

export function StatsCards({
  stats,
  onOpenList,
}: {
  stats: Stats;
  onOpenList: (title: string, query: BookQuery) => void;
}) {
  const defs: Array<{
    label: string;
    count: number;
    color?: string;
    action: { kind: 'list'; title: string; query: BookQuery };
  }> = [
    { label: '藏书总数', count: stats.totalBooks, action: { kind: 'list', title: '全部书籍', query: {} } },
    { label: '实体书', count: stats.physicalCount, action: { kind: 'list', title: '实体书', query: { bookType: 'physical' } } },
    { label: '电子书', count: stats.ebookCount, color: 'teal', action: { kind: 'list', title: '电子书', query: { bookType: 'ebook' } } },
    ...READING_STATUS_OPTIONS.map((s) => ({
      label: READING_STATUS_TEXT[s],
      count: stats[s],
      color: READING_COLOR[s],
      action: { kind: 'list' as const, title: `${READING_STATUS_TEXT[s]}书籍`, query: { readingStatus: s } },
    })),
  ];

  return (
    <div className="stats-row">
      {defs.map((d) => {
        const clickable = d.count > 0;
        const title = clickable ? `查看${d.action.title}` : undefined;
        const onClick = clickable ? () => onOpenList(d.action.title, d.action.query) : undefined;
        const inner = (
          <>
            <div className="stat-label">{d.label}</div>
            <div className={`stat-num ${d.color ?? ''}`}>{d.count}</div>
          </>
        );
        return clickable ? (
          <button key={d.label} type="button" className="stat-card clickable" title={title} onClick={onClick}>
            {inner}
          </button>
        ) : (
          <div key={d.label} className="stat-card">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
