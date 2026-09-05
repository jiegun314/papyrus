/**
 * features/shelf/ShelfPage.tsx —— 书架主页（route '/'）。
 * 统计卡片 + 筛选栏 + 书籍网格；详情 / 按筛选出书清单以弹窗形式叠加。
 */
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
import { StatsCards } from './StatsCards';

/** 每页展示的书籍数量 */
const PAGE_SIZE = 50;
/** 拉取的上限：默认一次最多取 500 本，前端按 PAGE_SIZE 分页展示 */
const FETCH_LIMIT = 500;

export function ShelfPage() {
  const dataVersion = useRefreshVersion();

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
      <EmptyState icon="⚠️">
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

  // 双栏布局：右侧统计卡片列吸顶固定，左侧为主内容（筛选栏 + 书籍区域）
  return (
    <div className="shelf-layout">
      <aside className="shelf-side" aria-label="书架统计">
        <StatsCards
          stats={stats}
          onOpenList={(title, q) => setListModal({ title, query: q })}
        />
      </aside>

      <div className="shelf-main">
        <FilterBar categories={categories} query={query} onChange={handleFilterChange} />

        {loading ? (
          <div className="shelf-refreshing" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>正在更新…</span>
          </div>
        ) : null}

        {loading ? (
          grid
        ) : loadError ? (
          <EmptyState icon="⚠️">
            <p>加载失败：{loadError}</p>
          </EmptyState>
        ) : books.length === 0 ? (
          <EmptyState icon={hasFilter ? '🔍' : '🪴'}>
            {hasFilter ? (
              <>
                <p>没有找到符合条件的书籍</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>试试更换关键词，或调整分类 / 阅读状态筛选</p>
              </>
            ) : (
              <>
                <p>书架空空如也</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>点击右上角「＋ 添加书籍」，通过 ISBN 或书名从豆瓣导入</p>
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
