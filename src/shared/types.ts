/**
 * shared/types.ts
 * ------------------------------------------------------------------
 * 前后端共享的类型定义。所有 API 请求/响应的结构都在这里声明，
 * 保证前端与后端的类型一致，修改时可从这里入手。
 */

/** 书籍阅读状态：unread = 未读, reading = 阅读中, read = 已读, abandoned = 放弃 */
export type ReadingStatus = 'unread' | 'reading' | 'read' | 'abandoned';

/** 书籍载体类型：physical = 实体书, ebook = 电子书 */
export type BookType = 'physical' | 'ebook';

/** 图书基本信息（与数据库 books 表对应） */
export interface Book {
  id: number;
  /** 豆瓣 subject id（可选，非豆瓣导入的书籍为空） */
  doubanId: string | null;
  /** Amazon ASIN（可选，非 Amazon 导入的书籍为空） */
  amazonAsin: string | null;
  /** Amazon 详情页 URL */
  amazonUrl: string | null;
  /** Open Library work key（可选，非 Open Library 导入的书籍为空） */
  openLibraryKey: string | null;
  /** Open Library 作品页 URL */
  openLibraryUrl: string | null;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  originalTitle: string | null;
  /** 作者，JSON 数组字符串在数据库中，API 层解析为 string[] */
  authors: string[];
  publisher: string | null;
  /** 出版日期，如 "2021-03" */
  pubdate: string | null;
  price: string | null;
  pages: number | null;
  binding: string | null;   // 装帧：平装/精装
  series: string | null;    // 丛书
  summary: string | null;   // 内容简介
  authorIntro: string | null; // 作者简介
  catalog: string | null;   // 目录
  coverUrl: string | null;  // 豆瓣封面原始地址
  coverPath: string | null; // 本地缓存的封面路径（/covers/xxx.jpg）
  /** 书籍载体类型：实体书 / 电子书（默认实体书） */
  bookType: BookType;
  /** 电子书文件地址（/ebooks/xxx.pdf）；非电子书或未上传为 null */
  ebookPath: string | null;
  /** 上传电子书时的原始文件名（用于下载时作为保存名） */
  ebookFilename: string | null;
  /** 电子书文件大小（字节） */
  ebookSize: number | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  doubanUrl: string | null;
  categoryId: number | null;
  /** 展示时附带分类对象 */
  category?: Category | null;
  /** 阅读状态：未读 / 阅读中 / 已读 / 放弃 */
  readingStatus: ReadingStatus;
  notes: string | null;     // 个人备注
  createdAt: string;
  updatedAt: string;
  /** 关联数据（列表/详情接口附带） */
  tags?: Tag[];
  reviews?: Review[];
}

/** 分类 */
export interface Category {
  id: number;
  name: string;
  color: string; // CSS 颜色，如 "#3368a0"
  bookCount?: number; // 附带书籍数量
  createdAt: string;
}

/** 标签 */
export interface Tag {
  id: number;
  name: string;
  bookCount?: number;
  createdAt: string;
}

/** 书评 */
export interface Review {
  id: number;
  bookId: number;
  /** 评分 0-5，可为小数（如 4.5） */
  rating: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** 统计信息（首页展示） */
export interface Stats {
  totalBooks: number;
  /** 物理（实体）书籍数 */
  physicalCount: number;
  /** 电子书数 */
  ebookCount: number;
  /** 未读书籍数 */
  unread: number;
  /** 阅读中书籍数 */
  reading: number;
  /** 已读书籍数 */
  read: number;
  /** 放弃书籍数 */
  abandoned: number;
  tagCount: number;
  categoryCount: number;
  reviewCount: number;
  recentBooks: Book[];
}

/** 列表查询参数 */
export interface BookQuery {
  keyword?: string; // 匹配标题/作者/ISBN/出版社
  categoryId?: number;
  tagId?: number;
  readingStatus?: ReadingStatus;
  /** 按书籍载体类型筛选 */
  bookType?: BookType;
  limit?: number;
  offset?: number;
  /** 仅返回有书评的书籍 */
  hasReview?: boolean;
  /** 仅返回有至少一个标签的书籍 */
  hasTag?: boolean;
  /** 仅返回已分类（非未分类）的书籍 */
  hasCategory?: boolean;
}

/** 豆瓣搜索结果条目 */
export interface DoubanSearchResult {
  id: string;         // 豆瓣 subject id
  title: string;
  subtitle?: string;
  authors?: string;
  url: string;
  image: string;      // 封面小图
  publisher?: string; // 出版社（仅 ISBN 直达路径可从详情页解析到；关键字联想接口不返回）
  year?: string;
  isbn?: string;
}

/** Amazon 搜索结果条目 */
export interface AmazonSearchResult {
  asin: string;       // Amazon ASIN
  title: string;
  authors?: string;   // 作者（逗号分隔）
  url?: string;
  image?: string;     // 封面图
  price?: string;
  rating?: number | null;
  ratingCount?: number | null;
  pubdate?: string;
  isbn?: string;
}

/** Open Library 搜索结果条目（作品级聚合） */
export interface OpenLibrarySearchResult {
  key: string;            // work key，如 /works/OL45883W
  title: string;
  subtitle?: string;
  authors?: string;       // 作者（逗号分隔）
  coverUrl?: string;      // 封面中图 URL（从 cover_i 构造）
  coverId?: number;       // Open Library cover id（用于请求大图）
  firstPublishYear?: number;
  editionCount?: number;
  isbn?: string;
  publisher?: string;
  pages?: number;
  language?: string[];
  ratingAverage?: number | null;
  ratingCount?: number | null;
}

/** 新建/更新书籍的载荷（手动录入表单） */
export interface BookInput {
  title: string;
  subtitle?: string;
  originalTitle?: string;
  authors: string[];
  publisher?: string;
  pubdate?: string;
  price?: string;
  pages?: number;
  binding?: string;
  series?: string;
  summary?: string;
  authorIntro?: string;
  catalog?: string;
  isbn13?: string;
  isbn10?: string;
  categoryId?: number | null;
  readingStatus?: ReadingStatus;
  notes?: string;
  /* 以下字段仅豆瓣导入时使用（手动表单不会用到） */
  doubanId?: string | null;
  doubanUrl?: string | null;
  coverUrl?: string | null;
  coverPath?: string | null;
  /** 书籍载体类型：实体书 / 电子书 */
  bookType?: BookType;
  /** 电子书文件地址（/ebooks/xxx.pdf） */
  ebookPath?: string | null;
  /** 上传电子书时的原始文件名 */
  ebookFilename?: string | null;
  /** 电子书文件大小（字节） */
  ebookSize?: number | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  /* 以下字段仅 Amazon 导入时使用（手动表单不会用到） */
  amazonAsin?: string | null;
  amazonUrl?: string | null;
  /* 以下字段仅 Open Library 导入时使用（手动表单不会用到） */
  openLibraryKey?: string | null;
  openLibraryUrl?: string | null;
}

/** API 统一错误响应 */
export interface ApiError {
  error: string;
  details?: unknown;
}
