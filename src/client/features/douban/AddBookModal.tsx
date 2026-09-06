/**
 * features/douban/AddBookModal.tsx —— 添加书籍弹窗。
 * Tab ①：从豆瓣导入；Tab ②：Amazon 导入（英文书）；Tab ③：Open Library 导入；Tab ④：手动录入。
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import type { AmazonSearchResult, BookType, Category, DoubanSearchResult, OpenLibrarySearchResult } from '../../../shared/types';
import { createBook } from '../../api/books';
import { doubanPreview, doubanSave, doubanSearch } from '../../api/douban';
import { amazonPreview, amazonSave, amazonSearch } from '../../api/amazon';
import { openLibraryPreview, openLibrarySave, openLibrarySearch } from '../../api/openLibrary';
import { errorMessage } from '../../api/http';
import { listCategories } from '../../api/meta';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { BOOK_TYPE_OPTIONS, BOOK_TYPE_TEXT } from '../../lib/bookType';
import { fmtRating } from '../../lib/format';
import {
  BookFormFields,
  emptyBookFormValues,
  readBookFormValues,
  type BookFormValues,
} from '../books/BookForm';

type TabKey = 'douban' | 'amazon' | 'openlibrary' | 'manual';

/**
 * 扫码弹窗按需加载：@zxing/browser + @zxing/library 体积较大，若在顶层静态 import，
 * 会把这些代码塞进主包（>500 KB 触发构建警告）。这里故意改成 React.lazy——
 * 仅在用户真正点击「扫码」时（open=true）才动态加载该 chunk，从而把主包控制在小体积，
 * 也避免未用到扫码的用户首屏被拖慢。
 */
const LazyIsbnScanner = lazy(() =>
  import('../../components/IsbnScanner').then((m) => ({ default: m.IsbnScanner })),
);

/**
 * 薄封装：只有 open 时才会渲染 <LazyIsbnScanner>（触发懒加载并启动摄像头）；
 * 关闭时直接卸载，IsbnScanner 内部的 cleanup 会停止解码并释放摄像头。
 */
function ScannerSlot({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (isbn: string) => void;
}) {
  return open ? (
    <Suspense fallback={null}>
      <LazyIsbnScanner open onClose={onClose} onDetect={onDetect} />
    </Suspense>
  ) : null;
}

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
  const [bookType, setBookType] = useState<BookType>('physical');
  const [tab, setTab] = useState<TabKey>('douban');

  // 每次打开时回到默认载体类型（实体书）和「从豆瓣导入」标签
  useEffect(() => {
    if (open) {
      setBookType('physical');
      setTab('douban');
    }
  }, [open]);

  const title = (
    <span className="add-book-title">
      添加书籍
      <BookTypeSwitch value={bookType} onChange={setBookType} />
    </span>
  );

  return (
    <Modal open={open} title={title} size="large" onClose={onClose}>
      <>
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
            className={`tab${tab === 'amazon' ? ' active' : ''}`}
            onClick={() => setTab('amazon')}
          >
            ② Amazon 导入
          </button>
          <button
            type="button"
            className={`tab${tab === 'openlibrary' ? ' active' : ''}`}
            onClick={() => setTab('openlibrary')}
          >
            ③ Open Library 导入
          </button>
          <button
            type="button"
            className={`tab${tab === 'manual' ? ' active' : ''}`}
            onClick={() => setTab('manual')}
          >
            ④ 手动录入
          </button>
        </div>
        {tab === 'douban' ? (
          <DoubanPanel onSaved={onSaved} bookType={bookType} />
        ) : tab === 'amazon' ? (
          <AmazonPanel onSaved={onSaved} bookType={bookType} />
        ) : tab === 'openlibrary' ? (
          <OpenLibraryPanel onSaved={onSaved} bookType={bookType} />
        ) : (
          <ManualPanel onSaved={onSaved} bookType={bookType} />
        )}
      </>
    </Modal>
  );
}

/* ============================================================
 * 载体类型滑动切换开关（置于「添加书籍」标题右侧）
 * ============================================================ */
function BookTypeSwitch({
  value,
  onChange,
}: {
  value: BookType;
  onChange: (t: BookType) => void;
}) {
  return (
    <span className="book-type-switch" role="group" aria-label="载体类型">
      <span className={`switch-thumb ${value}`} />
      {BOOK_TYPE_OPTIONS.map((t) => (
        <button
          key={t}
          type="button"
          className={value === t ? 'active' : ''}
          aria-pressed={value === t}
          onClick={() => onChange(t)}
        >
          {BOOK_TYPE_TEXT[t]}
        </button>
      ))}
    </span>
  );
}
/* ============================================================
 * 豆瓣导入面板
 * ============================================================ */
function DoubanPanel({ onSaved, bookType }: { onSaved: () => void; bookType: BookType }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [list, setList] = useState<DoubanSearchResult[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'hint' | 'none' | 'empty' | 'error'; text?: string }>(
    { kind: 'hint', text: '支持 ISBN（如 9787544270878）、书名或作者搜索' }
  );
  const [busy, setBusy] = useState<{ preview?: string; save?: string }>({});
  const [preview, setPreview] = useState<{ detail: Record<string, unknown>; item: DoubanSearchResult } | null>(null);
  const [scanning, setScanning] = useState(false);

  const doSearch = async (kw?: string) => {
    const keyword = (kw ?? q).trim();
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
      // 豆瓣「subject_suggest」联想接口不返回出版社（只给作者/出版年），
      // 这里逐条抓取详情页在后台补齐 publisher，让第二行能显示「作者 · 出版社 · 出版日期」。
      // 不阻塞首屏：列表先渲染，出版社到一条补一条。
      enrichPublisher(items);
    } catch (e) {
      setList([]);
      setSearching(false);
      setFeedback({ kind: 'error', text: errorMessage(e) });
    }
  };

  /** 后台逐条补齐出版社信息（复用详情预览接口，豆瓣侧已做限频） */
  const enrichPublisher = (items: DoubanSearchResult[]) => {
    items.forEach((item) => {
      if (item.publisher) return; // ISBN 直达路径已带出版社，无需再补
      doubanPreview({ id: item.id })
        .then((detail) => {
          const publisher =
            typeof detail?.publisher === 'string' && detail.publisher ? detail.publisher : undefined;
          if (!publisher) return;
          setList((prev) => prev.map((it) => (it.id === item.id ? { ...it, publisher } : it)));
        })
        .catch(() => {
          // 静默失败：无出版社、被拒或用户已切换结果时保持原样
        });
    });
  };

  const handleScan = (isbn: string) => {
    setQ(isbn);
    setScanning(false);
    void doSearch(isbn);
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
      const result = await doubanSave({ searchResult: item, bookType });
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
        <button type="button" className="btn btn-primary" onClick={() => void doSearch()} disabled={searching}>
          {searching ? '搜索中…' : '搜索'}
        </button>
        <button
          type="button"
          className="btn"
          title="用摄像头扫描书籍条码，自动识别 ISBN"
          onClick={() => setScanning(true)}
        >
          📷 扫码
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
                    {item.publisher ? ` · ${item.publisher}` : ''}
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
      <ScannerSlot open={scanning} onClose={() => setScanning(false)} onDetect={handleScan} />
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
 * Amazon 导入面板（英文书）
 * ============================================================ */
function AmazonPanel({ onSaved, bookType }: { onSaved: () => void; bookType: BookType }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [list, setList] = useState<AmazonSearchResult[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'hint' | 'none' | 'empty' | 'error'; text?: string }>({
    kind: 'hint',
    text: '支持书名、作者或 ISBN（如 9780735211292）搜索 Amazon.com',
  });
  const [busy, setBusy] = useState<{ preview?: string; save?: string }>({});
  const [preview, setPreview] = useState<{ detail: Record<string, unknown>; item: AmazonSearchResult } | null>(null);
  const [scanning, setScanning] = useState(false);

  const doSearch = async (kw?: string) => {
    const keyword = (kw ?? q).trim();
    if (!keyword) {
      toast('请输入搜索内容', 'error');
      return;
    }
    setPreview(null);
    setSearching(true);
    setFeedback({ kind: 'none' });
    try {
      const items = await amazonSearch(keyword);
      setList(items);
      setSearching(false);
      setFeedback(
        items.length ? { kind: 'none' } : { kind: 'empty', text: '没有找到相关英文图书，换个关键词试试' }
      );
    } catch (e) {
      setList([]);
      setSearching(false);
      setFeedback({ kind: 'error', text: errorMessage(e) });
    }
  };

  const handleScan = (isbn: string) => {
    setQ(isbn);
    setScanning(false);
    void doSearch(isbn);
  };

  const handlePreview = async (item: AmazonSearchResult) => {
    setBusy((b) => ({ ...b, preview: item.asin }));
    try {
      const detail = await amazonPreview({ asin: item.asin });
      setPreview({ detail, item });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy((b) => ({ ...b, preview: undefined }));
    }
  };

  const handleSave = async (item: AmazonSearchResult) => {
    setBusy((b) => ({ ...b, save: item.asin }));
    try {
      const result = await amazonSave({ searchResult: item, bookType });
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
          placeholder="输入书名 / 作者 / ISBN，回车搜索 Amazon…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => void doSearch()} disabled={searching}>
          {searching ? '搜索中…' : '搜索'}
        </button>
        <button
          type="button"
          className="btn"
          title="用摄像头扫描书籍条码，自动识别 ISBN"
          onClick={() => setScanning(true)}
        >
          📷 扫码
        </button>
      </div>

      <div className="douban-results">
        {searching ? <Loading text="正在向 Amazon 请求…" /> : null}
        {!searching && (feedback.kind === 'hint' || feedback.kind === 'empty' || feedback.kind === 'error') ? (
          <EmptyState icon={feedback.kind === 'hint' ? '🔍' : feedback.kind === 'empty' ? '📭' : '⚠️'} compact>
            <p>{feedback.text}</p>
          </EmptyState>
        ) : null}
        {!searching && feedback.kind === 'none'
          ? list.map((item) => (
              <div key={item.asin} className="douban-item">
                <img
                  src={item.image}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="db-title">{item.title}</div>
                  <div className="db-meta">
                    {item.authors ?? ''}
                    {item.price ? ` · ${item.price}` : ''}
                    {item.pubdate ? ` · ${item.pubdate}` : ''}
                    {item.rating != null ? ` · ★ ${fmtRating(item.rating)}` : ''}
                  </div>
                </div>
                <div className="db-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy.preview === item.asin}
                    onClick={() => handlePreview(item)}
                  >
                    {busy.preview === item.asin ? '加载中…' : '预览'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy.save === item.asin}
                    onClick={() => handleSave(item)}
                  >
                    {busy.save === item.asin ? '保存中…' : '保存到书架'}
                  </button>
                </div>
              </div>
            ))
          : null}
      </div>

      {preview ? <AmazonPreviewPanel detail={preview.detail} item={preview.item} /> : null}
      <ScannerSlot open={scanning} onClose={() => setScanning(false)} onDetect={handleScan} />
    </div>
  );
}

/* ============================================================
 * Amazon 详情预览面板
 * ============================================================ */
function AmazonPreviewPanel({ detail, item }: { detail: Record<string, unknown>; item: AmazonSearchResult }) {
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
  if (detail.binding) metaParts.push(String(detail.binding));
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

/* ============================================================
 * Open Library 导入面板
 * ============================================================ */
function OpenLibraryPanel({ onSaved, bookType }: { onSaved: () => void; bookType: BookType }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [list, setList] = useState<OpenLibrarySearchResult[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'hint' | 'none' | 'empty' | 'error'; text?: string }>({
    kind: 'hint',
    text: '支持书名、作者或 ISBN（如 9780735211292）搜索 Open Library',
  });
  const [busy, setBusy] = useState<{ preview?: string; save?: string }>({});
  const [preview, setPreview] = useState<{ detail: Record<string, unknown>; item: OpenLibrarySearchResult } | null>(null);
  const [scanning, setScanning] = useState(false);

  const doSearch = async (kw?: string) => {
    const keyword = (kw ?? q).trim();
    if (!keyword) {
      toast('请输入搜索内容', 'error');
      return;
    }
    setPreview(null);
    setSearching(true);
    setFeedback({ kind: 'none' });
    try {
      const items = await openLibrarySearch(keyword);
      setList(items);
      setSearching(false);
      setFeedback(items.length ? { kind: 'none' } : { kind: 'empty', text: '没有找到相关图书，换个关键词试试' });
    } catch (e) {
      setList([]);
      setSearching(false);
      setFeedback({ kind: 'error', text: errorMessage(e) });
    }
  };

  const handleScan = (isbn: string) => {
    setQ(isbn);
    setScanning(false);
    void doSearch(isbn);
  };

  const handlePreview = async (item: OpenLibrarySearchResult) => {
    setBusy((b) => ({ ...b, preview: item.key }));
    try {
      const detail = await openLibraryPreview({ key: item.key, coverId: item.coverId });
      setPreview({ detail, item });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy((b) => ({ ...b, preview: undefined }));
    }
  };

  const handleSave = async (item: OpenLibrarySearchResult) => {
    setBusy((b) => ({ ...b, save: item.key }));
    try {
      const result = await openLibrarySave({ searchResult: item, bookType });
      toast(result.alreadyExists ? '这本书已在书架中' : '已保存到书架', 'success');
      onSaved();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy((b) => ({ ...b, save: undefined }));
    }
  };

  return (<div>
      <div className="add-form">
        <input
          type="text"
          placeholder="输入书名 / 作者 / ISBN，回车搜索 Open Library…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch();
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => void doSearch()} disabled={searching}>
          {searching ? '搜索中…' : '搜索'}
        </button>
        <button
          type="button"
          className="btn"
          title="用摄像头扫描书籍条码，自动识别 ISBN"
          onClick={() => setScanning(true)}
        >
          📷 扫码
        </button>
      </div>

      <div className="douban-results">
        {searching ? <Loading text="正在向 Open Library 请求…" /> : null}
        {!searching && (feedback.kind === 'hint' || feedback.kind === 'empty' || feedback.kind === 'error') ? (
          <EmptyState icon={feedback.kind === 'hint' ? '🔍' : feedback.kind === 'empty' ? '📭' : '⚠️'} compact>
            <p>{feedback.text}</p>
          </EmptyState>
        ) : null}
        {!searching && feedback.kind === 'none'
          ? list.map((item) => (
              <div key={item.key} className="douban-item">
                <img
                  src={item.coverUrl}
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
                    {item.firstPublishYear ? ` · ${item.firstPublishYear}` : ''}
                    {item.isbn ? ` · ISBN ${item.isbn}` : ''}
                    {item.pages ? ` · ${item.pages} 页` : ''}
                    {item.ratingAverage != null ? ` · ★ ${fmtRating(item.ratingAverage)}` : ''}
                  </div>
                </div>
                <div className="db-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy.preview === item.key}
                    onClick={() => handlePreview(item)}
                  >
                    {busy.preview === item.key ? '加载中…' : '预览'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy.save === item.key}
                    onClick={() => handleSave(item)}
                  >
                    {busy.save === item.key ? '保存中…' : '保存到书架'}
                  </button>
                </div>
              </div>
            ))
          : null}
      </div>

      {preview ? <OpenLibraryPreviewPanel detail={preview.detail} item={preview.item} /> : null}
      <ScannerSlot open={scanning} onClose={() => setScanning(false)} onDetect={handleScan} />
    </div>
  );
}



/* ============================================================
 * Open Library 详情预览面板
 * ============================================================ */
function OpenLibraryPreviewPanel({ detail, item }: { detail: Record<string, unknown>; item: OpenLibrarySearchResult }) {
  const imgUrl = (detail.coverUrl as string | undefined) || item.coverUrl;
  const title = String(detail.title ?? item.title);
  const authors =
    Array.isArray(detail.authors) && (detail.authors as string[]).length
      ? (detail.authors as string[]).join(' / ')
      : (item.authors ?? '');
  const metaParts: string[] = [];
  if (authors) metaParts.push(authors);
  if (detail.publisher) metaParts.push(`出版社：${String(detail.publisher)}`);
  if (detail.pubdate) metaParts.push(String(detail.pubdate));
  if (detail.pages) metaParts.push(`${String(detail.pages)} 页`);
  if (detail.isbn13) metaParts.push(`ISBN ${String(detail.isbn13)}`);
  if (detail.isbn10 && !detail.isbn13) metaParts.push(`ISBN ${String(detail.isbn10)}`);
  if (detail.binding) metaParts.push(String(detail.binding));
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


/* ============================================================
 * 手动录入面板
 * ============================================================ */
function ManualPanel({ onSaved, bookType }: { onSaved: () => void; bookType: BookType }) {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<BookFormValues>(() => ({ ...emptyBookFormValues(), bookType }));
  const [busy, setBusy] = useState(false);

  // 若用户通过顶部开关切换载体类型，同步到手动录入（保留已填内容）
  useEffect(() => {
    setValues((prev) => ({ ...prev, bookType }));
  }, [bookType]);

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
