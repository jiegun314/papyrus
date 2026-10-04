/**
 * services/serverInfo.ts
 * ------------------------------------------------------------------
 * 服务器状态信息采集：局域网 IP、监听端口、运行环境、数据目录、
 * 应用与依赖版本、功能模块清单。
 *
 * 供两个地方使用：
 *   1. GET /api/server-info —— 前端左侧「服务器状态」面板
 *   2. server/index.ts 启动日志 —— 直接打印可复制到手机 / 其它设备的局域网地址
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT_DIR, DATA_DIR, DB_PATH } from '../db/index.js';
import { PORT } from '../config.js';
import { getSessionStats } from './serverSessions.js';
import type { ServerAddress, ServerInfo, ServerModuleVersion } from '../../shared/types.js';

/* ---------- 应用包信息（版本号来源） ---------- */

interface PackageJson {
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')) as PackageJson;
  } catch {
    return {};
  }
}

const pkg = readPackageJson();
export const APP_VERSION = pkg.version ?? '0.0.0';

/** 功能模块清单：当前各模块随应用一同发布，版本号即应用版本 */
const FEATURE_MODULES: string[] = [
  '书架 · 检索 / 排序 / 筛选',
  '数据源 · 豆瓣',
  '数据源 · Amazon',
  '数据源 · Open Library',
  '阅读状态 · 未读 / 阅读中 / 已读 / 放弃',
  '标签 · 分类 · 星级书评',
  '电子书 · 上传 / 在线预览 / 下载',
  'ISBN 扫码录入',
  '封面本地缓存',
];

/** 展示的依赖版本（顺序即面板展示顺序） */
const DEPENDENCY_MODULES: [label: string, pkgName: string][] = [
  ['React', 'react'],
  ['React Router', 'react-router-dom'],
  ['Express', 'express'],
  ['Vite', 'vite'],
  ['TypeScript', 'typescript'],
  ['better-sqlite3', 'better-sqlite3'],
  ['Drizzle ORM', 'drizzle-orm'],
  ['cheerio', 'cheerio'],
  ['@zxing/browser', '@zxing/browser'],
];

/**
 * 读取实际安装的版本（node_modules/<pkg>/package.json），
 * 读取失败时退回 package.json 中声明的版本范围。
 */
function installedVersion(pkgName: string): string {
  try {
    const file = path.join(ROOT_DIR, 'node_modules', ...pkgName.split('/'), 'package.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string };
    if (json.version) return json.version;
  } catch {
    /* 落到下面的声明版本兜底 */
  }
  const declared = pkg.dependencies?.[pkgName] ?? pkg.devDependencies?.[pkgName];
  return declared ? declared.replace(/^[\^~>=<\s]+/, '') : '—';
}

/* ---------- 网络地址 ---------- */

/** 是否为内网 / 局域网地址（用于优先展示，方便远端访问） */
function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * 本机可被局域网访问的 IPv4 地址列表。
 * 过滤回环与 169.254 链路本地地址；内网网段优先，其余（如 Tailscale 的 100.x）排在其后。
 */
export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family !== 'IPv4' || ni.internal) continue;
      if (ni.address.startsWith('169.254.')) continue;
      if (!found.includes(ni.address)) found.push(ni.address);
    }
  }
  return found.sort((a, b) => Number(isPrivateIpv4(b)) - Number(isPrivateIpv4(a)));
}

/** 局域网访问地址（无外网 / 无线网卡时退回 localhost） */
export function accessUrls(port: number = PORT): string[] {
  const ips = lanAddresses();
  return (ips.length ? ips : ['localhost']).map((ip) => `http://${ip}:${port}`);
}

/* ---------- 汇总 ---------- */

/** 项目内的相对路径（统一用 / 分隔，避免 Windows 反斜杠） */
function relToRoot(target: string): string {
  const rel = path.relative(ROOT_DIR, target) || '.';
  return rel.split(path.sep).join('/');
}

function featureVersions(): ServerModuleVersion[] {
  return FEATURE_MODULES.map((name) => ({ name, version: APP_VERSION }));
}

function dependencyVersions(): ServerModuleVersion[] {
  return DEPENDENCY_MODULES.map(([label, pkgName]) => ({ name: label, version: installedVersion(pkgName) }));
}

/** 采集一次完整的服务器状态（每次请求实时计算运行时长与在线数） */
export function getServerInfo(): ServerInfo {
  const addresses: ServerAddress[] = accessUrls().map((url) => ({
    ip: url.replace(/^https?:\/\//, '').replace(/:\d+$/, ''),
    url,
  }));

  return {
    appName: 'Papyrus',
    appVersion: APP_VERSION,
    addresses,
    primaryUrl: addresses[0]?.url ?? `http://localhost:${PORT}`,
    config: {
      port: PORT,
      protocol: 'http',
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      nodeVersion: process.version,
      dataDir: `${relToRoot(DATA_DIR)}/`,
      dbPath: relToRoot(DB_PATH),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    features: featureVersions(),
    modules: [
      { name: 'Papyrus', version: APP_VERSION },
      { name: 'Node.js', version: process.version },
      ...dependencyVersions(),
    ],
    sessions: getSessionStats(),
  };
}
