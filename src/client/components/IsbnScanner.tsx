/**
 * components/IsbnScanner.tsx —— 调用系统摄像头扫描并识别 ISBN 条形码的弹窗。
 *
 * 自接管视频流与解码循环（不再把取流/播放交给 @zxing 的连续解码方法），以便：
 *  1) 解决 Android 冷启动时「首个流出帧即黑」的问题：发现画面冻结或纯黑，就按
 *     「取消后重扫」的方式换一条全新流，直到取到可用画面。
 *  2) 兼容 iOS Safari：必须先给 video 设 playsinline / muted / autoplay，并在设置
 *     srcObject 后立即 play()；否则 iOS 上预览始终黑屏，表现为「打不开摄像头」。
 *  3) 任何路径都会在有限时间内结束「正在启动摄像头」，绝不永久卡在启动态。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

/** 从解码结果文本中推导出干净的条码字符串；不符合则返回 null。 */
function deriveIsbn(text: string): string | null {
  const t = text.trim().replace(/[-\s]/g, '');
  if (/^\d{10}$/.test(t)) return t.toUpperCase();
  if (/^\d{12}$/.test(t)) return t;
  if (/^\d{13}$/.test(t)) return t;
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

/** 逐个构造越来越宽松的摄像头约束，兼容安卓/iOS 不同浏览器的差异。 */
async function openCameraStream(md: MediaDevices, signal?: AbortSignal): Promise<MediaStream> {
  const attempts: Array<MediaStreamConstraints & { signal?: AbortSignal }> = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, signal },
    { audio: false, video: { facingMode: { ideal: 'environment' } }, signal },
    { audio: false, video: true, signal },
    { audio: false, video: { facingMode: { ideal: 'user' } }, signal },
  ];
  let lastErr: unknown;
  for (const c of attempts) {
    try {
      return await md.getUserMedia(c);
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
    }
  }
  throw lastErr ?? new Error('NO_CAMERA');
}

/** 连续解码帧的长边上限：过高会显著增加每帧 getImageData 的内存与耗时。 */
const MAX_FRAME_EDGE = 1280;
/** 连续解码的帧间隔（毫秒）。 */
const SCAN_INTERVAL_MS = 150;
/** getUserMedia 单次超时，即便浏览器不响应 AbortSignal 也会在此后强制结束。 */
const CAMERA_TIMEOUT_MS = 8000;
/** 等待视频元数据/尺寸就绪的超时。 */
const SETUP_TIMEOUT_MS = 6000;
/** 超过该时长没有新帧，视为「冻结」。 */
const STALL_MS = 2000;
/** 画面持续纯黑超过该时长，视为「黑屏」。 */
const BLACK_MS = 2000;
/** 平均亮度低于该值（0~255）判为黑。 */
const BLACK_THRESHOLD = 16;
/** 换流前等待硬件释放的时间（等于用户手动「取消后重扫」的间隔）。 */
const RECOVER_GAP_MS = 600;
/** 最多主动换流的次数。 */
const MAX_RECOVERIES = 2;

export function IsbnScanner({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (isbn: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  const onCloseRef = useRef(onClose);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectRef.current = onDetect;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // 收集所有定时器，卸载时统一清理。
    const timeouts = new Set<number>();
    const intervals = new Set<number>();
    const addTimeout = (id: number) => (timeouts.add(id), id);
    const addInterval = (id: number) => (intervals.add(id), id);
    const sleep = (ms: number) => new Promise<void>((r) => addTimeout(window.setTimeout(r, ms)));

    let decodeTimer = 0;
    let watchTimer = 0;
    let stopFrameWatch: () => void = () => {};
    let lastFrameAt = 0;
    let blackStartAt = 0;
    let loopRecoveries = 0;

    setError(null);
    setStarting(true);
    detectedRef.current = false;

    const hints = new Map<DecodeHintType, unknown>();
    // 限定为图书常见的条形码格式，减少误判；TRY_HARDER 提升对模糊/倾斜/弱光条码的识别率。
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);

    const canvas = document.createElement('canvas');
    const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 16;
    sampleCanvas.height = 16;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    // 释放摄像头：停掉帧跟踪、清掉解码/看门狗定时器、停止轨道并清空 srcObject。
    const stopCamera = () => {
      stopFrameWatch();
      window.clearTimeout(decodeTimer);
      window.clearInterval(watchTimer);
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* 忽略 */
      }
      streamRef.current = null;
      const v = videoRef.current;
      if (v) {
        try {
          v.srcObject = null;
        } catch {
          /* 忽略 */
        }
      }
    };

    // 事件驱动地等待「视频元数据/真实尺寸就绪」，有超时，绝不无限等待。
    const waitForReady = (video: HTMLVideoElement, timeoutMs: number) =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        let tid = 0;
        const onReady = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) finish();
        };
        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(tid);
          video.removeEventListener('loadedmetadata', onReady);
          video.removeEventListener('resize', onReady);
          if (err) reject(err);
          else resolve();
        };
        if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) {
          finish();
          return;
        }
        tid = addTimeout(window.setTimeout(() => finish(new Error('VIDEO_FRAME_TIMEOUT')), timeoutMs));
        video.addEventListener('loadedmetadata', onReady);
        video.addEventListener('resize', onReady);
      });

    // 用 requestVideoFrameCallback 持续跟踪「视频是否在渲染新帧」。
    const trackFrames = (video: HTMLVideoElement) => {
      stopFrameWatch();
      if (typeof video.requestVideoFrameCallback !== 'function') return;
      let active = true;
      const onFrame = () => {
        if (!active) return;
        lastFrameAt = Date.now();
        video.requestVideoFrameCallback(onFrame);
      };
      lastFrameAt = Date.now();
      video.requestVideoFrameCallback(onFrame);
      stopFrameWatch = () => {
        active = false;
      };
    };

    // 把流接到 video 并开始播放。iOS Safari 顺序很重要：先设 playsinline/muted/autoplay，
    // 设置 srcObject 后立即 play()，否则元数据不至、预览黑屏。
    const attachStream = async (video: HTMLVideoElement, stream: MediaStream) => {
      video.playsInline = true;
      video.autoplay = true;
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.srcObject = stream;
      const playPromise = video.play().catch(() => undefined);
      await waitForReady(video, SETUP_TIMEOUT_MS);
      await Promise.race([
        playPromise,
        new Promise<void>((r) => addTimeout(window.setTimeout(r, 1000))),
      ]);
      if (cancelled) return;
      blackStartAt = 0;
      trackFrames(video);
    };

    // 单次取流，带双层超时：即便浏览器不响应 AbortSignal，也保证在 deadline 后结束，
    // 迟到的流自行释放，避免占用摄像头导致后续重试报 NotReadableError。
    const getStream = async (md: MediaDevices): Promise<MediaStream> => {
      const ac = new AbortController();
      let settled = false;
      const release = (s: MediaStream) => s.getTracks().forEach((t) => t.stop());
      const timeout = addTimeout(window.setTimeout(() => ac.abort(), CAMERA_TIMEOUT_MS));
      const p = openCameraStream(md, ac.signal).then(
        (stream) => {
          window.clearTimeout(timeout);
          if (settled) {
            release(stream);
            return Promise.reject(new Error('CANCELLED'));
          }
          settled = true;
          return stream;
        },
        (err) => {
          window.clearTimeout(timeout);
          settled = true;
          throw err;
        },
      );
      const fallback = new Promise<MediaStream>((_, reject) => {
        addTimeout(
          window.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('CAMERA_OPEN_TIMEOUT'));
          }, CAMERA_TIMEOUT_MS + 1000),
        );
      });
      return Promise.race([p, fallback]);
    };

    // 打开一条「全新」的流（先释放旧流），等价于用户手动「取消后再扫码」。
    const openOnce = async () => {
      stopCamera();
      await sleep(0);
      if (cancelled) throw new Error('CANCELLED');
      const md = navigator.mediaDevices;
      const video = videoRef.current;
      if (!md || typeof md.getUserMedia !== 'function') throw new Error('NO_MEDIA_DEVICE');
      if (!video) throw new Error('VIDEO_ELEMENT_MISSING');
      const stream = await getStream(md);
      streamRef.current = stream;
      await attachStream(video, stream);
    };

    // 启动时重试：Android 冷启动的首个流常常黑屏/冻结/给不出尺寸，换全新流再试。
    const openWithRetry = async () => {
      let attempt = 1;
      let lastErr: unknown;
      while (attempt <= MAX_RECOVERIES) {
        if (cancelled) throw new Error('CANCELLED');
        try {
          await openOnce();
          return;
        } catch (e) {
          lastErr = e;
          if (cancelled) throw new Error('CANCELLED');
          attempt += 1;
          if (attempt <= MAX_RECOVERIES) await sleep(RECOVER_GAP_MS);
        }
      }
      throw lastErr;
    };

    const scheduleDecode = () => {
      decodeTimer = addTimeout(window.setTimeout(decodeFrame, SCAN_INTERVAL_MS));
    };

    // 连续解码循环：任何解码异常都只跳到下一帧，绝不停掉摄像头。
    const decodeFrame = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || !canvasCtx) {
        scheduleDecode();
        return;
      }
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w < 1 || h < 1) {
        scheduleDecode();
        return;
      }
      const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(w, h));
      const dw = Math.max(1, Math.round(w * scale));
      const dh = Math.max(1, Math.round(h * scale));
      if (canvas.width !== dw) canvas.width = dw;
      if (canvas.height !== dh) canvas.height = dh;
      try {
        canvasCtx.drawImage(video, 0, 0, dw, dh);
        const result = reader.decodeFromCanvas(canvas);
        const isbn = result ? deriveIsbn(result.getText()) : null;
        if (isbn && !detectedRef.current) {
          detectedRef.current = true;
          onDetectRef.current(isbn);
          stopCamera();
          onCloseRef.current();
          return;
        }
      } catch {
        /* 未识别到条码 / 校验错误 / 该帧异常，均属正常，继续下一帧 */
      }
      scheduleDecode();
    };

    const recover = async () => {
      if (cancelled || loopRecoveries >= MAX_RECOVERIES) return;
      loopRecoveries += 1;
      await sleep(RECOVER_GAP_MS);
      if (cancelled) return;
      try {
        await openOnce();
      } catch (e) {
        if (cancelled) return;
        setError(describeCameraError(e));
        setStarting(false);
        return;
      }
      startWatch();
      scheduleDecode();
    };

    const startWatch = () => {
      window.clearInterval(watchTimer);
      watchTimer = addInterval(window.setInterval(watchdog, 250));
    };

    // 看门狗：检测「冻结」（长时间无新帧）或「纯黑」（整体亮度极低）并触发换流。
    const watchdog = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;
      const now = Date.now();
      let darkened = false;
      if (sampleCtx) {
        try {
          sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
          const d = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
          darkened = sum / (d.length / 4) / 3 < BLACK_THRESHOLD;
        } catch {
          darkened = false;
        }
      }
      if (darkened) {
        if (blackStartAt === 0) blackStartAt = now;
      } else {
        blackStartAt = 0;
      }
      const stalledFrame = typeof video.requestVideoFrameCallback === 'function' && now - lastFrameAt > STALL_MS;
      const blacked = blackStartAt !== 0 && now - blackStartAt > BLACK_MS;
      if (loopRecoveries < MAX_RECOVERIES && (stalledFrame || blacked)) {
        void recover();
      }
    };

    const start = async () => {
      if (!globalThis.isSecureContext) {
        setError('当前页面不是安全上下文，浏览器已禁用摄像头。请改用 https:// 或 localhost 访问本站后重试。');
        setStarting(false);
        return;
      }
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') {
        setError('当前浏览器不支持调用摄像头，请使用新版 Chrome / Edge / Safari。');
        setStarting(false);
        return;
      }
      try {
        await openWithRetry();
      } catch (e) {
        if (cancelled) return;
        setError(describeCameraError(e));
        setStarting(false);
        return;
      }
      if (cancelled) {
        stopCamera();
        return;
      }
      startWatch();
      scheduleDecode();
      setStarting(false);
    };

    void start();

    return () => {
      cancelled = true;
      timeouts.forEach((t) => window.clearTimeout(t));
      intervals.forEach((i) => window.clearInterval(i));
      stopCamera();
    };
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

