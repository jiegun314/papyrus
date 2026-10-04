/**
 * components/EmptyState.tsx —— 空状态 / 出错提示占位。
 */
import { BookOpen } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export function EmptyState({
  icon,
  children,
  compact = false,
}: {
  /** 图标（Lucide 组件，如 <TriangleAlert />）；不传时用默认书本图标 */
  icon?: ReactNode;
  children: ReactNode;
  /** 紧凑模式（旧版内联 padding:40px 0 的场景） */
  compact?: boolean;
}) {
  const style: CSSProperties | undefined = compact ? { padding: '40px 0' } : undefined;
  return (
    <div className="empty-state" style={style}>
      <span className="empty-icon" aria-hidden="true">
        {icon ?? <BookOpen size={44} strokeWidth={1.5} />}
      </span>
      {children}
    </div>
  );
}
