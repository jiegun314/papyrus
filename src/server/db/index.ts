/**
 * server/db/index.ts
 * ------------------------------------------------------------------
 * 数据库连接单例：打开 SQLite、执行建表语句、注入默认分类。
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_SQL, DEFAULT_CATEGORIES } from './schema.js';

// 项目根目录（src/server/db/ -> 项目根）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const COVERS_DIR = path.join(DATA_DIR, 'covers');
export const DB_PATH = path.join(DATA_DIR, 'papyrus.db');

let db: Database.Database | null = null;

/** 获取数据库实例（懒加载） */
export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // 并发读写更安全
  db.pragma('foreign_keys = ON');  // 启用外键级联删除
  db.exec(SCHEMA_SQL);
  migrate(db); // 旧库结构升级（借出状态 → 阅读状态）

  seedCategories(db);
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
            rating_average REAL,
            rating_count   INTEGER,
            douban_url     TEXT,
            category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            reading_status TEXT NOT NULL DEFAULT 'unread' CHECK (reading_status IN ('unread','reading','read','abandoned')),
            notes          TEXT,
            created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          );
          INSERT INTO books_new (
            id, douban_id, isbn13, isbn10, title, subtitle, original_title, authors,
            publisher, pubdate, price, pages, binding, series, summary, author_intro,
            catalog, cover_url, cover_path, rating_average, rating_count, douban_url,
            category_id, reading_status, notes, created_at, updated_at
          )
          SELECT
            id, douban_id, isbn13, isbn10, title, subtitle, original_title, authors,
            publisher, pubdate, price, pages, binding, series, summary, author_intro,
            catalog, cover_url, cover_path, rating_average, rating_count, douban_url,
            category_id, 'unread', notes, created_at, updated_at
          FROM books;
          DROP TABLE books;
          ALTER TABLE books_new RENAME TO books;
        `);
        // 旧表删除后原索引一并消失，重新执行建表脚本恢复（title / isbn / category）
        db.exec(SCHEMA_SQL);
      });
      rebuild();
    } finally {
      db.pragma(`foreign_keys = ${fkOn ? 'ON' : 'OFF'}`);
    }
  }

  // 阅读状态筛选索引（每次启动都会确保存在）
  db.exec('CREATE INDEX IF NOT EXISTS idx_books_reading_status ON books(reading_status)');
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
  if (db) {
    db.close();
    db = null;
  }
}

/** 将数据库行转换为前端 Book 对象（统一处理字段映射） */
export function rowToBook(row: Record<string, unknown>): any {
  return {
    id: row.id,
    doubanId: row.douban_id ?? null,
    isbn13: row.isbn13 ?? null,
    isbn10: row.isbn10 ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    originalTitle: row.original_title ?? null,
    authors: parseAuthors(row.authors),
    publisher: row.publisher ?? null,
    pubdate: row.pubdate ?? null,
    price: row.price ?? null,
    pages: row.pages ?? null,
    binding: row.binding ?? null,
    series: row.series ?? null,
    summary: row.summary ?? null,
    authorIntro: row.author_intro ?? null,
    catalog: row.catalog ?? null,
    coverUrl: row.cover_url ?? null,
    coverPath: row.cover_path ?? null,
    ratingAverage: row.rating_average ?? null,
    ratingCount: row.rating_count ?? null,
    doubanUrl: row.douban_url ?? null,
    categoryId: row.category_id ?? null,
    readingStatus: row.reading_status ?? 'unread',
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
