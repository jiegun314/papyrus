/**
 * components/Cover.tsx —— 书籍封面占位组件。
 * 有图则渲染 <img>（可叠加 children 角标）；无图 / 加载失败回退到占位符。
 */
import { useEffect, useState, type ReactNode } from 'react';

export interface CoverProps {
  url?: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
  title?: string;
  /** 封面图片出错时回调（旧版用于「重新下载」进入可重试态） */
  onImageError?: () => void;
  /** 无封面 / 加载失败时占位内容 */
  fallback?: ReactNode;
  children?: ReactNode;
}

export function Cover({
  url,
  alt = '',
  className,
  onClick,
  title,
  onImageError,
  fallback = <span className="cover-fallback">📖</span>,
  children,
}: CoverProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const show = Boolean(url) && !failed;

  return (
    <div className={className} onClick={onClick} title={title}>
      {show ? (
        <>
          <img
            src={url!}
            alt={alt}
            loading="lazy"
            onError={() => {
              setFailed(true);
              onImageError?.();
            }}
          />
          {children}
        </>
      ) : (
        fallback
      )}
    </div>
  );
}
