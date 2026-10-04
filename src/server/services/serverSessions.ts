/**
 * services/serverSessions.ts
 * ------------------------------------------------------------------
 * 访问会话统计（无账号体系下的「登录 / 在线」口径）。
 *
 * 设计说明：
 *   Papyrus 是局域网个人应用，没有账号登录。这里用「浏览器会话」近似「登录」：
 *   前端为每个标签页生成一个 sessionId（存 sessionStorage），挂载时上报一次、
 *   之后每 30 秒心跳一次。据此统计：
 *     - onlineCount  在线会话数：最近 ONLINE_WINDOW_MS 内有心跳的会话
 *     - todayVisits  今日访问数：今天首次出现的会话数
 *     - totalVisits  累计访问数：历史累计的新会话数（落盘 data/server-stats.json）
 *
 * 在线状态天然只存在于内存（进程重启后重新计算）；累计 / 今日计数写入
 * data/server-stats.json，重启后不丢失。
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../db/index.js';
import type { ServerSessionStats } from '../../shared/types.js';

/** 最近多久有过心跳算「在线」（秒） */
const ONLINE_WINDOW_SECONDS = 120;
const ONLINE_WINDOW_MS = ONLINE_WINDOW_SECONDS * 1000;
/** 会话在内存中保留多久（超过则清理，避免长期运行内存无上限增长） */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
/** 每日计数保留天数 */
const DAILY_KEEP_DAYS = 14;

const STATS_FILE = path.join(DATA_DIR, 'server-stats.json');

interface SessionRecord {
  id: string;
  ip: string;
  userAgent: string;
  firstSeen: number;
  lastSeen: number;
}

interface PersistedStats {
  totalVisits: number;
  firstVisitAt: number | null;
  /** { 'YYYY-MM-DD': 当日新会话数 } */
  daily: Record<string, number>;
}

/** 内存中的活跃会话表 */
const sessions = new Map<string, SessionRecord>();

let totalVisits = 0;
let firstVisitAt: number | null = null;
let daily: Record<string, number> = {};

/** 本地日期键（YYYY-MM-DD），与用户所在时区一致 */
function todayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 启动时读取历史计数（文件不存在 / 损坏时静默忽略） */
function loadPersisted(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) as Partial<PersistedStats>;
    totalVisits = Number.isFinite(raw.totalVisits) ? Number(raw.totalVisits) : 0;
    firstVisitAt = Number.isFinite(raw.firstVisitAt) ? Number(raw.firstVisitAt) : null;
    daily = raw.daily && typeof raw.daily === 'object' ? raw.daily : {};
  } catch {
    /* 首次运行尚无统计文件，保持默认值 */
  }
}

/** 落盘累计计数（仅在有新会话时写入，频率极低） */
function savePersisted(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const data: PersistedStats = { totalVisits, firstVisitAt, daily };
    fs.writeFileSync(STATS_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.warn('[papyrus] 访问统计写入失败:', (e as Error).message);
  }
}

/** 只保留最近若干天的每日计数 */
function pruneDaily(): void {
  const keys = Object.keys(daily).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - DAILY_KEEP_DAYS))) delete daily[k];
}

/** 清理长期无心跳的会话 */
function sweep(now: number): void {
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > SESSION_TTL_MS) sessions.delete(id);
  }
}

/** 当前统计快照 */
export function getSessionStats(): ServerSessionStats {
  const now = Date.now();
  let online = 0;
  for (const s of sessions.values()) {
    if (now - s.lastSeen <= ONLINE_WINDOW_MS) online += 1;
  }
  return {
    onlineCount: online,
    todayVisits: daily[todayKey()] ?? 0,
    totalVisits,
    onlineWindowSeconds: ONLINE_WINDOW_SECONDS,
    firstVisitAt: firstVisitAt ? new Date(firstVisitAt).toISOString() : null,
  };
}

/**
 * 记录一次心跳（新会话会同时计入累计 / 今日访问数）。
 * @returns 最新的统计快照，前端可直接展示
 */
export function touchSession(sessionId: string, ip: string, userAgent: string): ServerSessionStats {
  const now = Date.now();
  const existing = sessions.get(sessionId);

  if (existing) {
    existing.lastSeen = now;
    if (ip) existing.ip = ip;
  } else {
    sessions.set(sessionId, { id: sessionId, ip, userAgent, firstSeen: now, lastSeen: now });
    totalVisits += 1;
    if (firstVisitAt == null) firstVisitAt = now;
    const key = todayKey();
    daily[key] = (daily[key] ?? 0) + 1;
    pruneDaily();
    savePersisted();
  }

  sweep(now);
  return getSessionStats();
}

// 模块加载时读取一次历史计数
loadPersisted();
