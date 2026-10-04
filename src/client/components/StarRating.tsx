/**
 * components/StarRating.tsx —— 五角星评分（Lucide Star 图标）。
 * 可交互（onChange）与只读（readonly）两种形态；
 * 只读时按旧版阈值（value >= i - 0.25）点亮星星，支持 4.5 等半档展示。
 */
import { Star } from 'lucide-react';
import { useState } from 'react';

export interface StarRatingProps {
  value: number; // 0-5，可为小数
  onChange?: (value: number) => void;
  className?: string;
  /** 星星尺寸（px），默认 18 */
  size?: number;
}

export function StarRating({ value, onChange, className = '', size = 18 }: StarRatingProps) {
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
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= shown;
        return (
          <span
            key={i}
            role={interactive ? 'button' : undefined}
            aria-hidden={interactive ? undefined : true}
            className={`star${on ? ' on' : ''}`}
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
            {/* 实心星用 currentColor 填充，空心星保持描边 */}
            <Star size={size} strokeWidth={1.8} fill={on ? 'currentColor' : 'none'} />
          </span>
        );
      })}
    </span>
  );
}
