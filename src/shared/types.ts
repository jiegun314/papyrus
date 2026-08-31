/**
 * shared/types.ts
 * ------------------------------------------------------------------
 * 前后端共享的类型定义。所有 API 请求/响应的结构都在这里声明，
 * 保证前端与后端的类型一致，修改时可从这里入手。
 */

/** 书籍在书架上的状态 */
export type BookStatus = 'in' | 'out'; // 'in' = 在架, 'out' = 已借出

/** 图书基本信息（与数据库 books 表对应） */
export interface Book {
  id: number;
  /** 豆瓣 subject id（可选，非豆瓣导入的书籍为空） */
  doubanId: string | null;
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
  ratingAverage: number | null;
  ratingCount: number | null;
  doubanUrl: string | null;
  categoryId: number | null;
  /** 展示时附带分类对象 */
  category?: Category | null;
  status: BookStatus;
  notes: string | null;     // 个人备注
  createdAt: string;
  updatedAt: string;
  /** 关联数据（列表/详情接口附带） */
  tags?: Tag[];
  reviews?: Review[];
  /** 当前借阅信息（借出时附带） */
  activeLending?: Lending | null;
}

/** 分类 */
export interface Category {
  id: number;
  name: string;
  color: string; // CSS 颜色，如 "#b4532a"
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

/** 借阅记录 */
export interface Lending {
  id: number;
  bookId: number;
  borrower: string;
  borrowedAt: string;
  returnedAt: string | null;
  note: string | null;
  /** 'borrowed' = 借出未还, 'returned' = 已归还 */
  status: 'borrowed' | 'returned';
  /** 附带书名（列表接口用） */
  bookTitle?: string;
  /** 附带书籍简要信息（列表接口用，用于展示封面/作者） */
  book?: {
    title: string;
    authors: string[];
    coverPath: string | null;
  };
}

/** 统计信息（首页展示） */
export interface Stats {
  totalBooks: number;
  inLibrary: number;
  borrowed: number;
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
  status?: BookStatus;
  limit?: number;
  offset?: number;
}

/** 豆瓣搜索结果条目 */
export interface DoubanSearchResult {
  id: string;         // 豆瓣 subject id
  title: string;
  subtitle?: string;
  authors?: string;
  url: string;
  image: string;      // 封面小图
  year?: string;
  isbn?: string;
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
  status?: BookStatus;
  notes?: string;
  /* 以下字段仅豆瓣导入时使用（手动表单不会用到） */
  doubanId?: string | null;
  doubanUrl?: string | null;
  coverUrl?: string | null;
  coverPath?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
}

/** API 统一错误响应 */
export interface ApiError {
  error: string;
  details?: unknown;
}
