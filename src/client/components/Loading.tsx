/**
 * components/Loading.tsx —— 加载中占位（承接旧 loadingElement）。
 */
export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      <div>{text}</div>
    </div>
  );
}
