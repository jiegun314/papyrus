/**
 * server/db/schema.ts
 * ------------------------------------------------------------------
 * Drizzle ORM 的 SQLite schema 定义（类型来源 + 查询构建元数据）。
 *
 * 物理表结构由下面的 SCHEMA_SQL（建表/索引脚本）实际创建，
 * 本文件的 sqliteTable 定义与 SCHEMA_SQL 一一对应，二者必须保持一致：
 *   - 表名、列名（SQL 列名，蛇形）、类型、默认值保持一致；
 *   - 唯一/索引/主键约束在 SCHEMA_SQL 中落地，Drizzle 侧仅作类型与文档说明。
 *
 * 使用 Drizzle 后，数据访问不再拼接原始 SQL 字符串，而是通过
 * db.select()/insert()/update()/delete() + 关系操作符（eq/and/or/like/sql 等）
 * 构建类型安全的查询。将来切换到 Cloudflare D1 时，仅需替换驱动实例
 * （drizzle-orm/d1），查询代码保持不变。
 */
import { sqliteTable, integer, text, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/* ------------------------------------------------------------------ */
/* 建表 DDL：首次运行 / 迁移时用，保证物理表结构与 Drizzle schema 一致。 */
/* ------------------------------------------------------------------ */
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
  douban_id      TEXT UNIQUE,
  amazon_asin    TEXT,
  isbn13         TEXT,
  isbn10         TEXT,
  title          TEXT NOT NULL,
  subtitle       TEXT,
  original_title TEXT,
  authors        TEXT NOT NULL DEFAULT '[]',
  publisher      TEXT,
  pubdate        TEXT,
  price          TEXT,
  pages          INTEGER,
  binding        TEXT,
  series         TEXT,
  summary        TEXT,
  author_intro   TEXT,
  catalog        TEXT,
  cover_url      TEXT,
  cover_path     TEXT,
  book_type      TEXT NOT NULL DEFAULT 'physical' CHECK (book_type IN ('physical','ebook')),
  ebook_path     TEXT,
  ebook_filename TEXT,
  ebook_size     INTEGER,
  rating_average REAL,
  rating_count   INTEGER,
  douban_url     TEXT,
  amazon_url     TEXT,
  open_library_key TEXT,
  open_library_url TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_open_library_key ON books(open_library_key);
CREATE INDEX IF NOT EXISTS idx_books_book_type ON books(book_type);

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
  rating     REAL CHECK (rating >= 0 AND rating <= 5),
  content    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(book_id);
`;

/* ------------------------------------------------------------------ */
/* Drizzle schema：与 SCHEMA_SQL 一一对应                               */
/* ------------------------------------------------------------------ */

/** 分类 */
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#3368a0'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now', 'localtime'))`),
});

/** 书籍 */
export const books = sqliteTable(
  'books',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    doubanId: text('douban_id'),
    amazonAsin: text('amazon_asin'),
    isbn13: text('isbn13'),
    isbn10: text('isbn10'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    originalTitle: text('original_title'),
    authors: text('authors').notNull().default('[]'),
    publisher: text('publisher'),
    pubdate: text('pubdate'),
    price: text('price'),
    pages: integer('pages'),
    binding: text('binding'),
    series: text('series'),
    summary: text('summary'),
    authorIntro: text('author_intro'),
    catalog: text('catalog'),
    coverUrl: text('cover_url'),
    coverPath: text('cover_path'),
    bookType: text('book_type', { enum: ['physical', 'ebook'] }).notNull().default('physical'),
    ebookPath: text('ebook_path'),
    ebookFilename: text('ebook_filename'),
    ebookSize: integer('ebook_size'),
    ratingAverage: real('rating_average'),
    ratingCount: integer('rating_count'),
    doubanUrl: text('douban_url'),
    amazonUrl: text('amazon_url'),
    openLibraryKey: text('open_library_key'),
    openLibraryUrl: text('open_library_url'),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    readingStatus: text('reading_status', { enum: ['unread', 'reading', 'read', 'abandoned'] })
      .notNull()
      .default('unread'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'localtime'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now', 'localtime'))`),
  },
  (t) => [
    index('idx_books_title').on(t.title),
    index('idx_books_isbn').on(t.isbn13, t.isbn10),
    index('idx_books_category').on(t.categoryId),
    index('idx_books_book_type').on(t.bookType),
    uniqueIndex('idx_books_amazon_asin').on(t.amazonAsin),
    uniqueIndex('idx_books_open_library_key').on(t.openLibraryKey),
  ]
);

/** 标签 */
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now', 'localtime'))`),
});

/** 书籍-标签 多对多关联 */
export const bookTags = sqliteTable(
  'book_tags',
  {
    bookId: integer('book_id').references(() => books.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.tagId] })]
);

/** 书评 */
export const reviews = sqliteTable(
  'reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookId: integer('book_id').references(() => books.id, { onDelete: 'cascade' }).notNull(),
    rating: real('rating'),
    content: text('content').notNull().default(''),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'localtime'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now', 'localtime'))`),
  },
  (t) => [index('idx_reviews_book').on(t.bookId)]
);

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


