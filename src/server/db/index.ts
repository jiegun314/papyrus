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

  seedCategories(db);
  return db;
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
    status: row.status,
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
