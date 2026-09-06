/**
 * server/db/index.ts
 * ------------------------------------------------------------------
 * 数据库连接单例：打开 SQLite、执行建表语句、注入默认分类，并暴露
 * Drizzle ORM 实例（类型安全的数据访问）。
 *
 * 本地开发使用 better-sqlite3（同步 API，简单可靠）；
 * 将来部署到 Cloudflare 时，仅需把这里改为 drizzle-orm/d1 并传入
 * D1 binding（env.DB），上方 getDb() 的查询代码无需改动。
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_SQL, DEFAULT_CATEGORIES } from './schema.js';
import type { BookType } from '../../shared/types.js';

// 项目根目录（src/server/db/ -> 项目根）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const COVERS_DIR = path.join(DATA_DIR, 'covers');
export const EBOOKS_DIR = path.join(DATA_DIR, 'ebooks');
export const DB_PATH = path.join(DATA_DIR, 'papyrus.db');

let raw: Database.Database | null = null;
let db: BetterSQLite3Database | null = null;

/** 获取 Drizzle 数据库实例（懒加载，Node/better-sqlite3 驱动） */
export function getDb(): BetterSQLite3Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  fs.mkdirSync(EBOOKS_DIR, { recursive: true });

  raw = new Database(DB_PATH);
  raw.pragma('journal_mode = WAL'); // 并发读写更安全
  raw.pragma('foreign_keys = ON');  // 启用外键级联删除
  // 先迁移旧库（补齐缺失列），再执行建表/索引脚本：
  // SCHEMA_SQL 里的 idx_books_amazon_asin 唯一索引依赖 amazon_asin 列，
  // 若先跑 SCHEMA_SQL 会在旧库（尚无该列）上报 "no such column"。
  migrate(raw);
  raw.exec(SCHEMA_SQL);

  seedCategories(raw);
  db = drizzle({ client: raw });
  return db;
}

/**
 * 结构迁移：把旧版本数据库升级到当前 schema。
 *
 * v1 → v2（阅读状态取代借出状态）：
 *   1. 删除 lendings 借阅记录表（借出 / 归还功能已移除）；
 *   2. books.status('in'|'out') 列替换为 reading_status
 *      （'unread'|'reading'|'read'|'abandoned'）。SQLite 无法直接改写列的
 *      CHECK 约束，因此采用「重建表」方式迁移；旧书无阅读进度数据，一律置为 'unread'。
 */
function migrate(db: Database.Database): void {
  // 全新数据库：books 表尚未创建，无需迁移，直接留给随后的 SCHEMA_SQL 建表。
  const hasBooks = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'books'")
    .get();
  if (!hasBooks) return;

  db.exec('DROP TABLE IF EXISTS lendings');

  const cols = db.prepare('PRAGMA table_info(books)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'reading_status')) {
    const fkOn = db.pragma('foreign_keys', { simple: true }) === 1;
    db.pragma('foreign_keys = OFF'); // 关闭外键，重建 books 时不级联破坏 book_tags / reviews
    try {
      const rebuild = db.transaction(() => {
        db.exec(`
          CREATE TABLE books_new (
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
          INSERT INTO books_new (
            id, douban_id, amazon_asin, isbn13, isbn10, title, subtitle, original_title, authors,
            publisher, pubdate, price, pages, binding, series, summary, author_intro,
            catalog, cover_url, cover_path, rating_average, rating_count, douban_url, amazon_url,
            open_library_key, open_library_url,
            category_id, reading_status, notes, created_at, updated_at
          )
          SELECT
            id, douban_id, NULL, isbn13, isbn10, title, subtitle, original_title, authors,
            publisher, pubdate, price, pages, binding, series, summary, author_intro,
            catalog, cover_url, cover_path, rating_average, rating_count, douban_url, NULL,
            NULL, NULL,
            category_id, 'unread', notes, created_at, updated_at
          FROM books;
          DROP TABLE books;
          ALTER TABLE books_new RENAME TO books;
        `);
        // 旧表删除后原索引一并消失，重新执行建表脚本恢复（title / isbn / category / amazon）
        db.exec(SCHEMA_SQL);
      });
      rebuild();
    } finally {
      db.pragma(`foreign_keys = ${fkOn ? 'ON' : 'OFF'}`);
    }
  }

  // 增量补列：为已存在的旧库补充 Amazon 相关列（SQLite 不允许 ALTER 加 UNIQUE 约束，
  // 故唯一约束统一由 SCHEMA_SQL 中的 idx_books_amazon_asin 唯一索引承担）。
  addColumnIfMissing(db, 'books', 'amazon_asin', 'TEXT');
  addColumnIfMissing(db, 'books', 'amazon_url', 'TEXT');

  // 电子书功能（v3）：载体类型 + 电子书文件元数据。默认全部标记为实体书。
  addColumnIfMissing(db, 'books', 'book_type', "TEXT NOT NULL DEFAULT 'physical'");
  addColumnIfMissing(db, 'books', 'ebook_path', 'TEXT');
  addColumnIfMissing(db, 'books', 'ebook_filename', 'TEXT');
  addColumnIfMissing(db, 'books', 'ebook_size', 'INTEGER');

  // Open Library 数据源（v4）。唯一约束由 SCHEMA_SQL 的 idx_books_open_library_key 承担。
  addColumnIfMissing(db, 'books', 'open_library_key', 'TEXT');
  addColumnIfMissing(db, 'books', 'open_library_url', 'TEXT');

  // 阅读状态 / 载体类型筛选索引（每次启动都会确保存在）
  db.exec('CREATE INDEX IF NOT EXISTS idx_books_reading_status ON books(reading_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_books_book_type ON books(book_type)');
}

/** 若某列不存在，则将其以指定类型追加到表中 */
function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

/** 首次运行写入默认分类 */
function seedCategories(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number }).c;
  if (count > 0) return;
  const insert = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  const tx = db.transaction((rows: { name: string; color: string }[]) => {
    for (const r of rows) insert.run(r.name, r.color);
  });
  tx(DEFAULT_CATEGORIES);
}

/** 关闭数据库（用于测试/退出） */
export function closeDb(): void {
  if (raw) {
    raw.close();
    raw = null;
    db = null;
  }
}

/**
 * 将 Drizzle 查询返回的行（camelCase 属性名）转换为前端 Book 对象。
 * 统一处理字段映射与 authors JSON 字符串解析。
 */
export function rowToBook(row: Record<string, any>): any {
  return {
    id: row.id,
    doubanId: row.doubanId ?? null,
    amazonAsin: row.amazonAsin ?? null,
    amazonUrl: row.amazonUrl ?? null,
    openLibraryKey: row.openLibraryKey ?? null,
    openLibraryUrl: row.openLibraryUrl ?? null,
    isbn13: row.isbn13 ?? null,
    isbn10: row.isbn10 ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    originalTitle: row.originalTitle ?? null,
    authors: parseAuthors(row.authors),
    publisher: row.publisher ?? null,
    pubdate: row.pubdate ?? null,
    price: row.price ?? null,
    pages: row.pages ?? null,
    binding: row.binding ?? null,
    series: row.series ?? null,
    summary: row.summary ?? null,
    authorIntro: row.authorIntro ?? null,
    catalog: row.catalog ?? null,
    coverUrl: row.coverUrl ?? null,
    coverPath: row.coverPath ?? null,
    bookType: (row.bookType as BookType) ?? 'physical',
    ebookPath: row.ebookPath ?? null,
    ebookFilename: row.ebookFilename ?? null,
    ebookSize: typeof row.ebookSize === 'number' ? row.ebookSize : null,
    ratingAverage: row.ratingAverage ?? null,
    ratingCount: row.ratingCount ?? null,
    doubanUrl: row.doubanUrl ?? null,
    categoryId: row.categoryId ?? null,
    readingStatus: row.readingStatus ?? 'unread',
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseAuthors(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

export { parseAuthors };

/** 把 authors 数组序列化为 JSON 字符串 */
export function stringifyAuthors(authors: string[] | undefined | null): string {
  return JSON.stringify(Array.isArray(authors) ? authors : []);
}


