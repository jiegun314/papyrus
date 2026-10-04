/**
 * app/snapshot.ts —— 离线快照模式。
 *
 * 导出的单文件 HTML 里会内嵌一份 `window.__PAPYRUS_SNAPSHOT__` 数据，
 * 页面加载后本模块据此把应用切到「只读离线」状态：
 *   1. api/http.ts 拦截所有 GET 请求，改为在本模块里查内存数据；
 *   2. 写操作入口（添加 / 编辑 / 删除 / 上传）由 body.snapshot-mode 的样式隐藏；
 *   3. main.tsx 会把 BrowserRouter 换成 HashRouter（file:// 下没有服务端路由）。
 *
 * 本地查询的语义与 src/server/services/bookService.ts 的 listBooks / buildOrderBy 对齐，
 * 保证快照里的筛选、排序、分页结果与在线时一致。
 */
import type { Book, BookQuery } from '../../shared/types';
import type { Category, SnapshotData, Stats, Tag } from '../../shared/types';

declare global {
  interface Window {
    __PAPYRUS_SNAPSHOT__?: SnapshotData;
  }
}

/** 当前是否处于离线快照模式 */
export function isSnapshotMode(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__PAPYRUS_SNAPSHOT__);
}

/** 快照数据（非快照模式返回 null） */
export function snapshotData(): SnapshotData | null {
  if (typeof window === 'undefined') return null;
  return window.__PAPYRUS_SNAPSHOT__ ?? null;
}

/* ---------- 本地查询 ---------- */

/** 与服务端 SQLite `LIKE '%kw%'` 对齐的匹配（大小写不敏感） */
function like(value: string | null | undefined, kw: string): boolean {
  return value != null && value.toLowerCase().includes(kw);
}

/** 升/降序比较：字符串按码点比较（与 SQLite 的 UTF-8 字节序一致） */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 把排序方向作用到比较结果上 */
function applyDir(v: number, dir: 'asc' | 'desc'): number {
  return dir === 'asc' ? v : -v;
}

/** 无值（null / 空串）恒排末尾：与服务端 `IS NULL` 标志位语义一致 */
function nullFlag(value: unknown): number {
  return value == null || value === '' ? 1 : 0;
}

function firstAuthor(b: Book): string | null {
  return Array.isArray(b.authors) && b.authors.length > 0 ? String(b.authors[0]) : null;
}

/** 按 BookQuery 在内存里筛选 / 排序 / 分页（对应服务端 listBooks + buildOrderBy） */
export function querySnapshotBooks(query: BookQuery = {}): Book[] {
  const data = snapshotData();
  if (!data) return [];
  const dir: 'asc' | 'desc' = query.sortDir === 'asc' ? 'asc' : 'desc';

  let list = data.books.filter((b) => {
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      const hit =
        like(b.title, kw) ||
        like(b.originalTitle, kw) ||
        like(b.authors?.join(' '), kw) ||
        like(b.isbn13, kw) ||
        like(b.isbn10, kw) ||
        like(b.publisher, kw);
      if (!hit) return false;
    }
    if (query.categoryId != null && b.categoryId !== query.categoryId) return false;
    if (query.readingStatus && b.readingStatus !== query.readingStatus) return false;
    if (query.bookType && b.bookType !== query.bookType) return false;
    if (query.tagId != null && !(b.tags ?? []).some((t) => t.id === query.tagId)) return false;
    if (query.hasReview && !(b.reviews ?? []).length) return false;
    if (query.hasTag && !(b.tags ?? []).length) return false;
    if (query.hasCategory && b.categoryId == null) return false;
    return true;
  });

  // 排序：每项按服务端的排序键依次比较
  const keyByTitle = (a: Book, b: Book) => cmpStr(a.title, b.title) || a.id - b.id;
  list = list.slice().sort((a, b) => {
    switch (query.sortBy) {
      case 'title':
        return applyDir(cmpStr(a.title, b.title), dir) || a.id - b.id;
      case 'author': {
        const an = nullFlag(firstAuthor(a));
        const bn = nullFlag(firstAuthor(b));
        if (an !== bn) return an - bn; // 无作者恒排末尾
        return (
          applyDir(cmpStr(firstAuthor(a) ?? '', firstAuthor(b) ?? ''), dir) ||
          keyByTitle(a, b)
        );
      }
      case 'rating': {
        const an = nullFlag(a.ratingAverage);
        const bn = nullFlag(b.ratingAverage);
        if (an !== bn) return an - bn;
        return applyDir((a.ratingAverage ?? 0) - (b.ratingAverage ?? 0), dir) || keyByTitle(a, b);
      }
      case 'pubdate': {
        const an = nullFlag(a.pubdate);
        const bn = nullFlag(b.pubdate);
        if (an !== bn) return an - bn;
        return applyDir(cmpStr(a.pubdate ?? '', b.pubdate ?? ''), dir) || keyByTitle(a, b);
      }
      default:
        // 默认按入库时间；同值按 id
        return applyDir(cmpStr(a.createdAt, b.createdAt), dir) || applyDir(a.id - b.id, dir);
    }
  });

  const limit = Math.min(query.limit ?? 200, 500);
  const offset = query.offset ?? 0;
  return list.slice(offset, offset + limit);
}

export function snapshotBook(id: number): Book | undefined {
  return snapshotData()?.books.find((b) => b.id === id);
}

export function snapshotCategories(): Category[] {
  return snapshotData()?.categories ?? [];
}

export function snapshotTags(): Tag[] {
  return snapshotData()?.tags ?? [];
}

export function snapshotStats(): Stats | null {
  return snapshotData()?.stats ?? null;
}

/**
 * 把 GET 请求解析为快照里的数据；返回 undefined 表示「快照不包含该接口」。
 * 仅支持只读接口，写操作由 http.ts 直接拒绝。
 */
export function resolveSnapshotGet(url: string): unknown {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);

  if (path === '/api/books') {
    const query: BookQuery = {};
    const num = (k: string) => (params.has(k) ? Number(params.get(k)) : undefined);
    const str = (k: string) => params.get(k) ?? undefined;
    query.keyword = str('keyword');
    query.categoryId = num('categoryId');
    query.tagId = num('tagId');
    query.readingStatus = str('readingStatus') as BookQuery['readingStatus'];
    query.bookType = str('bookType') as BookQuery['bookType'];
    query.sortBy = str('sortBy') as BookQuery['sortBy'];
    query.sortDir = str('sortDir') as BookQuery['sortDir'];
    query.hasReview = str('hasReview') === 'true';
    query.hasTag = str('hasTag') === 'true';
    query.hasCategory = str('hasCategory') === 'true';
    query.limit = num('limit');
    query.offset = num('offset');
    return querySnapshotBooks(query);
  }

  const bookMatch = /^\/api\/books\/(\d+)$/.exec(path);
  if (bookMatch) {
    const book = snapshotBook(Number(bookMatch[1]));
    if (!book) throw new Error('该书籍不在离线快照中');
    return book;
  }

  if (path === '/api/categories') return snapshotCategories();
  if (path === '/api/tags') return snapshotTags();
  if (path === '/api/stats') {
    const stats = snapshotStats();
    if (!stats) throw new Error('离线快照缺少统计数据');
    return stats;
  }

  return undefined;
}
