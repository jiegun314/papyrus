/**
 * features/tags/TagsPage.tsx —— 标签管理页（route '/tags'）。
 * 标签来源于书籍打标；计数可点击查看该标签下书籍，可删除标签（书保留）。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Tag } from '../../../shared/types';
import { errorMessage } from '../../api/http';
import { deleteTag, listTags } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { useToast } from '../../components/Toast';
import { useRefresh } from '../../app/refresh';
import { BooksByFilterModal } from '../books/BooksByFilterModal';

export function TagsPage() {
  const toast = useToast();
  const notifyGlobal = useRefresh();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [listModal, setListModal] = useState<{ title: string; query: { tagId: number } } | null>(null);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setTags(null);
    setError(null);
    listTags()
      .then((list) => {
        if (alive) setTags(list);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const removeTag = async (t: Tag) => {
    if (!window.confirm(`确定删除标签「${t.name}」？书籍会保留，只是移除该标签。`)) return;
    try {
      await deleteTag(t.id);
      toast('标签已删除', 'success');
      reload();
      notifyGlobal();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <h3 className="view-title">🏷 标签管理</h3>

      {error ? (
        <EmptyState icon="⚠️">
          <p>加载失败：{error}</p>
        </EmptyState>
      ) : tags == null ? (
        <Loading text="正在加载标签…" />
      ) : tags.length === 0 ? (
        <EmptyState icon="🏷">
          <p>还没有标签。给书籍添加标签后会自动出现在这里。</p>
        </EmptyState>
      ) : (
        <div className="meta-list">
          {tags.map((t) => {
            const bookCount = t.bookCount ?? 0;
            return (
              <div key={t.id} className="meta-item">
                <div className="meta-left">
                  <span className="tag-chip">{t.name}</span>
                  <span
                    className={`meta-count${bookCount > 0 ? ' clickable' : ''}`}
                    title={bookCount > 0 ? `查看「${t.name}」下的全部书籍` : undefined}
                    onClick={
                      bookCount > 0
                        ? () => setListModal({ title: `标签「${t.name}」下的书籍`, query: { tagId: t.id } })
                        : undefined
                    }
                  >
                    {bookCount} 本书
                  </span>
                </div>
                <button type="button" className="btn-link danger" onClick={() => removeTag(t)}>
                  删除
                </button>
              </div>
            );
          })}
        </div>
      )}

      {listModal && (
        <BooksByFilterModal title={listModal.title} query={listModal.query} onClose={() => setListModal(null)} />
      )}
    </>
  );
}
