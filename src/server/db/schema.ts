/**
 * server/db/schema.ts
 * ------------------------------------------------------------------
 * SQLite 表结构定义。项目使用 better-sqlite3（同步 API，简单可靠）。
 * 数据文件默认存放在 <项目根>/data/papyrus.db。
 */

export const SCHEMA_SQL = `
-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#3368a0',
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 书籍主表
CREATE TABLE IF NOT EXISTS books (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  douban_id      TEXT UNIQUE,                    -- 豆瓣 subject id
  amazon_asin    TEXT,                           -- Amazon ASIN
  isbn13         TEXT,
  isbn10         TEXT,
  title          TEXT NOT NULL,
  subtitle       TEXT,
  original_title TEXT,
  authors        TEXT NOT NULL DEFAULT '[]',     -- JSON 数组字符串
  publisher      TEXT,
  pubdate        TEXT,
  price          TEXT,
  pages          INTEGER,
  binding        TEXT,
  series         TEXT,
  summary        TEXT,
  author_intro   TEXT,
  catalog        TEXT,
  cover_url      TEXT,                           -- 豆瓣/Amazon 封面原始 URL
  cover_path     TEXT,                           -- 本地缓存封面路径
  rating_average REAL,
  rating_count   INTEGER,
  douban_url     TEXT,
  amazon_url     TEXT,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  reading_status TEXT NOT NULL DEFAULT 'unread' CHECK (reading_status IN ('unread','reading','read','abandoned')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn13, isbn10);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_amazon_asin ON books(amazon_asin);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 书籍-标签 多对多关联表
CREATE TABLE IF NOT EXISTS book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

-- 书评表（一本书可有多条书评，也可多次修改）
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  rating     REAL CHECK (rating >= 0 AND rating <= 5),   -- 0-5 分，支持 4.5 这种小数
  content    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(book_id);
`;

/** 默认分类（首次启动时写入） */
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: '小说', color: '#3368a0' },
  { name: '文学', color: '#8a7bb0' },
  { name: '历史', color: '#a5774e' },
  { name: '科技', color: '#66a3bf' },
  { name: '艺术', color: '#b0769c' },
  { name: '生活', color: '#c79a3d' },
  { name: '其他', color: '#5a6b78' },
];
