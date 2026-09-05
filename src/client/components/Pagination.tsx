/**
 * components/Pagination.tsx —— 通用分页导航。
 * 渲染 上一页 / 页码 / 下一页，页码过多时自动折叠为省略号。
 * 仅在总页数 > 1 时返回内容。
 */

/** 生成当前展示的页码序列（number 为页码，'...' 为省略号） */
function getPageItems(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(2, current - 2);
  const right = Math.min(total - 1, current + 2);
  const sorted = [...new Set<number>([1, total])]
    .concat(Array.from({ length: right - left + 1 }, (_, i) => left + i))
    .sort((a, b) => a - b);
  const items: (number | '...')[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) items.push('...');
    items.push(n);
    prev = n;
  }
  return items;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const items = getPageItems(page, totalPages);
  return (
    <nav className="pagination" aria-label="分页导航">
      <button
        type="button"
        className="page-btn page-arrow"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="上一页"
      >
        ‹
      </button>
      {items.map((it, idx) =>
        it === '...' ? (
          <span key={`ellipsis-${idx}`} className="page-ellipsis">
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            className={`page-btn${it === page ? ' active' : ''}`}
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onChange(it)}
          >
            {it}
          </button>
        )
      )}
      <button
        type="button"
        className="page-btn page-arrow"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="下一页"
      >
        ›
      </button>
    </nav>
  );
}
