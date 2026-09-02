/**
 * features/books/TagPickerDialog.tsx —— 设置标签弹窗。
 * 支持从已有标签勾选、回车新建标签（新建后可再点击取消）。
 */
import { useEffect, useState } from 'react';
import type { Book, Tag } from '../../../shared/types';
import { setTags } from '../../api/books';
import { listTags } from '../../api/meta';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

export function TagPickerDialog({
  book,
  open,
  onClose,
  onDone,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
  /** 保存成功后刷新书籍详情 */
  onDone: () => void;
}) {
  const toast = useToast();
  const [knownTags, setKnownTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const current = (book.tags ?? []).map((t) => t.name);
    setSelected(current);
    setInput('');
    setBusy(false);
    listTags()
      .then(setKnownTags)
      .catch(() => setKnownTags([]));
  }, [open, book]);

  const toggle = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  const addNewTag = () => {
    const name = input.trim();
    if (name && !selected.includes(name)) setSelected((prev) => [...prev, name]);
    setInput('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await setTags(book.id, selected.filter(Boolean));
      toast('标签已保存', 'success');
      onClose();
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="设置标签"
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
      <div className="tag-picker">
        {knownTags.map((t) => (
          <span
            key={t.id}
            className={`tag-chip selectable${selected.includes(t.name) ? ' active' : ''}`}
            onClick={() => toggle(t.name)}
          >
            {t.name}
          </span>
        ))}
      </div>
      <div className="add-form">
        <input
          type="text"
          placeholder="输入新标签，回车添加"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addNewTag();
            }
          }}
        />
      </div>
      <div className="tag-picker">
        {selected
          .filter((name) => !knownTags.some((t) => t.name === name))
          .map((name) => (
            <span
              key={name}
              className="tag-chip selectable active"
              onClick={() => toggle(name)}
              title="点击取消"
            >
              {name}
            </span>
          ))}
      </div>
    </Modal>
  );
}
