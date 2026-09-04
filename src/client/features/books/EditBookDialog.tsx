/**
 * features/books/EditBookDialog.tsx —— 编辑书籍信息弹窗。
 */
import { useEffect, useState } from 'react';
import type { Book, Category } from '../../../shared/types';
import { updateBook, retryCover } from '../../api/books';
import { errorMessage } from '../../api/http';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { BookFormFields, bookFormValuesFrom, readBookFormValues } from './BookForm';

export function EditBookDialog({
  book,
  categories,
  open,
  onClose,
  onSaved,
}: {
  book: Book;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  /** 保存成功后的回调（刷新数据 / 关闭详情） */
  onSaved: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState(() => bookFormValuesFrom(book));
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(bookFormValuesFrom(book));
      setBusy(false);
      setRefreshing(false);
    }
  }, [open, book]);

  /** 重新从数据源（豆瓣/Amazon）获取封面并更新表单预览 */
  const refreshCover = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const updated = await retryCover(book.id);
      setValues((prev) => ({ ...prev, coverPath: updated.coverPath ?? '' }));
      toast('已获取在线封面', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const save = async () => {
    const data = readBookFormValues(values);
    if (!data.title.trim()) {
      toast('书名不能为空', 'error');
      return;
    }
    setBusy(true);
    try {
      await updateBook(book.id, data);
      toast('修改已保存', 'success');
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`编辑《${book.title}》`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存修改'}
          </button>
        </>
      }
    >
      <BookFormFields
        values={values}
        categories={categories}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        onRefreshOnline={refreshCover}
        refreshBusy={refreshing}
        bookId={book.id}
      />
    </Modal>
  );
}
