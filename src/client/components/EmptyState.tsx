/**
 * components/EmptyState.tsx —— 空状态 / 出错提示占位。
 */
import type { CSSProperties, ReactNode } from 'react';

export function EmptyState({
  icon = '📖',
  children,
  compact = false,
}: {
  icon?: string;
  children: ReactNode;
  /** 紧凑模式（旧版内联 padding:40px 0 的场景） */
  compact?: boolean;
}) {
  const style: CSSProperties | undefined = compact ? { padding: '40px 0' } : undefined;
  return (
    <div className="empty-state" style={style}>
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </div>
  );
}
