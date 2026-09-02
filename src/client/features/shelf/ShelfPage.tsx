/**
 * features/shelf/ShelfPage.tsx —— 书架主页（route '/'）。
 * 统计卡片 + 筛选栏 + 书籍网格；详情 / 按筛选出书清单以弹窗形式叠加。
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Book, BookQuery, Category, Stats } from '../../../shared/types';
import { listBooks } from '../../api/books';
import { errorMessage } from '../../api/http';
import { listCategories, getStats } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { useRefreshVersion } from '../../app/refresh';
import { BookCard } from '../books/BookCard';
import { BookDetailModal } from '../books/BookDetailModal';
import { BooksByFilterModal } from '../books/BooksByFilterModal';
import { FilterBar } from './FilterBar';
import { StatsCards } from './StatsCards';

export function ShelfPage() {
  const navigate = useNavigate();
  const dataVersion = useRefreshVersion();

  const [query, setQuery] = useState<BookQuery>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [listModal, setListModal] = useState<{ title: string; query: BookQuery } | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([getStats(), listCategories(), listBooks(query)])
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
  }, []);

  if (loading) return <Loading text="正在加载书架…" />;

  if (loadError || !stats) {
    return (
      <EmptyState icon="⚠️">
        <p>加载失败：{loadError ?? '未知错误'}</p>
      </EmptyState>
    );
  }

  return (
    <>
      <StatsCards
        stats={stats}
        onOpenList={(title, q) => setListModal({ title, query: q })}
        onOpenView={(view) => navigate(`/${view}`)}
      />

      <FilterBar categories={categories} query={query} onChange={handleFilterChange} />

      {books.length === 0 ? (
        <EmptyState icon="🪴">
          <p>书架空空如也</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>点击右上角「＋ 添加书籍」，通过 ISBN 或书名从豆瓣导入</p>
        </EmptyState>
      ) : (
        <div className="book-grid">
          {books.map((b) => (
            <BookCard key={b.id} book={b} onOpen={(id) => setDetailId(id)} />
          ))}
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
    </>
  );
}
