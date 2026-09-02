/**
 * components/ConfirmDialog.tsx —— 通用确认弹窗。
 * 确认后执行异步 onConfirm：成功自动关闭；失败弹出错误 toast 并保持打开。
 */
import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { useToast } from './Toast';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onCancel(); // 成功后由父级继续处理
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      size="small"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmText}
          </button>
        </>
      }
    >
      {message}
    </Modal>
  );
}
