/**
 * server/services/cover.ts
 * ------------------------------------------------------------------
 * 封面图片下载与本地缓存。
 *
 * 豆瓣封面图片带防盗链（必须带 Referer 才能访问），且外链可能失效。
 * 因此保存书籍时会把封面下载到本地 data/covers/ 目录，
 * 页面直接引用本地路径 /covers/xxx，避免防盗链和外链失效问题。
 */
import fs from 'node:fs';
import path from 'node:path';
import { COVERS_DIR } from '../db/index.js';

/** 下载封面到本地，返回本地访问路径（如 /covers/abc123.jpg）；失败返回 null */
export async function downloadCover(
  doubanId: string | null,
  url: string,
  fallbackName?: string,
  referer: string = 'https://book.douban.com/'
): Promise<string | null> {
  if (!url) return null;

  // 文件名：优先用豆瓣 id / ASIN，其次用书名哈希
  const name = doubanId || fallbackName || 'cover';
  const ext = guessExtension(url);
  const filename = `${sanitize(name)}${ext}`;
  const target = path.join(COVERS_DIR, filename);

  // 已存在则直接返回
  if (fs.existsSync(target)) return `/covers/${filename}`;

  try {
    // 下载时必须携带数据源 Referer（豆瓣封面防盗链；Amazon 图片不带亦可，带上更稳）
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        Referer: referer,
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null; // 太小的文件多半是错误页
    fs.writeFileSync(target, buf);
    return `/covers/${filename}`;
  } catch {
    return null;
  }
}

/** 根据 URL 推断扩展名 */
function guessExtension(url: string): string {
  const m = url.match(/\.(jpe?g|png|webp|gif)/i);
  return m ? `.${m[1].toLowerCase()}` : '.jpg';
}

/** 清理文件名中的非法字符 */
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** 删除本地封面文件 */
export function removeCover(coverPath: string | null): void {
  if (!coverPath) return;
  // coverPath 形如 /covers/xxx.jpg
  const filename = path.basename(coverPath);
  const target = path.join(COVERS_DIR, filename);
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch {
    /* 忽略删除失败 */
  }
}
