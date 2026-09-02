/**
 * components/Modal.tsx —— 通用弹窗（Portal 渲染到 body）。
 * 行为与旧版一致：点遮罩/Esc 关闭；多个弹窗叠加时 Esc 只关闭最上层。
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** 附加尺寸类：'' | 'small' | 'medium' */
  size?: string;
  /** 是否可点遮罩 / Esc 关闭 */
  dismissible?: boolean;
}

export function Modal({
  open,
  onClose,
  title = '',
  children,
  footer,
  size = '',
  dismissible = true,
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const backdrops = document.querySelectorAll<HTMLElement>('.modal-backdrop');
      if (backdrops.length && backdrops[backdrops.length - 1] === backdropRef.current) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal${size ? ` ${size}` : ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" title="关闭" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer != null && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
