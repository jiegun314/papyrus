/**
 * features/douban/AddBookModal.tsx —— 添加书籍弹窗。
 * Tab ①：从豆瓣导入（搜索 → 预览 → 保存）；Tab ②：手动录入。
 */
import { useEffect, useState } from 'react';
import type { Category, DoubanSearchResult } from '../../../shared/types';
import { createBook } from '../../api/books';
import { doubanPreview, doubanSave, doubanSearch } from '../../api/douban';
import { errorMessage } from '../../api/http';
import { listCategories } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { fmtRating } from '../../lib/format';
import {
  BookFormFields,
  emptyBookFormValues,
  readBookFormValues,
  type BookFormValues,
} from '../books/BookForm';

type TabKey = 'douban' | 'manual';

export function AddBookModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** 保存成功后回调（父级：跳转书架 + 触发刷新） */
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<TabKey>('douban');

  return (
    <Modal open={open} title="添加书籍" size="medium" onClose={onClose}>
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 'douban' ? ' active' : ''}`}
          onClick={() => setTab('douban')}
        >
          ① 从豆瓣导入
        </button>
        <button
          type="button"
          className={`tab${tab === 'manual' ? ' active' : ''}`}
          onClick={() => setTab('manual')}
        >
          ② 手动录入
        </button>
      </div>
      {tab === 'douban' ? <DoubanPanel onSaved={onSaved} /> : <ManualPanel onSaved={onSaved} />}
    </Modal>
  );
}
/* ============================================================
 * 豆瓣导入面板
 * ============================================================ */
function DoubanPanel({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [list, setList] = useState<DoubanSearchResult[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'hint' | 'none' | 'empty' | 'error'; text?: string }>(
    { kind: 'hint', text: '支持 ISBN（如 9787544270878）、书名或作者搜索' }
  );
  const [busy, setBusy] = useState<{ preview?: string; save?: string }>({});
  const [preview, setPreview] = useState<{ detail: Record<string, unknown>; item: DoubanSearchResult } | null>(null);

  const doSearch = async () => {
    const keyword = q.trim();
    if (!keyword) {
      toast('请输入搜索内容', 'error');
      return;
    }
    setPreview(null);
    setSearching(true);
    setFeedback({ kind: 'none' });
    try {
      const items = await doubanSearch(keyword);
      setList(items);
      setSearching(false);
      setFeedback(
        items.length ? { kind: 'none' } : { kind: 'empty', text: '没有找到相关图书，换个关键词试试' }
      );
    } catch (e) {
      setList([]);
      setSearching(false);
      setFeedback({ kind: 'error', text: errorMessage(e) });
    }
  };

  const handlePreview = async (item: DoubanSearchResult) => {
    setBusy((b) => ({ ...b, preview: item.id }));
    try {
      const detail = await doubanPreview({ id: item.id });
      setPreview({ detail, item });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy((b) => ({ ...b, preview: undefined }));
    }
  };

  const handleSave = async (item: DoubanSearchResult) => {
    setBusy((b) => ({ ...b, save: item.id }));
    try {
      const result = await doubanSave({ searchResult: item });
      toast(result.alreadyExists ? '这本书已在书架中' : '已保存到书架', 'success');
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy((b) => ({ ...b, save: undefined }));
    }
  };

  return (
    <div>
      <div className="add-form">
        <input
          type="text"
          placeholder="输入 ISBN / 书名 / 作者，回车搜索豆瓣…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={doSearch} disabled={searching}>
          {searching ? '搜索中…' : '搜索'}
        </button>
      </div>

      <div className="douban-results">
        {searching ? <Loading text="正在向豆瓣请求…" /> : null}
        {!searching && (feedback.kind === 'hint' || feedback.kind === 'empty' || feedback.kind === 'error') ? (
          <EmptyState icon={feedback.kind === 'hint' ? '🔍' : feedback.kind === 'empty' ? '📭' : '⚠️'} compact>
            <p>{feedback.text}</p>
          </EmptyState>
        ) : null}
        {!searching && feedback.kind === 'none'
          ? list.map((item) => (
              <div key={item.id} className="douban-item">
                <img
                  src={item.image}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="db-title">
                    {item.title}
                    {item.subtitle ? (
                      <span style={{ color: 'var(--ink-faint)', fontSize: '12.5px' }}> {item.subtitle}</span>
                    ) : null}
                  </div>
                  <div className="db-meta">
                    {item.authors ?? ''}
                    {item.year ? ` · ${item.year}` : ''}
                    {item.isbn ? ` · ISBN ${item.isbn}` : ''}
                  </div>
                </div>
                <div className="db-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy.preview === item.id}
                    onClick={() => handlePreview(item)}
                  >
                    {busy.preview === item.id ? '加载中…' : '预览'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy.save === item.id}
                    onClick={() => handleSave(item)}
                  >
                    {busy.save === item.id ? '保存中…' : '保存到书架'}
                  </button>
                </div>
              </div>
            ))
          : null}
      </div>

      {preview ? <PreviewPanel detail={preview.detail} item={preview.item} /> : null}
    </div>
  );
}
/* ============================================================
 * 豆瓣详情预览面板
 * ============================================================ */
function PreviewPanel({ detail, item }: { detail: Record<string, unknown>; item: DoubanSearchResult }) {
  const imgUrl = (detail.coverUrl as string | undefined) || item.image;
  const title = String(detail.title ?? item.title);
  const authors = Array.isArray(detail.authors) ? (detail.authors as string[]).join(' / ') : '';
  const metaParts: string[] = [];
  if (authors) metaParts.push(authors);
  if (detail.publisher) metaParts.push(`出版社：${String(detail.publisher)}`);
  if (detail.pubdate) metaParts.push(String(detail.pubdate));
  if (detail.price) metaParts.push(`定价：${String(detail.price)}`);
  if (detail.pages) metaParts.push(`${String(detail.pages)} 页`);
  if (detail.isbn13) metaParts.push(`ISBN ${String(detail.isbn13)}`);
  const ratingAvg = detail.ratingAverage as number | null | undefined;
  const ratingCount = detail.ratingCount as number | undefined;

  return (
    <div className="preview-panel">
      <div className="pv-cover">
        {imgUrl ? <PreviewImage src={imgUrl} alt={title} /> : '📖'}
      </div>
      <div className="pv-info">
        <div className="pv-title">{title}</div>
        <div className="pv-meta">{metaParts.join(' · ')}</div>
        {ratingAvg != null ? (
          <div className="pv-rating">
            ★ {fmtRating(ratingAvg)}
            {ratingCount ? `（${ratingCount} 人评价）` : ''}
          </div>
        ) : null}
        {detail.summary ? (
          <div className="pv-summary">{String(detail.summary).slice(0, 300)}</div>
        ) : null}
        <div className="pv-hint">确认无误后，点「保存到书架」即可入库（会自动下载封面）。</div>
      </div>
    </div>
  );
}

function PreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>📖</>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}
/* ============================================================
 * 手动录入面板
 * ============================================================ */
function ManualPanel({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<BookFormValues>(emptyBookFormValues);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    listCategories()
      .then((cs) => {
        if (alive) setCategories(cs);
      })
      .catch(() => {
        if (alive) setCategories([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    const data = readBookFormValues(values);
    if (!data.title.trim()) {
      toast('书名不能为空', 'error');
      return;
    }
    setBusy(true);
    try {
      await createBook(data);
      toast('已保存到书架', 'success');
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <div>
      <BookFormFields
        values={values}
        categories={categories}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
      />
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 18 }}
        disabled={busy}
        onClick={save}
      >
        {busy ? '保存中…' : '保存到书架'}
      </button>
    </div>
  );
}
