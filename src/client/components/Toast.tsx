/**
 * components/Toast.tsx —— 轻量消息提示（Provider + useToast）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastType = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

type ToastFn = (msg: string, type?: ToastType) => void;

const ToastContext = createContext<ToastFn | null>(null);

const ICONS: Record<ToastType, string> = { info: 'ℹ️', success: '✓', error: '✕' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ToastFn>((msg, type = 'info') => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, msg, type }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-root">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span aria-hidden="true">{ICONS[t.type]}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 <ToastProvider> 内使用');
  return ctx;
}
