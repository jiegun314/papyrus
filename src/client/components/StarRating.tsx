/**
 * components/StarRating.tsx —— 五角星评分。
 *
 * 迁移说明：交互与无障碍交给 antd 的 Rate（支持 hover 预览、键盘操作），
 * 但星星图形仍用 Lucide `Star` —— 通过 Rate 的 `character` 传入，避免引入 @ant-design/icons。
 * 外观（星号尺寸 / 间距 / 金色 / 未选中灰）由 `.stars` 相关样式与本组件的 size 参数控制，
 * 与迁移前保持一致。
 */
import { Rate } from 'antd';
import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';

export interface StarRatingProps {
  value: number; // 0-5，可为小数
  onChange?: (value: number) => void;
  className?: string;
  /** 星星尺寸（px），默认 18 */
  size?: number;
}

export function StarRating({ value, onChange, className = '', size = 18 }: StarRatingProps) {
  const interactive = Boolean(onChange);
  const cls = `stars${interactive ? '' : ' readonly'}${className ? ` ${className}` : ''}`;

  return (
    <Rate
      className={cls}
      value={value}
      count={5}
      disabled={!interactive}
      onChange={(v) => onChange?.(v)}
      style={{ '--star-size': `${size}px` } as CSSProperties}
      character={<Star size={size} strokeWidth={1.8} />}
      aria-label={value ? `评分 ${value}` : '未评分'}
    />
  );
}
