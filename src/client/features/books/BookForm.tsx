/**
 * features/books/BookForm.tsx —— 手动录入表单（新增 / 编辑共用）。
 * 采用「受控字段组件 + 纯数据转换」设计：状态由父级持有，组件只负责渲染。
 */
import { useRef, useState, type ChangeEvent } from 'react';
import type { Book, BookInput, BookType, Category, ReadingStatus } from '../../../shared/types';
import { ebookDownloadUrl, uploadCover, uploadEbook } from '../../api/books';
import { errorMessage } from '../../api/http';
import { useToast } from '../../components/Toast';
import { BOOK_TYPE_OPTIONS, BOOK_TYPE_TEXT } from '../../lib/bookType';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT } from '../../lib/readingStatus';
import { fmtBytes } from '../../lib/format';

/** 表单原始值（输入框字符串状态） */
export interface BookFormValues {
  title: string;
  authors: string;
  subtitle: string;
  publisher: string;
  pubdate: string;
  price: string;
  pages: string;
  isbn: string;
  category: string; // '' 或分类 id 字符串
  readingStatus: ReadingStatus;
  /** 书籍载体类型：实体书 / 电子书 */
  bookType: BookType;
  summary: string;
  notes: string;
  /** 本地封面路径（/covers/xxx）；'' 表示无封面 */
  coverPath: string;
  /** 电子书文件地址（/ebooks/xxx）；'' 表示未上传 */
  ebookPath: string;
  /** 电子书原始文件名 */
  ebookFilename: string;
  /** 电子书文件大小（字节） */
  ebookSize: number;
}

export function emptyBookFormValues(): BookFormValues {
  return {
    title: '',
    authors: '',
    subtitle: '',
    publisher: '',
    pubdate: '',
    price: '',
    pages: '',
    isbn: '',
    category: '',
    readingStatus: 'unread',
    bookType: 'physical',
    summary: '',
    notes: '',
    coverPath: '',
    ebookPath: '',
    ebookFilename: '',
    ebookSize: 0,
  };
}

export function bookFormValuesFrom(initial?: Partial<Book> | null): BookFormValues {
  const v = emptyBookFormValues();
  if (!initial) return v;
  v.title = initial.title ?? '';
  v.authors = Array.isArray(initial.authors) ? initial.authors.join(', ') : '';
  v.subtitle = initial.subtitle ?? '';
  v.publisher = initial.publisher ?? '';
  v.pubdate = initial.pubdate ?? '';
  v.price = initial.price ?? '';
  v.pages = initial.pages ? String(initial.pages) : '';
  v.isbn = initial.isbn13 ?? '';
  v.category = initial.categoryId != null ? String(initial.categoryId) : '';
  v.readingStatus = initial.readingStatus ?? 'unread';
  v.bookType = initial.bookType ?? 'physical';
  v.summary = initial.summary ?? '';
  v.notes = initial.notes ?? '';
  v.coverPath = initial.coverPath ?? '';
  v.ebookPath = initial.ebookPath ?? '';
  v.ebookFilename = initial.ebookFilename ?? '';
  v.ebookSize = initial.ebookSize ?? 0;
  return v;
}

/** 由原始输入值读取提交载荷（与旧版 manualForm#read 一致） */
export function readBookFormValues(v: BookFormValues): BookInput {
  return {
    title: v.title.trim(),
    authors: v.authors
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    subtitle: v.subtitle.trim() || undefined,
    publisher: v.publisher.trim() || undefined,
    pubdate: v.pubdate.trim() || undefined,
    price: v.price.trim() || undefined,
    pages: v.pages ? Number(v.pages) : undefined,
    isbn13: v.isbn.trim() || undefined,
    categoryId: v.category ? Number(v.category) : null,
    readingStatus: v.readingStatus,
    bookType: v.bookType,
    summary: v.summary.trim() || undefined,
    notes: v.notes.trim() || undefined,
    coverPath: v.coverPath || null,
    ebookPath: v.ebookPath || null,
    ebookFilename: v.ebookFilename || null,
    ebookSize: v.ebookSize || null,
  };
}

interface TextFieldProps {
  label: string;
  value: string;
  required?: boolean;
  full?: boolean;
  type?: 'text' | 'number';
  onChange: (val: string) => void;
}

function TextField({ label, value, required, full, type = 'text', onChange }: TextFieldProps) {
  return (
    <div className={`form-field${full ? ' full' : ''}`}>
      <label>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CoverField({
  value,
  onChange,
  onRefreshOnline,
  refreshBusy,
}: {
  value: string;
  onChange: (path: string) => void;
  /** 传入后显示「刷新在线封面」按钮（编辑已有书籍时使用） */
  onRefreshOnline?: () => void;
  refreshBusy?: boolean;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选同一文件
    if (!file) return;
    setUploading(true);
    try {
      const { coverPath } = await uploadCover(file);
      onChange(coverPath);
      toast('封面已上传，保存后即生效', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-field full">
      <label>封面</label>
      <div className="cover-field">
        <div className="cover-field-preview">
          {value ? <img src={value} alt="封面预览" /> : <span className="cover-fallback">📖</span>}
        </div>
        <div className="cover-field-actions">
          <button type="button" className="btn" onClick={pick} disabled={uploading}>
            {uploading ? '上传中…' : '📤 上传封面'}
          </button>
          {value ? (
            <button type="button" className="btn-link danger" onClick={() => onChange('')}>
              清除封面
            </button>
          ) : null}
          {onRefreshOnline ? (
            <button type="button" className="btn" onClick={onRefreshOnline} disabled={refreshBusy}>
              {refreshBusy ? '获取中…' : '🔄 刷新在线封面'}
            </button>
          ) : null}
          <span className="cover-field-hint">支持 JPG / PNG / WebP / GIF</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          hidden
          onChange={onFile}
        />
      </div>
    </div>
  );
}

function EbookField({
  ebookPath,
  ebookFilename,
  ebookSize,
  bookId,
  onChange,
}: {
  ebookPath: string;
  ebookFilename: string;
  ebookSize: number;
  /** 编辑已有书籍时传入，用于生成「下载」地址 */
  bookId?: number;
  onChange: (patch: { ebookPath: string; ebookFilename: string; ebookSize: number }) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选同一文件
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadEbook(file);
      onChange({ ebookPath: r.ebookPath, ebookFilename: r.ebookFilename, ebookSize: r.ebookSize });
      toast('电子书已上传，保存后即生效', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  // 编辑模式用下载接口（原始文件名），新增模式直接用静态预览地址
  const downloadHref = bookId != null ? ebookDownloadUrl(bookId) : ebookPath;

  return (
    <div className="form-field full">
      <label>电子书文件</label>
      <div className="ebook-field">
        <div className="ebook-field-actions">
          <button type="button" className="btn" onClick={pick} disabled={uploading}>
            {uploading ? '上传中…' : '📚 上传电子书'}
          </button>
          {ebookPath ? (
            <>
              <a className="btn-link" href={ebookPath} target="_blank" rel="noreferrer">
                查看
              </a>
              <a className="btn-link" href={downloadHref}>
                下载
              </a>
              <button
                type="button"
                className="btn-link danger"
                onClick={() => onChange({ ebookPath: '', ebookFilename: '', ebookSize: 0 })}
              >
                移除
              </button>
            </>
          ) : null}
          <span className="cover-field-hint">支持 PDF / EPUB / MOBI / AZW3 / TXT 等，单文件 ≤ 100MB</span>
        </div>
        {ebookPath ? (
          <div className="ebook-file-chip">
            <span className="ebook-file-icon">📕</span>
            <span className="ebook-file-name" title={ebookFilename}>
              {ebookFilename}
            </span>
            {ebookSize ? <span className="ebook-file-size">{fmtBytes(ebookSize)}</span> : null}
          </div>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.epub,.mobi,.azw3,.txt,.docx,.doc,.rtf,application/pdf,application/epub+zip,text/plain"
          hidden
          onChange={onFile}
        />
      </div>
    </div>
  );
}

export function BookFormFields({
  values,
  categories,
  onChange,
  onRefreshOnline,
  refreshBusy,
  bookId,
}: {
  values: BookFormValues;
  categories: Category[];
  onChange: (patch: Partial<BookFormValues>) => void;
  /** 编辑已有书籍时传入，用于「刷新在线封面」 */
  onRefreshOnline?: () => void;
  refreshBusy?: boolean;
  /** 编辑已有书籍时传入，用于生成电子书「下载」地址 */
  bookId?: number;
}) {
  const set = (key: keyof BookFormValues) => (val: string) => onChange({ [key]: val });
  return (
    <div className="form-grid">
      <CoverField
        value={values.coverPath}
        onChange={(path) => onChange({ coverPath: path })}
        onRefreshOnline={onRefreshOnline}
        refreshBusy={refreshBusy}
      />
      <TextField label="书名" required full value={values.title} onChange={set('title')} />
      <TextField
        label="作者（多个用逗号分隔）"
        full
        value={values.authors}
        onChange={set('authors')}
      />
      <TextField label="副标题" value={values.subtitle} onChange={set('subtitle')} />
      <TextField label="出版社" value={values.publisher} onChange={set('publisher')} />
      <TextField label="出版年" value={values.pubdate} onChange={set('pubdate')} />
      <TextField label="定价" value={values.price} onChange={set('price')} />
      <TextField label="页数" type="number" value={values.pages} onChange={set('pages')} />
      <TextField label="ISBN" value={values.isbn} onChange={set('isbn')} />
      <div className="form-field">
        <label>分类</label>
        <select value={values.category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">（未分类）</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label>阅读状态</label>
        <select
          value={values.readingStatus}
          onChange={(e) => onChange({ readingStatus: e.target.value as ReadingStatus })}
        >
          {READING_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {READING_STATUS_TEXT[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field full">
        <label>书籍类型</label>
        <div className="seg-group">
          {BOOK_TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              className={`seg-btn${values.bookType === t ? ' active' : ''}`}
              onClick={() => onChange({ bookType: t })}
            >
              {BOOK_TYPE_TEXT[t]}
            </button>
          ))}
        </div>
      </div>
      {values.bookType === 'ebook' ? (
        <EbookField
          ebookPath={values.ebookPath}
          ebookFilename={values.ebookFilename}
          ebookSize={values.ebookSize}
          bookId={bookId}
          onChange={(patch) => onChange(patch)}
        />
      ) : null}
      <div className="form-field full">
        <label>内容简介</label>
        <textarea value={values.summary} onChange={(e) => onChange({ summary: e.target.value })} />
      </div>
      <div className="form-field full">
        <label>个人备注</label>
        <textarea value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </div>
    </div>
  );
}
