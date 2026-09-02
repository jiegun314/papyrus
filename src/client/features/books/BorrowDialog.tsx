/**
 * features/books/BorrowDialog.tsx —— 借出书籍弹窗。
 */
import { useEffect, useState } from 'react';
import type { Book } from '../../../shared/types';
import { borrowBook } from '../../api/books';
import { errorMessage } from '../../api/http';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

export function BorrowDialog({
  book,
  open,
  onClose,
  onDone,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
  /** 借出成功后刷新外层数据 */
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setNote('');
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      toast('请输入借阅人姓名', 'error');
      return;
    }
    setBusy(true);
    try {
      await borrowBook(book.id, name.trim(), note.trim() || undefined);
      toast('借出成功', 'success');
      onClose();
      onDone();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="借出书籍"
      size="small"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? '借出中…' : '确认借出'}
          </button>
        </>
      }
    >
      <div className="add-form">
        <input
          type="text"
          placeholder="借阅人姓名 *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="备注（可选）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <p className="no-reviews">将把《{book.title}》借出。</p>
    </Modal>
  );
}
