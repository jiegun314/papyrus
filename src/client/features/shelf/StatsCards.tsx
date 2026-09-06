/**
 * features/shelf/StatsCards.tsx —— 书架统计卡片（左侧分栏）。
 * 按三个语义分组展示：藏书总数 / 载体类型 / 阅读状态；
 * 每组数量 > 0 时可点击，弹出对应书籍清单。
 */
import type { BookQuery, ReadingStatus, Stats } from '../../../shared/types';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT, READING_STATUS_ICON } from '../../lib/readingStatus';

/** 每个阅读状态对应的统计数字颜色 */
const READING_COLOR: Record<ReadingStatus, string> = {
  unread: 'gray',
  reading: 'teal',
  read: 'green',
  abandoned: 'danger',
};

interface StatDef {
  label: string;
  icon?: string;
  count: number;
  color?: string;
  action: { kind: 'list'; title: string; query: BookQuery };
}

/** 单个统计卡片：数量 > 0 时可点击弹清单，否则静态展示 */
function StatCard({
  def,
  onOpenList,
}: {
  def: StatDef;
  onOpenList: (title: string, query: BookQuery) => void;
}) {
  const clickable = def.count > 0;
  const title = clickable ? `查看${def.action.title}` : undefined;
  const onClick = clickable ? () => onOpenList(def.action.title, def.action.query) : undefined;
  const inner = (
    <>
      <div className="stat-label">
        {def.icon ? <span className="stat-label-icon" aria-hidden="true">{def.icon}</span> : null}
        {def.label}
      </div>
      <div className={`stat-num ${def.color ?? ''}`}>{def.count}</div>
    </>
  );
  return clickable ? (
    <button type="button" className="stat-card clickable" title={title} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="stat-card">{inner}</div>
  );
}

export function StatsCards({
  stats,
  onOpenList,
}: {
  stats: Stats;
  onOpenList: (title: string, query: BookQuery) => void;
}) {
  // 组一：藏书总数
  const totalDef: StatDef = {
    label: '藏书总数',
    count: stats.totalBooks,
    action: { kind: 'list', title: '全部书籍', query: {} },
  };

  // 组二：载体类型
  const typeDefs: StatDef[] = [
    { label: '实体书', count: stats.physicalCount, action: { kind: 'list', title: '实体书', query: { bookType: 'physical' } } },
    { label: '电子书', count: stats.ebookCount, color: 'teal', action: { kind: 'list', title: '电子书', query: { bookType: 'ebook' } } },
  ];

  // 组三：阅读状态
  const statusDefs: StatDef[] = READING_STATUS_OPTIONS.map((s) => ({
    label: READING_STATUS_TEXT[s],
    icon: READING_STATUS_ICON[s],
    count: stats[s],
    color: READING_COLOR[s],
    action: { kind: 'list' as const, title: `${READING_STATUS_TEXT[s]}书籍`, query: { readingStatus: s } },
  }));

  const renderGroup = (title: string, defs: StatDef[]) => (
    <section className="stats-group">
      <h3 className="stats-group-title">{title}</h3>
      <div className="stats-row">
        {defs.map((def) => (
          <StatCard key={def.label} def={def} onOpenList={onOpenList} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="stats-groups">
      {renderGroup('藏书', [totalDef])}
      {renderGroup('载体', typeDefs)}
      {renderGroup('阅读状态', statusDefs)}
    </div>
  );
}

