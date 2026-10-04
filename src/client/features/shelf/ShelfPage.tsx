/**
 * features/shelf/ShelfPage.tsx —— 书架主页（route '/'）。
 * 统计卡片 + 筛选栏 + 书籍网格；详情 / 按筛选出书清单以弹窗形式叠加。
 */
import { SearchX, Sprout, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, BookQuery, Category, Stats } from '../../../shared/types';
import { listBooks } from '../../api/books';
import { errorMessage } from '../../api/http';
import { listCategories, getStats } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Pagination } from '../../components/Pagination';
import { useRefreshVersion } from '../../app/refresh';
import { BookCard } from '../books/BookCard';
import { BookDetailModal } from '../books/BookDetailModal';
import { BooksByFilterModal } from '../books/BooksByFilterModal';
import { FilterBar } from './FilterBar';
import { ServerStatus } from './ServerStatus';
import { SnapshotPanel } from './SnapshotPanel';
import { StatsCards } from './StatsCards';
import { useMediaQuery, NARROW_LAYOUT_QUERY } from '../../lib/useMediaQuery';
import { isSnapshotMode } from '../../app/snapshot';

/** 每页展示的书籍数量 */
const PAGE_SIZE = 50;
/** 拉取的上限：默认一次最多取 500 本，前端按 PAGE_SIZE 分页展示 */
const FETCH_LIMIT = 500;
/** 左侧统计列是否收起（localStorage 记忆键） */
const SIDE_HIDDEN_KEY = 'papyrus.sideHidden';

export function ShelfPage() {
  const dataVersion = useRefreshVersion();
  // 窄屏下双栏塌陷为纵向堆叠：服务器状态从左侧统计列移到所有模块最下方
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY);
  // 离线快照模式：没有服务端，隐藏「离线快照」与「服务器」两个分组
  const snapshot = isSnapshotMode();

  // 一键收起左侧统计列（PC 收起全部四组；手机收起上方三组），把空间让给书籍列表。
  // 偏好记在 localStorage，刷新后保持。
  const [sideHidden, setSideHidden] = useState(() => {
    try {
      return localStorage.getItem(SIDE_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleSide = useCallback(() => {
    setSideHidden((prev) => {
      try {
        localStorage.setItem(SIDE_HIDDEN_KEY, prev ? '0' : '1');
      } catch {
        /* 无痕模式等场景下不可写，仅影响记忆 */
      }
      return !prev;
    });
  }, []);

  const [query, setQuery] = useState<BookQuery>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [listModal, setListModal] = useState<{ title: string; query: BookQuery } | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([getStats(), listCategories(), listBooks({ ...query, limit: FETCH_LIMIT })])
      .then(([s, cs, bs]) => {
        if (!alive) return;
        setStats(s);
        setCategories(cs);
        setBooks(bs);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(errorMessage(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [query, dataVersion, tick]);

  const handleFilterChange = useCallback((patch: Partial<BookQuery>) => {
    setQuery((prev) => ({ ...prev, ...patch }));
    setPage(1); // 切换筛选 / 搜索时回到第一页
  }, []);

  // 分页计算：按 PAGE_SIZE 切出当前页数据；safePage 兜底，避免刷新后页码越界闪空
  const totalPages = Math.max(1, Math.ceil(books.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageBooks = books.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 每次数据更新后，若当前页超出总页数则自动收敛到最后一页
  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
    // 翻页后把书籍网格带回视口顶部（配合 .book-grid 的 scroll-margin 避开吸顶导航）
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // 首屏（尚未加载出任何数据）时整页 Loading；一旦展示过内容，
  // 后续的搜索 / 筛选 / 刷新只更新下方书籍区域 —— 筛选栏与搜索框始终常驻，
  // 避免请求期间卸载 <input> 导致光标失焦、无法连续输入。
  if (stats == null) {
    if (loading) return <Loading text="正在加载书架…" />;
    return (
      <EmptyState icon={<TriangleAlert size={40} strokeWidth={1.5} />}>
        <p>加载失败：{loadError ?? '未知错误'}</p>
      </EmptyState>
    );
  }

  const hasFilter = Boolean(query.keyword || query.categoryId != null || query.readingStatus);
  // 刷新期间保留上一次的书籍网格（仅更新区域内容），无旧结果时留空交给更新提示条展示
  const grid =
    pageBooks.length > 0 ? (
      <div className="book-grid" ref={gridRef}>
        {pageBooks.map((b) => (
          <BookCard key={b.id} book={b} onOpen={(id) => setDetailId(id)} />
        ))}
      </div>
    ) : null;

  // 双栏布局：左侧统计列吸顶固定，右侧为主内容（筛选栏 + 书籍区域）
  return (
    <div className={`shelf-layout${sideHidden ? ' is-side-hidden' : ''}`}>
      <aside className="shelf-side" id="shelf-side" aria-label="书架统计">
        <StatsCards
          stats={stats}
          onOpenList={(title, q) => setListModal({ title, query: q })}
        >
          {/* 顺序：阅读状态 →【离线快照】→ 服务器。
              窄屏下服务器面板移到底部，本模块仍留在统计列内（阅读状态下方）。 */}
          {snapshot ? null : <SnapshotPanel />}
          {narrow || snapshot ? null : <ServerStatus />}
        </StatsCards>
      </aside>

      <div className="shelf-main">
        <FilterBar
          categories={categories}
          query={query}
          onChange={handleFilterChange}
          sideHidden={sideHidden}
          onToggleSide={toggleSide}
        />

        {loading ? (
          <div className="shelf-refreshing" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>正在更新…</span>
          </div>
        ) : null}

        {loading ? (
          grid
        ) : loadError ? (
          <EmptyState icon={<TriangleAlert size={40} strokeWidth={1.5} />}>
            <p>加载失败：{loadError}</p>
          </EmptyState>
        ) : books.length === 0 ? (
          <EmptyState
            icon={
              hasFilter ? <SearchX size={40} strokeWidth={1.5} /> : <Sprout size={40} strokeWidth={1.5} />
            }
          >
            {hasFilter ? (
              <>
                <p>没有找到符合条件的书籍</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>试试更换关键词，或调整分类 / 阅读状态筛选</p>
              </>
            ) : (
              <>
                <p>书架空空如也</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>点击右上角的加号按钮，通过 ISBN 或书名从豆瓣导入</p>
              </>
            )}
          </EmptyState>
        ) : (
          <>
            {grid}
            {books.length > 0 && totalPages > 1 && (
              <div className="pagination-bar">
                <span className="pagination-info">
                  共 {books.length} 本 · 第 {safePage}/{totalPages} 页
                </span>
                <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* 窄屏（纵向堆叠）：服务器状态放在书架网格之后，即所有模块的最下面 */}
      {/* 窄屏：服务器面板放在所有模块最下方；离线快照里没有服务端，整块隐藏 */}
      {narrow && !snapshot && (
        <div className="shelf-server-bottom">
          <ServerStatus />
        </div>
      )}

      {listModal && (
        <BooksByFilterModal
          title={listModal.title}
          query={listModal.query}
          onClose={() => setListModal(null)}
        />
      )}
      {detailId != null && (
        <BookDetailModal bookId={detailId} onClose={() => setDetailId(null)} onMutated={reload} />
      )}
    </div>
  );
}
