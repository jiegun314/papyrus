/**
 * server/services/ebook.ts
 * ------------------------------------------------------------------
 * 电子书文件上传与本地存储。
 *
 * 电子书（PDF / EPUB / MOBI / TXT 等）以原始二进制体上传，保存到
 * data/ebooks/ 目录，并返回本地访问路径（/ebooks/xxx）及下载元数据。
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EBOOKS_DIR } from '../db/index.js';
import type { Book } from '../../shared/types.js';

/** 上传后的电子书文件信息（用于前端展示 / 入库） */
export interface EbookFileResult {
  /** 本地访问路径，如 /ebooks/abc123.pdf */
  ebookPath: string;
  /** 原始文件名（下载时作为保存名） */
  ebookFilename: string;
  /** 文件大小（字节） */
  ebookSize: number;
}

/** 根据 MIME 类型 / 原始文件名推断扩展名；未知时返回 .bin */
function extensionFor(mimeType: string, originalName?: string): string {
  const byMime: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/epub+zip': '.epub',
    'application/x-mobipocket-ebook': '.mobi',
    'application/vnd.amazon.ebook': '.azw3',
    'application/x-mobi8-ebook': '.azw3',
    'application/vnd.amazon.mobi8-ebook': '.azw3',
    'text/plain': '.txt',
    'application/rtf': '.rtf',
    'application/msword': '.doc',
    'application/octet-stream': '', // 交由文件名推断
  };
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  if (byMime[mime] !== undefined) {
    if (byMime[mime]) return byMime[mime];
  }
  const m = (originalName || '').match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '.bin';
}

/** 清理文件名中的非法字符 */
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Windows 等系统不允许出现在文件名中的字符（保留中文、[]()、空格、点、顿号等） */
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * 构造电子书下载文件名，格式：书名(作者).扩展名。
 * 多个作者以「、」连接；没有作者时省略括号部分（仅保留书名）；非法字符替换为下划线。
 */
export function buildEbookDownloadName(book: Book, filename: string): string {
  const ext = path.extname(filename) || '';
  const title = (book.title ?? '').trim() || '未命名';
  const authors = (book.authors ?? []).map((a) => a.trim()).filter(Boolean);
  const base = authors.length > 0 ? `${title}(${authors.join('、')})` : title;
  const safe = base
    .replace(ILLEGAL_FILENAME_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return `${safe}${ext}`;
}

/**
 * 保存用户上传的电子书文件（二进制体）到本地。
 * 文件名以原始文件名做基底并附加随机后缀，避免覆盖已有文件；失败返回 null。
 */
export function saveEbookFile(
  buf: Buffer,
  mimeType: string,
  originalName?: string
): EbookFileResult | null {
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) return null;
  const ext = extensionFor(mimeType, originalName);
  const base = sanitize((originalName || 'book').replace(/\.[^.]+$/, '')) || 'book';
  const filename = `${base}-${randomUUID().slice(0, 8)}${ext}`;
  const target = path.join(EBOOKS_DIR, filename);
  try {
    fs.writeFileSync(target, buf);
    return {
      ebookPath: `/ebooks/${filename}`,
      ebookFilename: originalName || filename,
      ebookSize: buf.length,
    };
  } catch {
    return null;
  }
}

/** 删除本地电子书文件 */
export function removeEbookFile(ebookPath: string | null): void {
  if (!ebookPath) return;
  // ebookPath 形如 /ebooks/xxx.pdf
  const filename = path.basename(ebookPath);
  const target = path.join(EBOOKS_DIR, filename);
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch {
    /* 忽略删除失败 */
  }
}
