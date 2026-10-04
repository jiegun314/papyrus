/**
 * features/shelf/SnapshotPanel.tsx —— 左侧统计列的「离线快照」模块。
 *
 * 位置：宽屏在「阅读状态」与「服务器」之间；窄屏服务器面板会移到底部，
 * 本模块仍留在统计列内（即阅读状态下方）。
 *
 * 作用：把当前书库导出成一个自包含的 HTML 文件 —— 传到手机用浏览器打开即可
 * 离线查阅、搜索藏书，不需要服务端、不需要网络、不需要安装任何 App。
 */
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import type { ExportProgress, ExportResult } from '../../app/snapshotExport';
import { buildSnapshotFile, downloadBlob } from '../../app/snapshotExport';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../api/http';
import { fmtBytes } from '../../lib/format';

/** 进度文案：区分「取数据 / 缩封面 / 读资源 / 拼装」四个阶段 */
function progressText(p: ExportProgress): string {
  switch (p.phase) {
    case 'data':
      return '正在读取书库…';
    case 'covers':
      return `正在压缩封面 ${p.done}/${p.total}`;
    case 'assets':
      return '正在内联页面资源…';
    default:
      return '正在生成文件…';
  }
}

function progressPercent(p: ExportProgress): number {
  if (p.total <= 0) return 0;
  return Math.round((p.done / p.total) * 100);
}

export function SnapshotPanel() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [last, setLast] = useState<ExportResult | null>(null);

  const run = async () => {
    setBusy(true);
    setProgress({ phase: 'data', done: 0, total: 1 });
    try {
      const { blob, result } = await buildSnapshotFile(setProgress);
      downloadBlob(blob, result.fileName);
      setLast(result);
      toast(`已导出 ${result.bookCount} 本 · ${fmtBytes(result.size)}`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <section className="stats-group snapshot-panel" aria-label="离线快照">
      <h3 className="stats-group-title">离线快照</h3>
      <p className="snapshot-hint">
        导出单个 HTML 文件，传到手机用浏览器打开即可离线查阅、搜索藏书。
      </p>
      <button
        type="button"
        className="btn btn-with-icon snapshot-btn"
        onClick={run}
        disabled={busy}
        title="导出当前书库为自包含的 HTML 文件"
      >
        <FileDown size={15} />
        {busy ? '导出中…' : '导出手机版 HTML'}
      </button>

      {progress ? (
        <div className="snapshot-progress" role="status">
          <div className="snapshot-progress-track">
            <span className="snapshot-progress-bar" style={{ width: `${progressPercent(progress)}%` }} />
          </div>
          <span className="snapshot-progress-text">{progressText(progress)}</span>
        </div>
      ) : null}

      {last && !busy ? (
        <p className="snapshot-result">
          上次导出：{last.bookCount} 本 · {fmtBytes(last.size)}
        </p>
      ) : null}
    </section>
  );
}
