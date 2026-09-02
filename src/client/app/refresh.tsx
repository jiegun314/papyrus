/**
 * app/refresh.tsx —— 全局数据刷新上下文。
 * 用于跨页面的数据失效通知（如「添加书籍」成功后要求书架重新拉取）。
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface RefreshContextValue {
  /** 递增版本号，订阅方以此触发重新加载 */
  version: number;
  /** 通知数据已变更 */
  refresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  version: 0,
  refresh: () => {},
});

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo<RefreshContextValue>(() => ({ version, refresh }), [version, refresh]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

/** 读取当前数据版本（供 useEffect 依赖） */
export function useRefreshVersion(): number {
  return useContext(RefreshContext).version;
}

/** 触发一次全局刷新 */
export function useRefresh(): () => void {
  return useContext(RefreshContext).refresh;
}
