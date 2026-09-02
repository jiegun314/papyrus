/**
 * components/StarRating.tsx —— 五角星评分。
 * 可交互（onChange）与只读（readonly）两种形态；
 * 只读时按旧版阈值（value >= i - 0.25）点亮星星，支持 4.5 等半档展示。
 */
import { useState } from 'react';

export interface StarRatingProps {
  value: number; // 0-5，可为小数
  onChange?: (value: number) => void;
  className?: string;
}

export function StarRating({ value, onChange, className = '' }: StarRatingProps) {
  const interactive = Boolean(onChange);
  const [preview, setPreview] = useState(0);
  const [selected, setSelected] = useState(() => (interactive ? Math.round(value) : 0));

  const shown = interactive ? preview || selected : Math.round(value - 0.25);
  const starCls = `stars${interactive ? '' : ' readonly'}${className ? ` ${className}` : ''}`;

  return (
    <span
      className={starCls}
      onMouseLeave={interactive ? () => setPreview(0) : undefined}
      aria-label={value ? `评分 ${value}` : '未评分'}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          role={interactive ? 'button' : undefined}
          aria-hidden={interactive ? undefined : true}
          className={`star${i <= shown ? ' on' : ''}`}
          onMouseEnter={interactive ? () => setPreview(i) : undefined}
          onClick={
            interactive
              ? () => {
                  setSelected(i);
                  onChange!(i);
                }
              : undefined
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}
