/**
 * features/books/BookForm.tsx —— 手动录入表单（新增 / 编辑共用）。
 * 采用「受控字段组件 + 纯数据转换」设计：状态由父级持有，组件只负责渲染。
 */
import type { Book, BookInput, Category } from '../../../shared/types';

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
  summary: string;
  notes: string;
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
    summary: '',
    notes: '',
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
  v.summary = initial.summary ?? '';
  v.notes = initial.notes ?? '';
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
    summary: v.summary.trim() || undefined,
    notes: v.notes.trim() || undefined,
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

export function BookFormFields({
  values,
  categories,
  onChange,
}: {
  values: BookFormValues;
  categories: Category[];
  onChange: (patch: Partial<BookFormValues>) => void;
}) {
  const set = (key: keyof BookFormValues) => (val: string) => onChange({ [key]: val });
  return (
    <div className="form-grid">
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
