/**
 * server/services/douban.ts
 * ------------------------------------------------------------------
 * 豆瓣数据抓取服务。
 *
 * 豆瓣没有稳定开放的公共 API（api.douban.com 需要申请 apikey），
 * 因此这里采用两个公开可用的数据通道：
 *
 *  1) 搜索：https://book.douban.com/j/subject_suggest?q=xxx
 *     返回 JSON 格式的联想结果（标题/作者/封面小图/豆瓣id）。
 *
 *  2) 详情：https://book.douban.com/subject/{id}/
 *     返回 HTML 页面，使用 cheerio 解析出完整书目信息
 *     （作者、出版社、出版年、页数、定价、ISBN、内容简介、作者简介、目录等）。
 *
 *  3) ISBN：https://book.douban.com/isbn/{isbn}/ 会 302 跳转到 subject 页面，
 *     跟随跳转后即可拿到 subject id 与详情页。
 *
 * 注意：豆瓣对高频访问有反爬策略（需要登录/验证码）。如果遇到大量 403，
 * 建议控制频率或配置代理。本项目只做了最基础的请求头伪装与频率控制。
 */
import * as cheerio from 'cheerio';
import type { DoubanSearchResult } from '../../shared/types.js';

const BASE = 'https://book.douban.com';

/** 模拟浏览器请求头，降低被拒概率 */
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: `${BASE}/`,
};

/** 两次请求之间的最小间隔（毫秒），防止触发反爬 */
const MIN_INTERVAL_MS = 800;
let lastRequestAt = 0;

async function throttledFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url, { headers: HEADERS });
  lastRequestAt = Date.now();
  return res;
}

/** 解析豆瓣 HTML 页面的工具类 */
export class DoubanParser {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  /** 标题（去副标题） */
  get title(): string {
    return this.$('h1 span').first().text().trim();
  }

  /** 副标题（h1 内被括号包裹的部分） */
  get subtitle(): string | null {
    const full = this.$('h1').first().text().replace(/\s+/g, ' ').trim();
    const m = full.match(/\((.*?)\)/);
    return m ? m[1] : null;
  }

  /** 从 #info 信息块中按字段名取值 */
  private infoField(label: string): string | null {
    const text = this.$('#info').text().replace(/\s+/g, ' ').trim();
    const re = new RegExp(`${label}\\s*[:：]\\s*(.+?)(?=\\s*[A-Za-z\\u4e00-\\u9fa5]+\\s*[:：]|$)`, 'i');
    const m = text.match(re);
    if (m) {
      // 去掉行内嵌套的链接文字冗余（作者栏目会拼出一串"作者"字样）
      const v = m[1].replace(/作者/g, '').trim();
      return v || null;
    }
    return null;
  }

  /** 作者列表（可能有多位作者） */
  get authors(): string[] {
    const list: string[] = [];
    this.$('#info a[rel="v:author"]').each((_, el) => {
      const name = this.$(el).text().trim();
      if (name && !list.includes(name)) list.push(name);
    });
    if (list.length > 0) return list;
    const text = this.infoField('作者');
    return text ? text.split(/[、/]/).map((s) => s.trim()).filter(Boolean) : [];
  }

  get publisher(): string | null {
    return this.infoField('出版社');
  }

  get pubdate(): string | null {
    const raw = this.infoField('出版年');
    if (!raw) return null;
    // 提取年份和月份，如 "2021-03-01" -> "2021-03"
    const m = raw.match(/(\d{4})(?:[-/年](\d{1,2}))?/);
    return m ? (m[2] ? `${m[1]}-${m[2].padStart(2, '0')}` : m[1]) : raw;
  }

  get pages(): number | null {
    const raw = this.infoField('页数');
    const m = raw?.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  get price(): string | null {
    const raw = this.infoField('定价');
    return raw ? raw.replace(/^(CNY|￥|¥)\s*/i, '') : null;
  }

  get binding(): string | null {
    return this.infoField('装帧');
  }

  get series(): string | null {
    return this.infoField('丛书');
  }

  get isbn13(): string | null {
    const raw = this.infoField('ISBN');
    const m = raw?.match(/\d{13}/);
    return m ? m[0] : null;
  }

  get isbn10(): string | null {
    const raw = this.infoField('ISBN');
    const m = raw?.match(/\d{9}[\dXx]/);
    return m ? m[0].toUpperCase() : null;
  }

  get ratingAverage(): number | null {
    const t = this.$('strong.rating_num').first().text().trim();
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }

  get ratingCount(): number | null {
    const t = this.$('a.rating_people span[property="v:votes"]').text().trim();
    const n = parseInt(t.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  }

  /** 内容简介（第一个 .intro 块） */
  get summary(): string | null {
    const intro = this.$('#link-report .intro').first();
    const text = intro.find('p').map((_, el) => this.$(el).text().trim()).get().join('\n');
    return text || intro.text().trim() || null;
  }

  /** 作者简介（第二个 .intro 块） */
  get authorIntro(): string | null {
    const intros = this.$('.related_info .indent .intro, #content .related_info .intro');
    const block = intros.eq(1);
    if (!block.length) return null;
    const text = block.find('p').map((_, el) => this.$(el).text().trim()).get().join('\n');
    return text || block.text().trim() || null;
  }

  /** 目录（最后一个 .intro 块，通常是 #dir_xxx_full） */
  get catalog(): string | null {
    const full = this.$('#dir_xxx_full, [id^="dir_"][id$="_full"]').first();
    if (full.length) {
      const text = full.find('p').map((_, el) => this.$(el).text().trim()).get().join('\n');
      return text || full.text().trim() || null;
    }
    const intros = this.$('.related_info .indent .intro, #content .related_info .intro');
    const block = intros.eq(2);
    if (!block.length) return null;
    const text = block.find('p').map((_, el) => this.$(el).text().trim()).get().join('\n');
    return text || block.text().trim() || null;
  }

  get coverUrl(): string | null {
    const img = this.$('#mainpic img[rel="v:photo"]').first();
    return img.attr('src') || null;
  }
}

/** 抓取详情页 HTML */
export async function fetchBookPageHtml(subjectId: string): Promise<string> {
  const res = await throttledFetch(`${BASE}/subject/${subjectId}/`);
  if (res.status === 404) throw new Error(`豆瓣上没有找到 subject/${subjectId}`);
  if (res.status === 403) throw new Error('豆瓣拒绝了请求（403），可能触发了反爬，请稍后再试');
  if (!res.ok) throw new Error(`豆瓣请求失败：HTTP ${res.status}`);
  return await res.text();
}

/** 抓取并解析一本书的完整详情 */
export async function fetchBookDetail(subjectId: string): Promise<{
  doubanId: string;
  doubanUrl: string;
  [key: string]: unknown;
}> {
  const html = await fetchBookPageHtml(subjectId);
  const p = new DoubanParser(html);
  return {
    doubanId: subjectId,
    doubanUrl: `${BASE}/subject/${subjectId}/`,
    title: p.title,
    subtitle: p.subtitle,
    authors: p.authors,
    publisher: p.publisher,
    pubdate: p.pubdate,
    pages: p.pages,
    price: p.price,
    binding: p.binding,
    series: p.series,
    isbn13: p.isbn13,
    isbn10: p.isbn10,
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
    summary: p.summary,
    authorIntro: p.authorIntro,
    catalog: p.catalog,
    coverUrl: p.coverUrl,
  };
}

/** 根据 ISBN 解析出豆瓣 subject id（跟随跳转） */
export async function resolveIsbnToSubjectId(isbn: string): Promise<string | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!clean) throw new Error('ISBN 格式不正确');
  const res = await throttledFetch(`${BASE}/isbn/${clean}/`);
  // 跟随 302 之后，最终 URL 形如 https://book.douban.com/subject/26800533/
  const finalUrl = res.url || '';
  const m = finalUrl.match(/\/subject\/(\d+)\/?$/);
  if (m) return m[1];
  // 有些情况页面内嵌链接给出 subject id
  const html = await res.text();
  const m2 = html.match(/\/subject\/(\d+)/);
  return m2 ? m2[1] : null;
}

/** 通过 ISBN 直接获取完整书目信息 */
export async function fetchBookByIsbn(isbn: string) {
  const subjectId = await resolveIsbnToSubjectId(isbn);
  if (!subjectId) throw new Error(`豆瓣上找不到 ISBN ${isbn} 对应的书籍`);
  return fetchBookDetail(subjectId);
}

/** 搜索：返回豆瓣联想结果 */
export async function searchDouban(query: string): Promise<DoubanSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${BASE}/j/subject_suggest?q=${encodeURIComponent(q)}`;
  const res = await throttledFetch(url);
  if (!res.ok) throw new Error(`豆瓣搜索失败：HTTP ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data
    .filter((d) => d && d.id && d.title)
    .map((d) => ({
      id: String(d.id),
      title: String(d.title),
      subtitle: typeof d.sub_title === 'string' ? d.sub_title : undefined,
      authors: typeof d.author === 'string' ? d.author : undefined,
      url: String(d.url || `${BASE}/subject/${d.id}/`),
      image: String(d.image || ''),
      year: typeof d.year === 'string' ? d.year : undefined,
      isbn: typeof d.isbn === 'string' ? d.isbn : undefined,
    }));
}

