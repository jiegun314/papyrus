#!/usr/bin/env node
/**
 * scripts/gen-certs.mjs —— 生成用于本地 HTTPS 的自签名证书（Vite dev server 使用）。
 *
 * 为什么需要 HTTPS：
 *   - 浏览器规定调用摄像头（getUserMedia）必须在「安全上下文」（HTTPS 或 localhost）下。
 *   - 安卓手机连电脑的开发服务器时用的是 http://<局域网IP>，不是安全上下文，摄像头会被禁用。
 *   - 所以我们为 Vite 生成一张自签名证书（含 localhost / 127.0.0.1 / 当前局域网 IP 的 SAN），
 *     让手机通过 https://<局域网IP>:5173 访问，从而能授权摄像头扫描 ISBN。
 *
 * 用法：
 *   npm run certs             # 若证书已存在则跳过
 *   npm run certs -- --force  # 强制重新生成（例如换了 Wi-Fi、局域网 IP 变化后）
 *
 * 生成产物：certs/key.pem、certs/cert.pem（已加入 .gitignore，不入库）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)); // scripts/
const projectRoot = resolve(root, '..');
const certDir = resolve(projectRoot, 'certs');
const keyPath = resolve(certDir, 'key.pem');
const certPath = resolve(certDir, 'cert.pem');

const force = process.argv.includes('--force');

const wssHost = () => {
  // macOS：en0/en1 下的局域网 IP；Linux：hostname -I 第一个地址
  for (const cmd of ['ipconfig getifaddr en0', 'ipconfig getifaddr en1']) {
    const r = spawnSync(cmd, { encoding: 'utf8', shell: true });
    const ip = (r.stdout || '').trim();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  }
  const r = spawnSync('hostname -I', { encoding: 'utf8', shell: true });
  const ip = (r.stdout || '').trim().split(/\s+/)[0];
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : '127.0.0.1';
};

if (existsSync(keyPath) && existsSync(certPath) && !force) {
  console.log(`证书已存在（${certDir}），跳过生成。`);
  console.log('若换了 Wi-Fi 导致局域网 IP 变化，请重新生成：npm run certs -- --force');
  console.log(`  证书: ${certPath}`);
  console.log(`  私钥: ${keyPath}`);
  process.exit(0);
}

const ip = wssHost();
const san = `DNS:localhost,IP:127.0.0.1,IP:${ip}`;

mkdirSync(certDir, { recursive: true });

const args = [
  'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '825', '-nodes',
  '-keyout', keyPath, '-out', certPath,
  '-subj', '/C=CN/ST=Local/L=Local/O=Papyrus/CN=localhost',
  '-addext', `subjectAltName=${san}`,
  '-addext', 'keyUsage=digitalSignature,keyEncipherment',
  '-addext', 'extendedKeyUsage=serverAuth',
];

const r = spawnSync('openssl', args, { encoding: 'utf8' });
if (r.status !== 0) {
  console.error('生成证书失败（需要 openssl）：', (r.stderr || '').trim());
  process.exit(1);
}

console.log('已生成自签名证书：');
console.log(`  证书: ${certPath}`);
console.log(`  私钥: ${keyPath}`);
console.log(`  SAN : ${san}`);
console.log('');
console.log(`安卓手机请访问（并接受证书警告）：https://${ip}:5173`);
