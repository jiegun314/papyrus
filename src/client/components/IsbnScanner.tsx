/**
 * components/IsbnScanner.tsx —— 调用系统摄像头扫描并识别 ISBN 条形码的弹窗。
 *
 * 基于 @zxing/browser 的 BrowserMultiFormatReader，从手机/电脑后置摄像头视频流连续解码，
 * 仅限定 EAN-13 / EAN-8 两种图书条形码格式。解码成功后校验是否为合法 ISBN，
 * 通过 onDetect(isbn) 回调把识别到的 ISBN（自动转为不含连字符的纯数字）交回给调用方，
 * 然后停止扫描并释放摄像头。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

/** ISBN-13（EAN-13 图书码）：以 978 或 979 开头的 13 位数字。 */
const ISBN13_RE = /^9(?:78|79)\d{10}$/;
/** ISBN-10：9 位数字 + 1 位校验位（可为数字或 X）。 */
const ISBN10_RE = /^\d{9}[\dX]$/;

/** 从解码结果文本中推导出干净的 ISBN 字符串；不符合则返回 null。 */
function deriveIsbn(text: string): string | null {
  const t = text.trim().replace(/[-\s]/g, '');
  if (ISBN13_RE.test(t)) return t;
  if (ISBN10_RE.test(t)) return t.toUpperCase();
  return null;
}

/** 把浏览器给出的摄像头异常映射成更容易理解的中文提示。 */
function describeCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '未获得摄像头权限，请在浏览器地址栏允许访问摄像头后重试。';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return '未检测到摄像头，请检查设备是否接入。';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '摄像头被占用，请关闭其它正在使用摄像头的应用后重试。';
  }
  return '摄像头启动失败，请重试。';
}

export function IsbnScanner({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  /** 识别到合法 ISBN 后回调（已去掉连字符/空格）。 */
  onDetect: (isbn: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  const onCloseRef = useRef(onClose);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectRef.current = onDetect;
    onCloseRef.current = onClose;
  });

  // 打开时启动摄像头并持续解码；关闭时释放摄像头。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);
    detectedRef.current = false;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
    const reader = new BrowserMultiFormatReader(hints);

    const run = async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined, // 默认使用后置摄像头（facingMode: environment）
          videoRef.current ?? undefined,
          (result, _err, ctrl) => {
            if (!result) return; // 每帧未识别到条形码属于正常情况，忽略
            const isbn = deriveIsbn(result.getText());
            if (!isbn) return;
            if (detectedRef.current) return;
            detectedRef.current = true;
            ctrl.stop();
            onDetectRef.current(isbn);
            onCloseRef.current();
          },
        );
        controlsRef.current = controls;
        setStarting(false);
        if (cancelled) controls.stop();
      } catch (e) {
        if (cancelled) return;
        setError(describeCameraError(e));
        setStarting(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* 释放摄像头时失败可忽略 */
      }
      controlsRef.current = null;
    };
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="scanner-backdrop">
      <div className="scanner-panel" role="dialog" aria-modal="true">
        <div className="scanner-header">
          <h3>扫描 ISBN 条形码</h3>
          <button type="button" className="modal-close" title="关闭" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="scanner-video-wrap">
          <video ref={videoRef} className="scanner-video" muted playsInline autoPlay aria-label="摄像头取景画面" />
          {starting && !error ? <div className="scanner-hint">正在启动摄像头…</div> : null}
          {error ? <div className="scanner-error">{error}</div> : null}
          {!starting && !error ? (
            <div className="scanner-guide" aria-hidden="true">
              将书籍背后的条形码对准取景框
              <br />
              自动识别后即刻搜索
            </div>
          ) : null}
        </div>
        <div className="scanner-footer">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
