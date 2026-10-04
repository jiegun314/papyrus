/**
 * lib/useMediaQuery.ts —— 订阅 CSS 媒体查询，用于「同一块 UI 在不同断点渲染到不同位置」。
 */
import { useEffect, useState } from 'react';

/**
 * 书架双栏 → 纵向堆叠的断点。
 * ⚠️ 必须与 styles/style.css 中 `@media (max-width: 920px)` 保持一致：
 * 该断点下 `.shelf-layout` 由双栏变为纵向排布，服务器状态面板随之移到底部。
 */
export const NARROW_LAYOUT_QUERY = '(max-width: 920px)';

/** 当前是否命中媒体查询（窗口尺寸变化跨断点时自动重渲染） */
export function useMediaQuery(query: string): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches); // query 变化时同步一次
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
