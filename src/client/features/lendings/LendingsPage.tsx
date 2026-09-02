/**
 * features/lendings/LendingsPage.tsx —— 借阅记录页（route '/lendings'）。
 * 分「当前借出」「历史归还」两张表；点击书籍进入详情。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Lending } from '../../../shared/types';
import { errorMessage } from '../../api/http';
import { listLendings } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { fmtDate } from '../../lib/format';
import { BookDetailModal } from '../books/BookDetailModal';

export function LendingsPage() {
  const [borrowed, setBorrowed] = useState<Lending[] | null>(null);
  const [returned, setReturned] = useState<Lending[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setBorrowed(null);
    setReturned(null);
    setError(null);
    Promise.all([listLendings('borrowed'), listLendings('returned')])
      .then(([b, r]) => {
        if (!alive) return;
        setBorrowed(b);
        setReturned(r);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  if (error) {
    return (
      <EmptyState icon="⚠️">
        <p>加载失败：{error}</p>
      </EmptyState>
    );
  }

  if (!borrowed || !returned) return <Loading text="正在加载借阅记录…" />;

  return (
    <>
      <LendingsSection
        title="📤 当前借出"
        list={borrowed}
        isHistory={false}
        onOpenBook={(id) => setDetailId(id)}
      />
      <LendingsSection
        title="📥 历史归还"
        list={returned}
        isHistory
        onOpenBook={(id) => setDetailId(id)}
      />

      {detailId != null && (
        <BookDetailModal bookId={detailId} onClose={() => setDetailId(null)} onMutated={reload} />
      )}
    </>
  );
}

function LendingsSection({
  title,
  list,
  isHistory,
  onOpenBook,
}: {
  title: string;
  list: Lending[];
  isHistory: boolean;
  onOpenBook: (id: number) => void;
}) {
  return (
    <div className="lendings-section">
      <h3>
        {title}
        <span className="lend-count">{list.length}</span>
      </h3>

      {list.length === 0 ? (
        <EmptyState icon={isHistory ? '🗂' : '🕊'}>
          <p>{isHistory ? '还没有归还记录' : '没有正在借出的书籍'}</p>
        </EmptyState>
      ) : (
        <table className="lend-table">
          <thead>
            <tr>
              <th>书籍</th>
              <th>借阅人</th>
              <th>借出时间</th>
              <th>{isHistory ? '归还时间' : '备注'}</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td>
                  <div
                    className="td-book"
                    onClick={() => {
                      if (l.bookId) onOpenBook(l.bookId);
                    }}
                  >
                    {l.book?.coverPath ? (
                      <img
                        src={l.book.coverPath}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : null}
                    <div>
                      <div className="td-title">{l.book?.title ?? '未知书籍'}</div>
                      {l.book?.authors?.length ? (
                        <div className="td-sub">{l.book.authors.join(' / ')}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>{l.borrower}</td>
                <td>{fmtDate(l.borrowedAt)}</td>
                <td>{isHistory ? fmtDate(l.returnedAt) : l.note || '—'}</td>
                <td>
                  {l.returnedAt ? (
                    <span className="lend-badge">已归还</span>
                  ) : (
                    <span className="lend-badge active">借出中</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
