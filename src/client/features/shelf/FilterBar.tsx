/**
 * features/shelf/FilterBar.tsx —— 书架筛选栏（搜索 + 分类 + 阅读状态 + 排序）。
 * 搜索输入内置 350ms 防抖与中文输入法（composition）保护；
 * 支持在聚焦状态下连续输入（React 不会销毁输入框，无需手动恢复焦点）。
 * 排序由「字段下拉 + 方向按钮」两个控件组成，方向按钮沿用下拉触发器的视觉样式。
 */
import { useEffect, useRef, useState } from 'react';
import type { BookQuery, BookSortField, Category, ReadingStatus, SortDirection } from '../../../shared/types';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT } from '../../lib/readingStatus';
import { BOOK_SORT_OPTIONS, SORT_DIRECTION_HINT, SORT_DIRECTION_TEXT } from '../../lib/bookSort';
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

  // 排序方向：未显式选择时按「由高到低」；方向对默认排序（入库时间）同样生效
  const sortDir: SortDirection = query.sortDir ?? 'desc';
  const direction = SORT_DIRECTION_TEXT[sortDir];
  const nextSortDir: SortDirection = sortDir === 'desc' ? 'asc' : 'desc';
  // 排序组的高亮：选过排序字段，或把方向改成了非默认的升序
  const sortActive = query.sortBy != null || sortDir !== 'desc';

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
        options={READING_STATUS_OPTIONS.map((s) => ({ value: s, label: READING_STATUS_TEXT[s] }))}
        onChange={(readingStatus) => onChange({ readingStatus })}
      />
      {/* 排序组：字段下拉与方向按钮合成一个控件（共享外框 + 内部细分隔线）；
          前面的竖线把「筛选」与「排序」分成两组，它与排序组锁定在一起，
          窄屏换行时整组一起换行，竖线不会单独落在行尾。 */}
      <div className="filter-sort-wrap">
        <span className="filter-divider" aria-hidden="true" />
        <div
          className={`filter-sort-group${sortActive ? ' is-active' : ''}`}
          role="group"
          aria-label="排序"
        >
          <FilterSelect<BookSortField>
            placeholder="默认排序"
            value={query.sortBy}
            options={BOOK_SORT_OPTIONS}
            // 选择字段时保留当前方向；清除排序时方向一并复位（回到默认排序的由高到低）
            onChange={(sortBy) => onChange({ sortBy, sortDir: sortBy ? sortDir : undefined })}
          />
          <button
            type="button"
            className="filter-sort-dir"
            aria-label={`排序方向：${direction.label}，点击切换为${SORT_DIRECTION_TEXT[nextSortDir].label}`}
            title={SORT_DIRECTION_HINT[sortDir]}
            onClick={() => onChange({ sortDir: nextSortDir })}
          >
            <span className="filter-select-text">{direction.label}</span>
            <span className="filter-sort-arrow" aria-hidden="true">
              {direction.arrow}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
