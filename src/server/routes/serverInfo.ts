/**
 * routes/serverInfo.ts
 * ------------------------------------------------------------------
 * 服务器状态接口：
 *   GET  /api/server-info            —— IP / 端口 / 运行环境 / 模块版本 / 访问统计
 *   POST /api/server-info/heartbeat  —— 浏览器心跳，body: { sessionId }
 */
import { Router } from 'express';
import { getServerInfo } from '../services/serverInfo.js';
import { getSessionStats, touchSession } from '../services/serverSessions.js';

export const serverInfoRouter = Router();

/** 归一化客户端 IP：去掉 IPv6-mapped 前缀与回环表示 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return '';
  const v = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return v === '::1' ? '127.0.0.1' : v;
}

// GET /api/server-info
serverInfoRouter.get('/', (_req, res) => {
  try {
    res.json(getServerInfo());
  } catch (e: any) {
    res.status(500).json({ error: e.message || '读取服务器信息失败' });
  }
});

// POST /api/server-info/heartbeat  body: { sessionId }
serverInfoRouter.post('/heartbeat', (req, res) => {
  try {
    const raw = req.body?.sessionId;
    // 会话 id 由前端生成；类型 / 长度不合法时不登记，只回当前统计，避免脏数据虚增访问数
    if (typeof raw !== 'string' || raw.length < 8 || raw.length > 64) {
      return res.json(getSessionStats());
    }

    const ip = normalizeIp(req.ip);
    const ua = String(req.headers['user-agent'] ?? '').slice(0, 200);
    res.json(touchSession(raw, ip, ua));
  } catch (e: any) {
    res.status(500).json({ error: e.message || '访问统计失败' });
  }
});
