/**
 * server/services/amazon.ts
 * ------------------------------------------------------------------
 * Amazon 数据抓取服务（与 douban.ts 同理，做最基础的请求头伪装与节流）。
 *
 * Amazon 没有无需凭证的公开图书 API，因此这里采用两个公开页面/通道：
 *
 *  1) 搜索：https://www.amazon.com/s?k=xxx&i=stripbooks
 *     解析搜索结果卡片（data-asin / /dp/ASIN 链接 / s-image 封面等）。
 *
 *  2) 详情：https://www.amazon.com/dp/{ASIN}/
 *     优先解析页面内嵌的 JSON-LD（script[type="application/ld+json"] 的 Book schema），
 *     这是 Amazon 图书页最稳定的结构化数据源；缺失时回退到 DOM 选择器。
 *
 * 注意：Amazon.com 反爬较严，高频请求可能被拦截（出现验证页/空结果）。
 * 本项目只做基础伪装与节流，若遇到大量拦截建议降低导入频率或配置代理。
 */
import * as cheerio from 'cheerio';
import type { AmazonSearchResult } from '../../shared/types.js';

const BASE = 'https://www.amazon.com';

/** 模拟浏览器请求头，降低被拒概率 */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: `${BASE}/`,
};

/** 两次请求之间的最小间隔（毫秒），防止频繁请求被拒 */
const MIN_INTERVAL_MS = 1000;
let lastRequestAt = 0;

async function throttledFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url, { headers: HEADERS });
  lastRequestAt = Date.now();
  return res;
}

/** 判断一段 HTML 是否看起来像被反爬拦截的验证页 */
function looksBlocked($: cheerio.CheerioAPI): boolean {
  const hasTitle = $('#productTitle, h1, h2').length > 0;
  const hasCaptcha = /captcha|robot check|enter the characters/i.test($('body').text());
  return hasCaptcha || (!hasTitle && $('div[data-asin]').length === 0);
}

/* ================================================================== */
/* 搜索                                                               */
/* ================================================================== */

/** 从搜索结果卡片里提取一条记录的字段 */
function parseSearchCard($: cheerio.CheerioAPI, card: any): AmazonSearchResult | null {
  const $card = $(card);
  const asin = ($card.attr('data-asin') || '').trim();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null;

  const href = $card.find('a[href*="/dp/"]').first().attr('href') || '';
  const hrefAsin = href.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  const finalAsin = hrefAsin || asin;

  const titleEl = $card.find('h2').first();
  const title =
    titleEl.find('span').first().text().trim() ||
    titleEl.text().trim() ||
    $card.find('a[title]').first().attr('title')?.trim() ||
    '';

  const image =
    $card.find('img.s-image').first().attr('src') ||
    $card.find('img[src]').first().attr('src') ||
    '';

  const price = $card.find('.a-price .a-offscreen').first().text().trim() || undefined;

  const ratingText = $card.find('span.a-icon-alt').first().text().trim(); // "4.8 out of 5 stars"
  const ratingMatch = ratingText.match(/[\d.]+/);
  const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;

  const countText = $card
    .find('span[aria-label*="rating"], span.a-size-base.s-underline-text')
    .first()
    .text()
    .trim();
  const countNum = countText.replace(/[^\d]/g, '');
  const ratingCount = countNum ? parseInt(countNum, 10) : null;

  // 作者：优先取作者个人主页链接（路径含 /e/），其次取 "by …" 文本
  let authors: string | undefined;
  const authorNames: string[] = [];
  $card
    .find('a.a-link-normal[href*="/e/"]')
    .each((_, el) => {
      const n = $(el).text().trim();
      if (n && !/^(see options|more)/i.test(n) && !authorNames.includes(n)) authorNames.push(n);
    });
  if (authorNames.length) {
    authors = authorNames.join(', ');
  } else {
    const byline = $card.find('.a-color-secondary').first().text().trim();
    const byMatch = byline.match(/\bby\s+([^,|]+)/i);
    if (byMatch) authors = byMatch[1].replace(/\(.*?\)/g, '').trim();
  }

  return {
    asin: finalAsin,
    title: title || `ASIN ${finalAsin}`,
    authors,
    url: `${BASE}/dp/${finalAsin}/`,
    image: image ? absoluteMediaUrl(image) : undefined,
    price,
    rating,
    ratingCount,
  };
}

/** 将 Amazon 相对图片地址转成绝对地址 */
function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${BASE}${url}`;
  return url;
}

/** 搜索：返回 Amazon 图书搜索结果 */
export async function searchAmazon(query: string): Promise<AmazonSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${BASE}/s?k=${encodeURIComponent(q)}&i=stripbooks`;
  const res = await throttledFetch(url);
  if (res.status === 503 || res.status === 429) {
    throw new Error('Amazon 拒绝了请求（可能触发反爬），请稍后再试或降低导入频率');
  }
  if (!res.ok) throw new Error(`Amazon 搜索失败：HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  if (looksBlocked($)) throw new Error('Amazon 返回了验证页，搜索受阻，请稍后再试');

  const cards = $(
    'div[data-asin][data-component-type="s-search-result"], div.s-result-item[data-asin], div[data-asin]'
  );
  const results: AmazonSearchResult[] = [];
  const seen = new Set<string>();
  cards.each((_, el) => {
    const item = parseSearchCard($, el);
    if (item && item.asin && item.title && !seen.has(item.asin)) {
      seen.add(item.asin);
      results.push(item);
    }
  });
  return results.slice(0, 30);
}

/* ================================================================== */
/* 详情（JSON-LD 优先，DOM 兜底）                                     */
/* ================================================================== */

function normalizeAuthors(author: unknown): string[] {
  if (author == null) return [];
  const arr = Array.isArray(author) ? author : [author];
  const names = arr
    .map((x: any) => (typeof x === 'string' ? x : x?.name ?? x?.givenName ?? ''))
    .map((s: string) => s.trim())
    .filter(Boolean);
  return [...new Set(names)];
}

function normalizePubdate(value: unknown): string | undefined {
  if (!value) return undefined;
  const s = String(value).trim();
  // 2018-10-16 -> 2018-10
  let m = s.match(/(\d{4})[-/年](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  // October 16, 2018 -> 2018-10（英文月份）
  m = s.match(/([A-Za-z]+)\s+\d{1,2},\s*(\d{4})/);
  if (m) {
    const monthMap: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    };
    const mm = monthMap[m[1].toLowerCase()];
    if (mm) return `${m[2]}-${mm}`;
    return m[2];
  }
  // 纯年份
  m = s.match(/\b(\d{4})\b/);
  return m ? m[1] : undefined;
}

function parseIsbn(isbn: unknown): { isbn13?: string; isbn10?: string } {
  if (!isbn) return {};
  const clean = String(isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
  if (clean.length === 13) return { isbn13: clean };
  if (clean.length === 10) return { isbn10: clean };
  if (clean.length === 9) return { isbn10: `${clean}X` };
  return {};
}

function aggregateRatingInfo(agg: any): { ratingAverage?: number | null; ratingCount?: number | null } {
  if (!agg) return { ratingAverage: null, ratingCount: null };
  const avg = parseFloat(agg.ratingValue ?? agg.rating ?? agg.value);
  const count = parseInt(String(agg.ratingCount ?? agg.reviewCount ?? agg.ratingCount ?? ''), 10);
  return {
    ratingAverage: Number.isFinite(avg) ? avg : null,
    ratingCount: Number.isFinite(count) ? count : null,
  };
}

/** 去掉 Amazon 详情文本里的双向隔离/RTL/LTR 标记与零宽字符，并压缩空白 */
function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 生成稳定的键：小写、剔除所有非字母数字（空格/连字符/方向标记） */
function normLabel(label: string): string {
  return cleanText(label)
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function findBookJsonLd($: cheerio.CheerioAPI): any | null {
  let found: any | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    const raw = $(el).html() || $(el).text();
    try {
      const data = JSON.parse(raw);
      const candidates = Array.isArray(data) ? data : data['@graph'] ?? (data['@type'] === 'Book' ? [data] : null);
      if (!candidates) return;
      const book = (Array.isArray(candidates) ? candidates : []).find((x: any) => x && x['@type'] === 'Book');
      if (book) found = book;
    } catch {
      /* 忽略无法解析的 JSON-LD */
    }
  });
  return found;
}

function mapJsonLd(ld: any, asin: string, url: string): Record<string, unknown> {
  const image = Array.isArray(ld.image) ? ld.image[0] : ld.image;
  const { isbn13, isbn10 } = parseIsbn(ld.isbn);
  const { ratingAverage, ratingCount } = aggregateRatingInfo(ld.aggregateRating);
  const publisher = typeof ld.publisher === 'object' ? ld.publisher?.name : ld.publisher;

  return {
    asin,
    amazonUrl: typeof ld.url === 'string' ? ld.url : url,
    title: typeof ld.name === 'string' ? ld.name.trim() : '',
    subtitle: undefined,
    authors: normalizeAuthors(ld.author),
    publisher: publisher ? String(publisher).trim() : undefined,
    pubdate: normalizePubdate(ld.datePublished),
    pages: ld.numberOfPages ? parseInt(String(ld.numberOfPages), 10) || undefined : undefined,
    binding: typeof ld.bookFormat === 'string' ? ld.bookFormat : undefined,
    series: undefined,
    isbn13,
    isbn10,
    ratingAverage,
    ratingCount,
    summary: typeof ld.description === 'string' ? ld.description.trim() : undefined,
    authorIntro: undefined,
    catalog: undefined,
    coverUrl: image ? upscaleImageUrl(absoluteMediaUrl(String(image))) : null,
  };
}

/** 从 DOM 解析（作为 JSON-LD 缺失时的兜底） */
function parseDetailDom($: cheerio.CheerioAPI, asin: string, url: string): Record<string, unknown> {
  const title = $('#productTitle').first().text().trim();

  // 作者：从「by … (Author)」之间截取作者名，剔除版本内容与装帧（如「Simplified Chinese Edition」「Format: Hardcover」）
  const byline = $('#bylineInfo').first().text().trim();
  let authors: string[] = [];
  if (byline) {
    const raw = cleanText(byline);
    // 优先匹配「by … (角色)」；缺失角色括号时在 Format / | / & N more / 结尾处截断
    const m =
      raw.match(/by\s+(.+?)\s*\([^)]*\)/i) ||
      raw.match(/by\s+(.+?)(?:&?\s*\d+\s+more|$)/i);
    if (m?.[1]) {
      const clean = m[1]
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/&?\s*\d+\s+more.*$/i, '')
        .replace(/\s*\|.*$/g, '')
        .replace(/\s*Format:.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean) authors = clean.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  // 封面
  const coverEl = $('#imgBlkFront, #landingImage, #ebooks-imgBlkFront, #imgTagWrapperId img').first();
  let coverUrl: string | null =
    coverEl.attr('data-old-hires') || coverEl.attr('data-lazy-loaded') || coverEl.attr('src') || null;

  // 价格
  const price = $('.a-price .a-offscreen').first().text().trim() || undefined;

  // 评分
  const ratingText = $('#acrPopover span.a-icon-alt, span[data-hook="rating-out-of-text"]')
    .first()
    .text()
    .trim();
  const rm = ratingText.match(/[\d.]+/);
  const ratingAverage = rm ? parseFloat(rm[0]) : null;
  const countText = $('#acrCustomerReviewText').first().text().trim().replace(/[^\d]/g, '');
  const ratingCount = countText ? parseInt(countText, 10) : null;

  // 商品详情项（出版社 / 出版日期 / 页数 / ISBN）
  const details = collectProductDetails($);

  // 内容简介
  const summary =
    $('#bookDescription_feature_div, #productDescription_feature_div').first().text().trim() || undefined;

  return {
    asin,
    amazonUrl: url,
    title,
    subtitle: undefined,
    authors,
    publisher: details.publisher,
    pubdate: normalizePubdate(details.pubdate),
    price,
    pages: details.pages,
    binding: details.binding,
    series: details.series,
    isbn13: details.isbn13,
    isbn10: details.isbn10,
    ratingAverage,
    ratingCount,
    summary,
    authorIntro: undefined,
    catalog: undefined,
    coverUrl: coverUrl ? upscaleImageUrl(coverUrl) : null,
  };
}

function collectProductDetails($: cheerio.CheerioAPI): {
  publisher?: string;
  pubdate?: string;
  pages?: number;
  binding?: string;
  series?: string;
  isbn13?: string;
  isbn10?: string;
} {
  const map: Record<string, string> = {};
  const add = (label: string, value: string): void => {
    const k = normLabel(label);
    const v = cleanText(value);
    if (k && v && map[k] === undefined) map[k] = v;
  };

  // 1) 结构化表格（th / td）——部分商品页仍使用
  $(
    '#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_section1 tr, .prodDetTable tr, #detailBullets_feature_div tr, #prodDetails tr, .a-section table tr'
  ).each((_, tr) => {
    const $tr = $(tr);
    const th = $tr.find('th').first().text();
    const td = $tr.find('td').first().text();
    if (cleanText(th) && cleanText(td)) add(th, td);
  });

  // 2) 详情 bullet（li）——当前 Amazon 图书页的主流布局：「标签 : 值」
  $(
    '#detailBullets_feature_div li, #productDetails_detailBullets_section1 li, #prodDetails li, .productDetails_techSpec_section_1 li'
  ).each((_, li) => {
    const t = cleanText($(li).text());
    const m = t.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
    if (m) add(m[1], m[2]);
  });

  const get = (label: string): string | undefined => map[normLabel(label)];

  const isbn13 = get('ISBN-13');
  const isbn10 = get('ISBN-10');
  // 页数：不同地区/版本标签不一（Print length / Number of pages / Pages）
  const pagesRaw = get('Print length') || get('Number of pages') || get('Pages') || get('总页数');
  const publisher = get('Publisher');
  const pubdate = get('Publication date') || get('出版社');

  let pages: number | undefined;
  if (pagesRaw) {
    const m = pagesRaw.match(/(\d+)/);
    if (m) pages = parseInt(m[1], 10);
  }

  return {
    publisher,
    pubdate,
    pages,
    binding: undefined, // Amazon 书籍装帧信息不稳定，不写入
    series: undefined,
    isbn13: isbn13?.replace(/[^\d]/g, '') || undefined,
    isbn10: isbn10?.replace(/[^0-9Xx]/g, '') || undefined,
  };
}

/** 放大 Amazon 封面缩略图，以获得更高清封面（只放大、不缩小） */
function upscaleImageUrl(url: string): string {
  // 搜索卡片常见 …_AC_UL320_ / …_AC_SX679_：统一升到 SX679（仅当低于目标）
  if (/\._AC_(?:UL|SX|SY|SL)\d+_/.test(url)) {
    return url.replace(/(\._AC_)UL?\d+_/, '$1SX679_');
  }
  // 其它尺寸 token（_SX / _SY / _SL）：只在小于 679 时提升，避免把高清图缩小
  return url.replace(/(\._SX|\._SY|\._SL)(\d+)_/g, (m, p: string, n: string) =>
    parseInt(n, 10) < 679 ? `${p}679_` : m
  );
}

/**
 * 合并 DOM 与 JSON-LD 两套详情：以 DOM（真实可见内容）为主，JSON-LD 仅补齐 DOM 缺失的字段。
 * 这样即使某些商品页 JSON-LD 缺失/精简，也能靠 DOM 补全出版社、出版日期、页数、ISBN 等。
 */
function mergeDetail(dom: Record<string, unknown>, ld: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...dom };
  for (const [k, v] of Object.entries(ld)) {
    const empty =
      out[k] === undefined ||
      out[k] === null ||
      out[k] === '' ||
      (Array.isArray(out[k]) && out[k].length === 0);
    if (empty) out[k] = v;
  }
  return out;
}

/** 解析一本书的完整详情（与 fetchBookDetail 对齐的形态） */
export async function fetchAmazonDetail(asin: string): Promise<Record<string, unknown>> {
  const cleanAsin = asin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(cleanAsin)) throw new Error('ASIN 格式不正确');

  const url = `${BASE}/dp/${cleanAsin}/`;
  const res = await throttledFetch(url);
  if (res.status === 404) throw new Error(`Amazon 上没有找到 ASIN ${cleanAsin} 对应的商品`);
  if (res.status === 503 || res.status === 429) {
    throw new Error('Amazon 拒绝了请求（可能触发反爬），请稍后再试');
  }
  if (!res.ok) throw new Error(`Amazon 请求失败：HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  if (looksBlocked($)) throw new Error('Amazon 返回了验证页，无法获取详情，请稍后再试');

  // 同时解析 JSON-LD 结构化数据与 DOM（真实可见内容），合并以避免字段缺失
  const ld = findBookJsonLd($);
  const ldDetail = ld ? mapJsonLd(ld, cleanAsin, url) : {};
  const domDetail = parseDetailDom($, cleanAsin, url);

  // 合并且以 DOM 为主：DOM 已能可靠解析的商品信息优先，JSON-LD 仅补齐 DOM 缺失的字段
  const detail = mergeDetail(domDetail, ldDetail);
  if (!detail.title) throw new Error('未能解析 Amazon 商品页，请确认该书存在或稍后再试');
  return detail;
}

/** 通过 ISBN 查找（搜索第一个结果的 ASIN 再取详情） */
export async function fetchAmazonByIsbn(isbn: string): Promise<Record<string, unknown>> {
  const clean = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!/^(?:\d{10}|\d{13}|\d{9}X)$/.test(clean)) throw new Error('ISBN 格式不正确');
  const results = await searchAmazon(clean);
  const first = results.find((r) => r.asin);
  if (!first) throw new Error(`Amazon 上找不到 ISBN ${clean} 对应的书籍`);
  return fetchAmazonDetail(first.asin);
}

