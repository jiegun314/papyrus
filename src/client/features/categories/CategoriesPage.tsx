/**
 * features/categories/CategoriesPage.tsx —— 分类管理页（route '/categories'）。
 * 新增 / 重命名 / 删除分类；分类计数可点击查看该分类下书籍。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Category } from '../../../shared/types';
import { errorMessage } from '../../api/http';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useRefresh } from '../../app/refresh';
import { BooksByFilterModal } from '../books/BooksByFilterModal';

const PALETTE = ['#b4552d', '#2d6a4f', '#1d4e89', '#8d5a2a', '#6d597a', '#2c3e50', '#a45c40', '#3a5a40'];

export function CategoriesPage() {
  const toast = useToast();
  const notifyGlobal = useRefresh();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [listModal, setListModal] = useState<{ title: string; query: { categoryId: number } } | null>(null);
  const [renameTarget, setRenameTarget] = useState<Category | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setCategories(null);
    setError(null);
    listCategories()
      .then((list) => {
        if (alive) setCategories(list);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) {
      toast('请输入分类名称', 'error');
      return;
    }
    try {
      await createCategory(name, newColor);
      toast('分类已添加', 'success');
      setNewName('');
      setNewColor(PALETTE[0]);
      reload();
      notifyGlobal();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const removeCategory = async (c: Category) => {
    if (!window.confirm(`确定删除分类「${c.name}」？分类下的书籍会变为「未分类」。`)) return;
    try {
      await deleteCategory(c.id);
      toast('分类已删除', 'success');
      reload();
      notifyGlobal();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <h3 className="view-title">📚 分类管理</h3>

      {error ? (
        <EmptyState icon="⚠️">
          <p>加载失败：{error}</p>
        </EmptyState>
      ) : categories == null ? (
        <Loading text="正在加载分类…" />
      ) : (
        <>
          <div className="meta-list">
            {categories.map((c) => {
              const bookCount = c.bookCount ?? 0;
              return (
                <div key={c.id} className="meta-item">
                  <div className="meta-left">
                    <span className="dot" style={{ background: c.color }} />
                    <span className="meta-name">{c.name}</span>
                    <span
                      className={`meta-count${bookCount > 0 ? ' clickable' : ''}`}
                      title={bookCount > 0 ? `查看「${c.name}」下的全部书籍` : undefined}
                      onClick={
                        bookCount > 0
                          ? () =>
                              setListModal({ title: `分类「${c.name}」下的书籍`, query: { categoryId: c.id } })
                          : undefined
                      }
                    >
                      {bookCount} 本书
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="btn-link" onClick={() => setRenameTarget(c)}>
                      重命名
                    </button>
                    <button type="button" className="btn-link danger" onClick={() => removeCategory(c)}>
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 新增分类 */}
          <div className="add-form">
            <input
              type="text"
              placeholder="新分类名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCategory();
              }}
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              style={{ width: 44, padding: 0 }}
            />
            <button type="button" className="btn btn-primary" onClick={addCategory}>
              添加分类
            </button>
          </div>
        </>
      )}

      {listModal && (
        <BooksByFilterModal title={listModal.title} query={listModal.query} onClose={() => setListModal(null)} />
      )}
      {renameTarget && (
        <RenameCategoryDialog
          category={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={() => {
            reload();
            notifyGlobal();
          }}
        />
      )}
    </>
  );
}

/* ============================================================
 * 重命名分类弹窗
 * ============================================================ */
function RenameCategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('分类名称不能为空', 'error');
      return;
    }
    setBusy(true);
    try {
      await updateCategory(category.id, trimmed, color);
      toast('分类已更新', 'success');
      onClose();
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="编辑分类"
      size="small"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <div className="add-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 44, padding: 0 }}
        />
      </div>
    </Modal>
  );
}
