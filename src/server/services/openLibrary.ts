/**
 * server/services/openLibrary.ts
 * ------------------------------------------------------------------
 * Open Library 数据抓取服务。
 *
 * Open Library 有公开、无需凭证的搜索 API（https://openlibrary.org/dev/docs/api/search）：
 *
 *  1) 搜索：https://openlibrary.org/search.json?q=xxx&fields=...&limit=30
 *     返回 { numFound, docs: [...] }，每个 doc 聚合了 Work 级与 Edition 级字段：
 *     key（work key）、title、subtitle、author_name[]、first_publish_year、cover_i、
 *     isbn[]、publisher[]、number_of_pages_median、edition_count、language[]、
 *     ratings_average、ratings_count 等。
 *
 *  2) 详情：https://openlibrary.org/works/{key}.json
 *     返回作品描述（description 可能是 {type,value} 对象）、subjects[]、
 *     first_publish_date、covers[] 等。
 *
 *  3) 版本：https://openlibrary.org/works/{key}/editions.json?limit=N
 *     返回 { entries: [...] }，每条为某个具体版本，含 publishers[]、isbn_13[]、
 *     isbn_10[]、number_of_pages、publish_date、physical_format、subtitle 等，
 *     用于补全更准确的出版社 / ISBN / 页数。
 *
 *  4) 封面：https://covers.openlibrary.org/b/id/{cover_id}-{M|L}.jpg
 *
 * 注意：Open Library 对请求频率友好，但仍建议带上 User-Agent 并做基础节流、控制单次搜索量。
 */
import type { OpenLibrarySearchResult } from '../../shared/types.js';

const SEARCH_BASE = 'https://openlibrary.org/search.json';
const WORK_BASE = 'https://openlibrary.org';
const COVERS_BASE = 'https://covers.openlibrary.org';

/** 模拟浏览器/应用请求头，Open Library 官方建议带上可识别的 User-Agent */
const HEADERS = {
  'User-Agent': 'Papyrus/2.0 (personal book manager; +https://github.com/papyrus)',
  Accept: 'application/json',
};

/** 两次请求之间的最小间隔（毫秒） */
const MIN_INTERVAL_MS = 400;
let lastRequestAt = 0;

async function throttledFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url, { headers: HEADERS });
  lastRequestAt = Date.now();
  return res;
}

/* ------------------------------------------------------------------ */
/* 私有辅助函数                                                        */
/* ------------------------------------------------------------------ */

/** 将任意值转成有限数字，空值返回 undefined */
function toNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 从 Open Library isbn 数组里挑一个像样的 ISBN（优先 13 位 978 开头，否则任取一个有效值） */
function pickIsbn(isbns: unknown): string | undefined {
  if (!Array.isArray(isbns)) return undefined;
  const clean = isbns
    .map((s) => String(s).trim())
    .filter((s) => /^(?:\d{9}[\dXx]|\d{13})$/.test(s))
    .map((s) => s.toUpperCase());
  if (clean.length === 0) return undefined;
  return clean.find((s) => s.length === 13 && s.startsWith('978')) || clean[0];
}

/** 从出版社数组里挑一个合理的出版社（跳过占位项 / 极短项） */
function pickPublisher(publishers: unknown): string | undefined {
  if (!Array.isArray(publishers)) return undefined;
  const arr = publishers.map((s) => String(s).trim()).filter((s) => s && s.length >= 3);
  const plausible = arr.filter((s) => !/unknown publisher/i.test(s));
  return (plausible.length ? plausible : arr)[0];
}

/** 根据 cover_id 构造封面 URL */
function coverUrlFromId(id: unknown, size: 'M' | 'L'): string | undefined {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${COVERS_BASE}/b/id/${n}-${size}.jpg`;
}

/** 清洗 work key：接受 /works/OLxxxW、works/OLxxxW、OLxxxW 等写法，统一为 /works/OLxxxW */
function normalizeWorkKey(key: string): string {
  const k = key.trim();
  if (k.includes('/works/')) return k.substring(k.indexOf('/works/'));
  if (k.startsWith('works/')) return `/${k}`;
  return `/works/${k}`;
}

/** 取出数组或空数组 */
function asArray(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

/** 返回数组中第一个正整数（Open Library 的 covers 数组可能含 -1 占位） */
function firstPositive(arr: any[]): number | undefined {
  for (const x of arr) {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** 描述字段可能是字符串或 { type, value } 对象 */
function extractDescription(desc: unknown): string | undefined {
  if (desc == null) return undefined;
  if (typeof desc === 'string') return desc.length ? desc : undefined;
  if (typeof desc === 'object') {
    const v = (desc as any).value;
    if (typeof v === 'string' && v.length) return v;
  }
  return undefined;
}

/** 把 "2021-03-08" / "October 16, 2018" / "1884" 归化成 "YYYY-MM" 或 "YYYY" */
function compactDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  let m = s.match(/(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/(\d{4})[-/年](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/([A-Za-z]+)\s+\d{1,2},\s*(\d{4})/);
  if (m) {
    const map: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    };
    const mm = map[m[1].toLowerCase()];
    if (mm) return `${m[2]}-${mm}`;
    return m[2];
  }
  m = s.match(/(\d{4})/);
  return m ? m[1] : undefined;
}
/* ------------------------------------------------------------------ */
/* 搜索                                                                */
/* ------------------------------------------------------------------ */

/** 把一条搜索文档映射为前端可展示的结果条目 */
function mapSearchDoc(d: any): OpenLibrarySearchResult | null {
  const key = d?.key ? normalizeWorkKey(String(d.key)) : '';
  const title = typeof d.title === 'string' ? d.title.trim() : '';
  if (!key || !title) return null;
  const authors =
    Array.isArray(d.author_name) && d.author_name.length
      ? d.author_name.map(String).filter(Boolean).join(', ')
      : undefined;
  const coverId = toNumber(d.cover_i);
  return {
    key,
    title,
    subtitle: typeof d.subtitle === 'string' && d.subtitle ? d.subtitle : undefined,
    authors,
    coverUrl: coverUrlFromId(coverId, 'M'),
    coverId,
    firstPublishYear: toNumber(d.first_publish_year),
    editionCount: toNumber(d.edition_count),
    isbn: pickIsbn(d.isbn),
    publisher: pickPublisher(d.publisher),
    pages: toNumber(d.number_of_pages_median),
    language: Array.isArray(d.language) ? d.language.map(String) : undefined,
    ratingAverage: toNumber(d.ratings_average) ?? null,
    ratingCount: toNumber(d.ratings_count) ?? null,
  };
}

/** 发起一次 Open Library 搜索请求并解析 docs */
async function fetchSearch(query: string, useIsbn = false): Promise<OpenLibrarySearchResult[]> {
  const fields = [
    'key', 'title', 'subtitle', 'author_name', 'first_publish_year', 'cover_i',
    'isbn', 'publisher', 'number_of_pages_median', 'edition_count', 'language',
    'ratings_average', 'ratings_count',
  ].join(',');
  const params = new URLSearchParams({ limit: '30', fields });
  if (useIsbn) params.set('isbn', query);
  else params.set('q', query);

  const res = await throttledFetch(`${SEARCH_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open Library 搜索失败：HTTP ${res.status}`);
  const data = (await res.json()) as { docs?: any[] };
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const out: OpenLibrarySearchResult[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    const item = mapSearchDoc(d);
    if (item && !seen.has(item.key)) {
      seen.add(item.key);
      out.push(item);
    }
  }
  return out.slice(0, 30);
}

/** 搜索：返回 Open Library 作品列表；命中 ISBN 时走 isbn 参数精确匹配 */
export async function searchOpenLibrary(query: string): Promise<OpenLibrarySearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const isbn = q.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^(?:\d{9}[\dX]|\d{13})$/.test(isbn)) return fetchSearch(isbn, true);
  return fetchSearch(q);
}

/* ------------------------------------------------------------------ */
/* 详情                                                                */
/* ------------------------------------------------------------------ */

/** 从作品的 editions 列表里挑一个“代表性”版本（优先英文，其次有 ISBN 的） */
async function fetchBestEdition(workKey: string): Promise<any | null> {
  const res = await throttledFetch(`${WORK_BASE}${workKey}/editions.json?limit=6`);
  if (!res.ok) return null;
  const data = (await res.json()) as { entries?: any[] };
  const entries = Array.isArray(data.entries) ? data.entries : [];
  if (entries.length === 0) return null;
  const eng = entries.find((e) =>
    Array.isArray(e.languages) && e.languages.some((l: any) => l?.key === '/languages/eng')
  );
  if (eng) return eng;
  return (
    entries.find((e) =>
      (Array.isArray(e.isbn_13) && e.isbn_13.length) ||
      (Array.isArray(e.isbn_10) && e.isbn_10.length)
    ) || entries[0]
  );
}

/**
 * 根据 work key 抓取完整书目信息（不保存）。
 *   - 作品 JSON：标题、描述、首次出版日期、subjects、covers
 *   - 版本 JSON：出版社、ISBN、页数、装帧、副标题
 * 注意：Open Library 的 work JSON 只返回作者 key（不含人名），
 * 因此详情里的 authors 默认留空，调用方（搜索保存）会用搜索聚合到的 author_name 补齐。
 */
export async function fetchOpenLibraryDetail(key: string, coverI?: number): Promise<Record<string, unknown>> {
  const workKey = normalizeWorkKey(key);
  const res = await throttledFetch(`${WORK_BASE}${workKey}.json`);
  if (res.status === 404) throw new Error(`Open Library 上找不到 ${workKey} 对应的作品`);
  if (!res.ok) throw new Error(`Open Library 请求失败：HTTP ${res.status}`);
  const work = (await res.json()) as any;

  const title = typeof work.title === 'string' ? work.title.trim() : '';
  if (!title) throw new Error('未能解析 Open Library 作品信息');

  const edition = await fetchBestEdition(workKey);

  // 封面：优先外部传入的 cover_i，其次作品 covers 数组首个有效值，其次版本 covers
  const coverId = (coverI && coverI > 0 ? coverI : undefined) ??
    firstPositive([...asArray(work.covers), ...asArray(edition?.covers)]);
  const coverUrl = coverUrlFromId(coverId, 'L') ?? null;

  const isbn13 = pickIsbn(edition?.isbn_13) ?? pickIsbn(work.isbn_13);
  const isbn10 = pickIsbn(edition?.isbn_10) ?? pickIsbn(work.isbn_10);
  const pubdate = compactDate(work.first_publish_date) || compactDate(edition?.publish_date);

  return {
    openLibraryKey: workKey,
    openLibraryUrl: `${WORK_BASE}${workKey}`,
    title,
    subtitle:
      typeof edition?.subtitle === 'string' && edition.subtitle ? edition.subtitle : undefined,
    originalTitle: undefined,
    authors: [] as string[],
    publisher: pickPublisher(edition?.publishers) || pickPublisher(work.publishers),
    pubdate,
    price: undefined,
    pages: toNumber(edition?.number_of_pages) ?? toNumber(work.number_of_pages_median),
    binding: typeof edition?.physical_format === 'string' ? edition.physical_format : undefined,
    series: undefined,
    isbn13,
    isbn10,
    ratingAverage: toNumber(work.ratings_average) ?? null,
    ratingCount: toNumber(work.ratings_count) ?? null,
    summary: extractDescription(work.description),
    authorIntro: undefined,
    catalog: undefined,
    coverUrl,
    subjects: asArray(work.subjects).map(String),
  };
}

/** 通过 ISBN 查找并返回完整书目信息 */
export async function fetchOpenLibraryByIsbn(isbn: string): Promise<Record<string, unknown>> {
  const clean = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(clean)) throw new Error('ISBN 格式不正确');
  const results = await searchOpenLibrary(clean);
  const first = results[0];
  if (!first) throw new Error(`Open Library 上找不到 ISBN ${clean} 对应的书籍`);
  return fetchOpenLibraryDetail(first.key, first.coverId);
}

