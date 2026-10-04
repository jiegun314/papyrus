/**
 * app/snapshotExport.ts —— 把当前书库导出成**单个自包含 HTML 文件**。
 *
 * 流程（全部在浏览器里完成，服务端只提供一份 JSON，因此不需要任何图像处理依赖）：
 *   1. 取整库数据            GET /api/export/data
 *   2. 封面缩图              <img> → canvas 缩到 240px → WebP/JPEG data URI
 *   3. 取应用自身的 JS / CSS  直接抓当前页面加载的那两个产物文件
 *   4. 拼装单文件 HTML        CSS + 内嵌数据 + 应用 JS 全部内联
 *   5. 触发下载
 *
 * 由此得到的 HTML 双击即开、完全离线：不需要服务端、不需要网络、不需要安装任何东西。
 */
import type { Book, SnapshotData } from '../../shared/types';
import { request } from '../api/http';

/** 封面缩略图的最大宽度（px）：240 宽在手机上看已足够清晰，体积约为原图的 1/10 */
const THUMB_MAX_WIDTH = 240;
/** WebP 质量 */
const THUMB_QUALITY = 0.72;
/** 并发解码封面的数量（太高会占满内存） */
const COVER_CONCURRENCY = 4;

export interface ExportProgress {
  phase: 'data' | 'covers' | 'assets' | 'build';
  done: number;
  total: number;
}

export interface ExportResult {
  fileName: string;
  size: number;
  bookCount: number;
}

/* ---------- 工具 ---------- */

/** 取当前页面加载的应用 JS 地址（仅生产构建可用） */
function appScriptSrc(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  return el?.src ?? null;
}

/** 取当前页面加载的应用 CSS 地址 */
function appCssHref(): string | null {
  const el = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href]');
  return el?.href ?? null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`读取资源失败：${url}（${res.status}）`);
  return res.text();
}

/** 把一张封面缩成 data URI；失败返回 null（快照里回退到占位图标） */
function makeThumbnail(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, THUMB_MAX_WIDTH / img.naturalWidth);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        // 优先 WebP（体积最小），浏览器不支持时退回 JPEG
        let uri = canvas.toDataURL('image/webp', THUMB_QUALITY);
        if (!uri.startsWith('data:image/webp')) uri = canvas.toDataURL('image/jpeg', 0.75);
        resolve(uri);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 限定并发的批量执行 */
async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await task(items[index]);
    }
  });
  await Promise.all(workers);
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** 资源里若出现 `</script` / `</style` 会提前闭合标签，统一转义 */
function safeInline(text: string, tag: 'script' | 'style'): string {
  return text.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
}

/** Uint8Array → base64（分块处理，避免超长参数列表） */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function mimeOf(path: string): string {
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

/**
 * 把 CSS 里引用的外部资源（品牌字体 woff2 等）也内联成 data URI。
 * 快照是 file:// 打开的单文件，相对路径会解析到文件系统根目录而 404，
 * 因此凡是被 CSS 引用的资源都必须一起打包进去。
 */
async function inlineCssAssets(css: string, baseHref: string): Promise<string> {
  const re = /url\((['"]?)([^'")]+)\1\)/g;
  const rawUrls = new Set<string>();
  for (const m of css.matchAll(re)) {
    const raw = m[2].trim();
    if (!raw.startsWith('data:') && !raw.startsWith('#')) rawUrls.add(raw);
  }

  const inlined = new Map<string, string>();
  await Promise.all(
    [...rawUrls].map(async (raw) => {
      try {
        const abs = new URL(raw, baseHref).href;
        const res = await fetch(abs);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        inlined.set(raw, `data:${mimeOf(raw)};base64,${bytesToBase64(new Uint8Array(buf))}`);
      } catch {
        /* 取不到就保留原引用 */
      }
    })
  );

  return css.replace(re, (full, quote: string, raw: string) => {
    const data = inlined.get(raw.trim());
    return data ? `url(${quote}${data}${quote})` : full;
  });
}

/** 站点图标：内联成 data URI，快照加到手机主屏时也有图标 */
async function faviconDataUri(): Promise<string | null> {
  try {
    const res = await fetch('./favicon.svg');
    if (!res.ok) return null;
    return `data:image/svg+xml,${encodeURIComponent(await res.text())}`;
  } catch {
    return null;
  }
}

/* ---------- 主流程 ---------- */

/** 导出单文件 HTML 快照，返回 Blob 与文件名 */
export async function buildSnapshotFile(
  onProgress: (p: ExportProgress) => void
): Promise<{ blob: Blob; result: ExportResult }> {
  onProgress({ phase: 'data', done: 0, total: 1 });
  const data = await request<SnapshotData>('/api/export/data');
  onProgress({ phase: 'data', done: 1, total: 1 });

  // 封面缩图（前端完成，避免服务端引入图像库）
  const withCover = data.books.filter((b) => b.coverPath);
  const covers = new Map<number, string>();
  let done = 0;
  onProgress({ phase: 'covers', done: 0, total: withCover.length });
  await runPool<Book>(withCover, COVER_CONCURRENCY, async (b) => {
    const uri = await makeThumbnail(b.coverPath!);
    if (uri) covers.set(b.id, uri);
    done += 1;
    onProgress({ phase: 'covers', done, total: withCover.length });
  });

  // 应用自身的 JS / CSS（生产构建才有独立的产物文件）
  onProgress({ phase: 'assets', done: 0, total: 2 });
  const jsSrc = appScriptSrc();
  const cssHref = appCssHref();
  if (!jsSrc || !/\/assets\/.+\.js$/.test(jsSrc) || !cssHref) {
    throw new Error(
      '导出需要生产构建产物：请先执行 npm run build，再用 npm start 打开页面后重试（开发模式下资源是分散的，无法内联）。'
    );
  }
  const [js, cssRaw, favicon] = await Promise.all([
    fetchText(jsSrc),
    fetchText(cssHref),
    faviconDataUri(),
  ]);
  // CSS 里引用的品牌字体等资源一并内联（file:// 下相对路径会 404）
  const css = await inlineCssAssets(cssRaw, cssHref);
  onProgress({ phase: 'assets', done: 2, total: 2 });

  // 覆盖 coverPath 为内嵌缩略图；电子书文件不随快照分发（只保留文件名/大小信息，
  // 详情里的「查看 / 下载」按钮由 body.snapshot-mode 的样式隐藏）
  const snapshot: SnapshotData = {
    ...data,
    books: data.books.map((b) => ({ ...b, coverPath: covers.get(b.id) ?? null })),
  };

  onProgress({ phase: 'build', done: 0, total: 1 });
  const json = JSON.stringify(snapshot).replace(/</g, '\\u003c');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Papyrus · 离线书库（${data.books.length} 本）</title>
${favicon ? `<link rel="icon" type="image/svg+xml" href="${favicon}" />` : ''}
<style>${safeInline(css, 'style')}</style>
</head>
<body>
<div id="root"></div>
<script>window.__PAPYRUS_SNAPSHOT__=${json};</script>
<script type="module">${safeInline(js, 'script')}</script>
</body>
</html>`;
  onProgress({ phase: 'build', done: 1, total: 1 });

  const fileName = `papyrus-booklist-${fmtDate(new Date())}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return {
    blob,
    result: { fileName, size: blob.size, bookCount: data.books.length },
  };
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 交给浏览器读完再释放
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
