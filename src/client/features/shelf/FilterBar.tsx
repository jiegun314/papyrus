/**
 * features/shelf/FilterBar.tsx —— 书架筛选栏（搜索 + 分类 + 阅读状态）。
 * 搜索输入内置 350ms 防抖与中文输入法（composition）保护；
 * 支持在聚焦状态下连续输入（React 不会销毁输入框，无需手动恢复焦点）。
 */
import { useEffect, useRef, useState } from 'react';
import type { BookQuery, Category, ReadingStatus } from '../../../shared/types';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT, READING_STATUS_ICON } from '../../lib/readingStatus';
import { FilterSelect } from './FilterSelect';

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
  // 清空搜索：立即生效（取消防抖），供 ESC 键与右侧叉叉按钮使用。
  const clearSearch = () => {
    window.clearTimeout(timerRef.current);
    textRef.current = '';
    setText('');
    commitSearch();
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
            if (composingRef.current) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              window.clearTimeout(timerRef.current);
              commitSearch();
            } else if (e.key === 'Escape' && text) {
              clearSearch();
            }
          }}
        />
        {text ? (
          <button
            type="button"
            className="search-clear"
            aria-label="清空搜索"
            title="清空搜索"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearSearch}
          >
            ✕
          </button>
        ) : null}
      </div>
      <FilterSelect<number>
        placeholder="全部分类"
        value={query.categoryId}
        options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        onChange={(categoryId) => onChange({ categoryId })}
      />
      <FilterSelect<ReadingStatus>
        placeholder="全部阅读状态"
        value={query.readingStatus}
        options={READING_STATUS_OPTIONS.map((s) => ({ value: s, label: READING_STATUS_TEXT[s], icon: READING_STATUS_ICON[s] }))}
        onChange={(readingStatus) => onChange({ readingStatus })}
      />
    </div>
  );
}
