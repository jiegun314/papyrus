/**
 * features/shelf/StatsCards.tsx —— 书架统计卡片行。
 * 数量 > 0 时可点击：标签/分类进入管理视图，其余弹出书籍清单。
 */
import type { BookQuery, Stats } from '../../../shared/types';

export function StatsCards({
  stats,
  onOpenList,
  onOpenView,
}: {
  stats: Stats;
  onOpenList: (title: string, query: BookQuery) => void;
  onOpenView: (view: 'tags' | 'categories') => void;
}) {
  const defs: Array<{
    label: string;
    count: number;
    color?: string;
    action: { kind: 'list'; title: string; query: BookQuery } | { kind: 'view'; view: 'tags' | 'categories' };
  }> = [
    { label: '藏书总数', count: stats.totalBooks, action: { kind: 'list', title: '全部书籍', query: {} } },
    { label: '在架', count: stats.inLibrary, color: 'green', action: { kind: 'list', title: '在架书籍', query: { status: 'in' } } },
    { label: '借出', count: stats.borrowed, color: 'teal', action: { kind: 'list', title: '借出书籍', query: { status: 'out' } } },
    { label: '书评数', count: stats.reviewCount, action: { kind: 'list', title: '有书评的书籍', query: { hasReview: true } } },
    { label: '标签', count: stats.tagCount, action: { kind: 'view', view: 'tags' } },
    { label: '分类', count: stats.categoryCount, action: { kind: 'view', view: 'categories' } },
  ];

  return (
    <div className="stats-row">
      {defs.map((d) => {
        const clickable = d.count > 0;
        const title =
          clickable && d.action.kind === 'list' ? `查看${d.action.title}` : clickable ? `打开${d.label}列表` : undefined;
        const onClick = clickable
          ? () => {
              if (d.action.kind === 'list') onOpenList(d.action.title, d.action.query);
              else onOpenView(d.action.view);
            }
          : undefined;
        const inner = (
          <>
            <div className={`stat-num ${d.color ?? ''}`}>{d.count}</div>
            <div className="stat-label">{d.label}</div>
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
