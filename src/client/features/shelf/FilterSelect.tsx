/**
 * features/shelf/FilterSelect.tsx —— 书架筛选栏的自定义下拉选择控件。
 * 相比原生 <select>：
 *   - 选中项左侧可显示代表色点（如分类颜色），名称前加上颜色标识；
 *   - 已筛选时，控件右侧显示「✕」快速清除按钮；
 *   - 点击组件外部 / 按 Escape 自动关闭下拉面板。
 */
import { useEffect, useRef, useState } from 'react';

export interface FilterOption<V extends string | number> {
  value: V;
  label: string;
  /** 可选：选项代表色（如分类颜色），用于在名称前显示色点 */
  color?: string;
}

interface FilterSelectProps<V extends string | number> {
  /** 未选择时的占位文案（如「全部分类」） */
  placeholder: string;
  /** 当前值（未选择为 undefined） */
  value: V | undefined;
  options: FilterOption<V>[];
  onChange: (v: V | undefined) => void;
}

export function FilterSelect<V extends string | number>({
  placeholder,
  value,
  options,
  onChange,
}: FilterSelectProps<V>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const toggle = () => setOpen((v) => !v);

  // 点击组件外部 / 按 Escape 关闭面板
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.filter-select-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (v: V | undefined) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="filter-select" ref={rootRef}>
      <button
        type="button"
        className={`filter-select-trigger${selected ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="filter-select-label">
          {selected?.color ? (
            <span className="filter-select-dot" style={{ background: selected.color }} aria-hidden="true" />
          ) : null}
          <span className="filter-select-text">{selected ? selected.label : placeholder}</span>
        </span>
        {selected ? (
          <span
            className="filter-select-clear"
            role="button"
            aria-label="清除筛选"
            title="清除筛选"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              // 阻止冒泡到触发按钮（避免同时 toggle 面板），仅执行清除
              e.stopPropagation();
              select(undefined);
            }}
          >
            ✕
          </span>
        ) : (
          <span className="filter-select-caret" aria-hidden="true">
            ▾
          </span>
        )}
      </button>

      {open ? (
        <ul className="filter-select-menu" role="listbox">
          <li
            role="option"
            aria-selected={value == null}
            className={`filter-select-option${value == null ? ' is-selected' : ''}`}
            onClick={() => select(undefined)}
          >
            <span className="filter-select-option-label">{placeholder}</span>
          </li>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={active}
                className={`filter-select-option${active ? ' is-selected' : ''}`}
                onClick={() => select(o.value)}
              >
                {o.color ? (
                  <span className="filter-select-dot" style={{ background: o.color }} aria-hidden="true" />
                ) : null}
                <span className="filter-select-option-label">{o.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
