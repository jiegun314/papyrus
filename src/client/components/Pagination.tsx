/**
 * components/Pagination.tsx —— 通用分页导航。
 *
 * 迁移说明：页码计算、省略号折叠、上下页禁用与无障碍全部交给 antd 的 Pagination
 * （`total` + `pageSize=1` 精确表达总页数）；上下页箭头仍用 Lucide Chevron，
 * 通过 `prevIcon` / `nextIcon` 传入，不引入 @ant-design/icons。
 * 外观（34px 方形按钮 / 8px 圆角 / 蓝色激活态 / 6px 间距）由 .pagination 相关样式对齐。
 */
import { Pagination as AntPagination } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  return (
    <AntPagination
      className="pagination"
      current={page}
      total={totalPages}
      pageSize={1}
      showSizeChanger={false}
      showLessItems
      prevIcon={<ChevronLeft size={16} />}
      nextIcon={<ChevronRight size={16} />}
      /* 省略号仍用原来的文字「…」：antd 默认会塞入 @ant-design/icons 的双箭头/省略号图标，
         与「图标统一为 Lucide」冲突，这里用 itemRender 换回纯文本 */
      itemRender={(_page, type, originalElement) =>
        type === 'jump-prev' || type === 'jump-next' ? (
          <span className="page-ellipsis">…</span>
        ) : (
          originalElement
        )
      }
      onChange={onChange}
      aria-label="分页导航"
    />
  );
}
