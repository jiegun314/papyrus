/**
 * features/shelf/ServerStatus.tsx —— 服务器状态面板。
 * 位于左侧统计列的「阅读状态」分组之下，展示：
 *   当前 IP / 访问地址 / 访问统计（在线·今日·累计）/ 基本服务配置 / 功能模块版本
 *
 * 数据来源：GET /api/server-info（配置与版本）+ POST /api/server-info/heartbeat（心跳）。
 * 心跳每 30 秒一次，用于统计「在线会话数」；配置信息每 2 分钟刷新一次。
 */
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ServerInfo, ServerSessionStats } from '../../../shared/types';
import { getServerInfo, sendHeartbeat } from '../../api/meta';
import { errorMessage } from '../../api/http';
import { useToast } from '../../components/Toast';

/** 心跳间隔：与后端「在线」判定窗口（120s）配合，容忍几次丢包 */
const HEARTBEAT_MS = 30_000;
/** 服务配置刷新间隔 */
const INFO_REFRESH_MS = 120_000;
/** 会话 id 在 sessionStorage 中的键名（同一标签页刷新不重复计数） */
const SESSION_KEY = 'papyrus.sessionId';

/** 取（或生成）本标签页的会话 id；非安全上下文下 randomUUID 不可用，退回随机串 */
function getSessionId(): string {
  const fallback = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : fallback();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return fallback();
  }
}

/**
 * 复制文本到剪贴板。
 * 局域网 http:// 访问属于非安全上下文，navigator.clipboard 不可用，
 * 因此保留 execCommand 兜底，保证远端设备点一下也能复制。
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续尝试 execCommand 兜底 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 秒 → 「2 天 3 小时」/「15 分 8 秒」 */
export function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}

/** ISO 时间 → 本地「YYYY-MM-DD HH:mm」 */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 一行「标签 — 值」 */
function Row({ k, v, title }: { k: string; v: string; title?: string }) {
  return (
    <div className="server-row" title={title ?? v}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function ServerStatus() {
  const toast = useToast();
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [sessions, setSessions] = useState<ServerSessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    const id = getSessionId();

    // 心跳：只更新访问统计，失败静默（下次再接上，不影响面板其它信息）
    const beat = () => {
      sendHeartbeat(id)
        .then((s) => {
          if (alive) setSessions(s);
        })
        .catch(() => {});
    };
    // 配置：IP / 端口 / 版本 / 运行时长
    const loadInfo = () => {
      getServerInfo()
        .then((d) => {
          if (!alive) return;
          setInfo(d);
          setSessions(d.sessions);
          setError(null);
        })
        .catch((e) => {
          if (alive) setError(errorMessage(e));
        });
    };

    loadInfo();
    beat();
    const hb = window.setInterval(beat, HEARTBEAT_MS);
    const rf = window.setInterval(loadInfo, INFO_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(hb);
      window.clearInterval(rf);
    };
  }, []);

  const copy = async (text: string, label: string) => {
    if (!text) return;
    const ok = await copyText(text);
    toast(ok ? `已复制${label}：${text}` : '复制失败，请手动选择文本复制', ok ? 'success' : 'error');
  };

  const cfg = info?.config;
  const ips = info?.addresses ?? [];
  const ipText = ips.length ? ips.map((a) => a.ip).join(' · ') : '—';
  // 当前页面地址（含协议与端口）——远端设备照此访问即可，比猜端口更可靠
  const currentUrl = window.location.origin;

  return (
    <section className="stats-group server-status" aria-label="服务器状态">
      <h3 className="stats-group-title">服务器</h3>

      {error && !info ? (
        <p className="server-error">状态读取失败：{error}</p>
      ) : null}

      {/* 当前 IP + 访问地址 */}
      <div className="server-block">
        <span className="server-label">当前 IP</span>
        <button
          type="button"
          className="server-copy server-ip"
          title={ips.length ? '点击复制 IP' : '未检测到局域网 IP'}
          onClick={() => copy(ips[0]?.ip ?? '', ' IP')}
        >
          {ipText}
        </button>
        <span className="server-label">访问地址</span>
        <button
          type="button"
          className="server-copy server-url"
          title="点击复制访问地址"
          onClick={() => copy(currentUrl, '访问地址')}
        >
          {currentUrl}
        </button>
      </div>

      {/* 访问统计：在线 / 今日 / 累计 */}
      <div className="server-metrics">
        <div className="server-metric" title={`最近 ${sessions?.onlineWindowSeconds ?? 120} 秒内有活动的浏览器会话`}>
          <span className="num">{sessions ? sessions.onlineCount : '—'}</span>
          <span className="lbl">在线</span>
        </div>
        <div className="server-metric" title="今天首次访问的会话数">
          <span className="num">{sessions ? sessions.todayVisits : '—'}</span>
          <span className="lbl">今日</span>
        </div>
        <div className="server-metric" title={sessions?.firstVisitAt ? `首次访问：${fmtDateTime(sessions.firstVisitAt)}` : '累计访问的会话数'}>
          <span className="num">{sessions ? sessions.totalVisits : '—'}</span>
          <span className="lbl">累计</span>
        </div>
      </div>

      {/* 基本服务配置 */}
      <div className="server-rows">
        <Row k="端口" v={cfg ? `${cfg.port}` : '—'} />
        <Row k="协议" v={cfg ? cfg.protocol.toUpperCase() : '—'} />
        <Row k="已运行" v={cfg ? fmtUptime(cfg.uptimeSeconds) : '—'} />
        <Row k="Node" v={cfg ? cfg.nodeVersion : '—'} />
        <Row k="系统" v={cfg ? cfg.platform : '—'} />
      </div>

      {/* 功能模块版本 / 运行环境版本（默认收起，避免侧栏过长） */}
      <button
        type="button"
        className="server-toggle"
        aria-expanded={showDetail}
        onClick={() => setShowDetail((v) => !v)}
      >
        {showDetail ? (
          <>
            收起版本详情 <ChevronUp size={13} className="server-toggle-caret" />
          </>
        ) : (
          <>
            模块版本 · 详情 <ChevronDown size={13} className="server-toggle-caret" />
          </>
        )}
      </button>

      {showDetail && info ? (
        <>
          <div className="server-rows">
            <Row k="主机" v={cfg?.hostname ?? '—'} />
            <Row k="数据目录" v={cfg?.dataDir ?? '—'} />
            <Row k="数据库" v={cfg?.dbPath ?? '—'} />
            <Row k="应用" v={`Papyrus v${info.appVersion}`} />
          </div>
          <div className="server-rows">
            <span className="server-label">功能模块 · v{info.features[0]?.version ?? info.appVersion}</span>
            {/* 各功能模块随应用一同发布、版本一致，故版本只在分组标题上标注一次，
                模块名单独成行，避免长名称与版本号在窄侧栏里互相挤压换行 */}
            <ul className="server-features">
              {info.features.map((m) => (
                <li key={m.name}>{m.name}</li>
              ))}
            </ul>
          </div>
          <div className="server-rows">
            <span className="server-label">运行环境 / 组件</span>
            {info.modules.map((m) => (
              <Row key={m.name} k={m.name} v={m.version} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
