/**
 * features/shelf/FilterBar.tsx —— 书架筛选栏（搜索 + 分类 + 阅读状态）。
 * 搜索输入内置 350ms 防抖与中文输入法（composition）保护；
 * 支持在聚焦状态下连续输入（React 不会销毁输入框，无需手动恢复焦点）。
 */
import { useEffect, useRef, useState } from 'react';
import type { BookQuery, Category, ReadingStatus } from '../../../shared/types';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT } from '../../lib/readingStatus';

export function FilterBar({
  categories,
  query,
  onChange,
}: {
  categories: Category[];
  query: BookQuery;
  onChange: (patch: Partial<BookQuery>) => void;
}) {
  const [text, setText] = useState(query.keyword ?? '');
  const textRef = useRef(text);
  const composingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const commitSearch = () => {
    onChange({ keyword: textRef.current.trim() || undefined });
  };
  const scheduleSearch = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(commitSearch, 350);
  };

  const handleInput = (val: string) => {
    textRef.current = val;
    setText(val);
    if (composingRef.current) return;
    scheduleSearch();
  };

  return (
    <div className="filter-bar">
      <div className="search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="搜索书名 / 作者 / ISBN / 出版社…"
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
            window.clearTimeout(timerRef.current);
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            scheduleSearch();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !composingRef.current) {
              e.preventDefault();
              window.clearTimeout(timerRef.current);
              commitSearch();
            }
          }}
        />
      </div>
      <select
        className="select"
        value={query.categoryId ? String(query.categoryId) : ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ categoryId: v ? Number(v) : undefined });
        }}
      >
        <option value="">全部分类</option>
        {categories.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className="select"
        value={query.readingStatus ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ readingStatus: (v || undefined) as ReadingStatus | undefined });
        }}
      >
        <option value="">全部阅读状态</option>
        {READING_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {READING_STATUS_TEXT[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
