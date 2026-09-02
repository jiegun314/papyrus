/**
 * features/books/BooksByFilterModal.tsx —— 某筛选条件下的书籍清单弹窗。
 * 书名可进入详情；详情内数据变更后自动刷新清单。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Book, BookQuery } from '../../../shared/types';
import { listBooks } from '../../api/books';
import { errorMessage } from '../../api/http';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { authorText } from '../../lib/format';
import { BookDetailModal } from './BookDetailModal';

export function BooksByFilterModal({
  title,
  query,
  onClose,
}: {
  title: string;
  query: BookQuery;
  onClose: () => void;
}) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setBooks(null);
    setError(null);
    listBooks(query)
      .then((list) => {
        if (!cancelled) setBooks(list);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [query, tick]);

  return (
    <>
      <Modal open onClose={onClose} title={title} size="medium">
        {error ? (
          <EmptyState icon="⚠️" compact>
            <p>{error}</p>
          </EmptyState>
        ) : books == null ? (
          <Loading text="正在加载书籍…" />
        ) : books.length === 0 ? (
          <p className="empty-state">这里暂时没有书籍。</p>
        ) : (
          <div className="book-list">
            {books.map((b) => (
              <div key={b.id} className="book-list-item">
                <button type="button" className="book-list-title" onClick={() => setDetailId(b.id)}>
                  {b.title}
                </button>
                <span className="book-list-author">{authorText(b)}</span>
                <span className="book-list-publisher">{b.publisher || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {detailId != null && (
        <BookDetailModal bookId={detailId} onClose={() => setDetailId(null)} onMutated={reload} />
      )}
    </>
  );
}

