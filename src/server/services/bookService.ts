/**
 * server/services/bookService.ts
 * ------------------------------------------------------------------
 * 书籍业务服务：所有针对 books / tags / reviews / lendings 的数据库操作
 * 都集中在这里，路由层只负责解析参数和返回 HTTP 响应。
 */
import type { Book, BookInput, BookQuery, Stats } from '../../shared/types.js';
import { getDb, rowToBook, stringifyAuthors, parseAuthors } from '../db/index.js';
import { removeCover } from './cover.js';

/* ------------------------------------------------------------------ */
/* 私有工具：查询书籍时的关联数据                                     */
/* ------------------------------------------------------------------ */

function loadCategoriesMap(): Map<number, { id: number; name: string; color: string; createdAt: string }> {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, color, created_at FROM categories').all() as any[];
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, color: r.color, createdAt: r.created_at }]));
}

function attachRelations(books: any[]): Book[] {
  if (books.length === 0) return [];
  const db = getDb();
  const ids = books.map((b) => b.id);
  const ph = ids.map(() => '?').join(',');

  // 分类
  const catMap = loadCategoriesMap();
  // 标签
  const tagRows = db
    .prepare(
      `SELECT bt.book_id, t.id, t.name, t.created_at FROM book_tags bt
       JOIN tags t ON t.id = bt.tag_id
       WHERE bt.book_id IN (${ph}) ORDER BY t.name`
    )
    .all(...ids) as any[];
  const tagsByBook = new Map<number, { id: number; name: string; createdAt: string }[]>();
  for (const r of tagRows) {
    if (!tagsByBook.has(r.book_id)) tagsByBook.set(r.book_id, []);
    tagsByBook.get(r.book_id)!.push({ id: r.id, name: r.name, createdAt: r.created_at });
  }
  // 当前借阅信息
  const lendRows = db
    .prepare(
      `SELECT * FROM lendings WHERE book_id IN (${ph}) AND status = 'borrowed'`
    )
    .all(...ids) as any[];
  const lendByBook = new Map<number, any>();
  for (const r of lendRows) {
    if (!lendByBook.has(r.book_id)) {
      lendByBook.set(r.book_id, {
        id: r.id,
        bookId: r.book_id,
        borrower: r.borrower,
        borrowedAt: r.borrowed_at,
        returnedAt: r.returned_at,
        note: r.note,
        status: r.status,
      });
    }
  }

  return books.map((row) => {
    const b = rowToBook(row) as Book;
    b.category = b.categoryId != null ? catMap.get(b.categoryId) ?? null : null;
    b.tags = tagsByBook.get(b.id) ?? [];
    b.activeLending = lendByBook.get(b.id) ?? null;
    return b;
  });
}

/* ------------------------------------------------------------------ */
/* 书籍 CRUD                                                          */
/* ------------------------------------------------------------------ */

/** 列出书籍（支持关键字/分类/标签/状态筛选） */
export function listBooks(query: BookQuery): Book[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.keyword) {
    where.push(
      `(b.title LIKE ? OR b.original_title LIKE ? OR b.authors LIKE ? OR b.isbn13 LIKE ? OR b.isbn10 LIKE ? OR b.publisher LIKE ?)`
    );
    const kw = `%${query.keyword}%`;
    params.push(kw, kw, kw, kw, kw, kw);
  }
  if (query.categoryId) {
    where.push('b.category_id = ?');
    params.push(query.categoryId);
  }
  if (query.status) {
    where.push('b.status = ?');
    params.push(query.status);
  }
  if (query.tagId) {
    where.push(`EXISTS (SELECT 1 FROM book_tags bt2 WHERE bt2.book_id = b.id AND bt2.tag_id = ?)`);
    params.push(query.tagId);
  }
  if (query.hasReview) {
    where.push('EXISTS (SELECT 1 FROM reviews r WHERE r.book_id = b.id)');
  }
  if (query.hasTag) {
    where.push('EXISTS (SELECT 1 FROM book_tags bt3 WHERE bt3.book_id = b.id)');
  }
  if (query.hasCategory) {
    where.push('b.category_id IS NOT NULL');
  }

  const limit = Math.min(query.limit ?? 200, 500);
  const offset = query.offset ?? 0;

  const sql = `
    SELECT b.* FROM books b
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, limit, offset) as any[];
  return attachRelations(rows);
}

/** 书籍详情（含标签、书评、当前借阅信息） */
export function getBook(id: number): Book | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
  if (!row) return null;
  const book = attachRelations([row])[0];

  const reviews = db
    .prepare('SELECT * FROM reviews WHERE book_id = ? ORDER BY created_at DESC')
    .all(id)
    .map((r: any) => ({
      id: r.id,
      bookId: r.book_id,
      rating: r.rating,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  book.reviews = reviews;
  return book;
}

/** 检查豆瓣 id 是否已存在 */
export function findBookByDoubanId(doubanId: string): Book | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM books WHERE douban_id = ?').get(doubanId) as any;
  return row ? attachRelations([row])[0] : null;
}

/** 新建书籍（手动录入或豆瓣导入） */
export function createBook(input: BookInput & { doubanId?: string | null }): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO books (
      douban_id, isbn13, isbn10, title, subtitle, original_title, authors,
      publisher, pubdate, price, pages, binding, series, summary, author_intro,
      catalog, cover_url, cover_path, rating_average, rating_count, douban_url,
      category_id, status, notes
    ) VALUES (
      @doubanId, @isbn13, @isbn10, @title, @subtitle, @originalTitle, @authors,
      @publisher, @pubdate, @price, @pages, @binding, @series, @summary, @authorIntro,
      @catalog, @coverUrl, @coverPath, @ratingAverage, @ratingCount, @doubanUrl,
      @categoryId, @status, @notes
    )`);

  const info = stmt.run({
    doubanId: input.doubanId ?? null,
    isbn13: input.isbn13 ?? null,
    isbn10: input.isbn10 ?? null,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    originalTitle: input.originalTitle?.trim() || null,
    authors: stringifyAuthors(input.authors),
    publisher: input.publisher?.trim() || null,
    pubdate: input.pubdate?.trim() || null,
    price: input.price?.trim() || null,
    pages: input.pages ?? null,
    binding: input.binding?.trim() || null,
    series: input.series?.trim() || null,
    summary: input.summary?.trim() || null,
    authorIntro: input.authorIntro?.trim() || null,
    catalog: input.catalog?.trim() || null,
    coverUrl: input.coverUrl ?? null,
    coverPath: null, // 封面由调用方在插入后单独下载
    ratingAverage: input.ratingAverage ?? null,
    ratingCount: input.ratingCount ?? null,
    doubanUrl: input.doubanUrl ?? null,
    categoryId: input.categoryId ?? null,
    status: input.status ?? 'in',
    notes: input.notes?.trim() || null,
  });
  return Number(info.lastInsertRowid);
}


/** 更新书籍 */
export function updateBook(id: number, input: BookInput): Book | null {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  const map: Record<string, string> = {
    title: 'title', subtitle: 'subtitle', originalTitle: 'original_title',
    publisher: 'publisher', pubdate: 'pubdate', price: 'price', pages: 'pages',
    binding: 'binding', series: 'series', summary: 'summary', authorIntro: 'author_intro',
    catalog: 'catalog', isbn13: 'isbn13', isbn10: 'isbn10', categoryId: 'category_id',
    status: 'status', notes: 'notes',
  };
  for (const key of Object.keys(map)) {
    if (key in input && input[key as keyof BookInput] !== undefined) {
      fields.push(`${map[key]} = @${key}`);
      params[key] = input[key as keyof BookInput] ?? null;
    }
  }
  if ('authors' in input && input.authors !== undefined) {
    fields.push('authors = @authors');
    params.authors = stringifyAuthors(input.authors);
  }
  if (fields.length === 0) return getBook(id);
  fields.push("updated_at = datetime('now','localtime')");
  db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return getBook(id);
}

/** 设置书籍封面本地路径（豆瓣导入后调用） */
export function setBookCoverPath(id: number, coverPath: string | null): void {
  getDb()
    .prepare(`UPDATE books SET cover_path = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(coverPath, id);
}

/** 设置书籍分类 */
export function setBookCategory(id: number, categoryId: number | null): Book | null {
  return updateBook(id, { categoryId } as BookInput);
}

/** 删除书籍（级联删除标签关联、书评、借阅记录与封面文件） */
export function deleteBook(id: number): boolean {
  const db = getDb();
  const book = getBook(id);
  if (!book) return false;
  db.prepare('DELETE FROM books WHERE id = ?').run(id);
  if (book.coverPath) removeCover(book.coverPath);
  return true;
}

/* ------------------------------------------------------------------ */
/* 分类 / 标签                                                         */
/* ------------------------------------------------------------------ */

export function listCategories() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM books b WHERE b.category_id = c.id) AS book_count
       FROM categories c ORDER BY c.id`
    )
    .all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    bookCount: r.book_count,
    createdAt: r.created_at,
  }));
}

/** 校验分类颜色不与其他分类重复（excludeId 用于重命名/改色时排除自身） */
function assertColorUnique(color: string, excludeId?: number): void {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM categories WHERE color = ? AND (? IS NULL OR id != ?)')
    .get(color, excludeId ?? null, excludeId ?? null);
  if (row) throw new Error('该分类颜色已被其他分类使用，请更换');
}

export function createCategory(name: string, color: string) {
  const db = getDb();
  const c = color?.trim() || '#6b7280';
  assertColorUnique(c);
  const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name.trim(), c);
  return Number(info.lastInsertRowid);
}

export function updateCategory(id: number, name?: string, color?: string) {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  if (!cur) return null;
  const newName = name?.trim() || cur.name;
  const newColor = color?.trim() || cur.color;
  if (newColor !== cur.color) assertColorUnique(newColor, id);
  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(newName, newColor, id);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

export function deleteCategory(id: number): boolean {
  const db = getDb();
  // 分类删除后，书籍的 category_id 通过外键 ON DELETE SET NULL 自动置空
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
}


export function listTags() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM book_tags bt WHERE bt.tag_id = t.id) AS book_count
       FROM tags t ORDER BY book_count DESC, t.name`
    )
    .all() as any[];
  return rows.map((r) => ({ id: r.id, name: r.name, bookCount: r.book_count, createdAt: r.created_at }));
}

/** 设置书籍的标签（传入标签名数组，自动创建新标签） */
export function setBookTags(bookId: number, tagNames: string[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(bookId);
    const names = [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))];
    for (const name of names) {
      let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as any;
      if (!tag) {
        const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
        tag = { id: Number(info.lastInsertRowid) };
      }
      db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)').run(bookId, tag.id);
    }
  });
  tx();
}

export function deleteTag(id: number): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM tags WHERE id = ?').run(id).changes > 0;
}

/* ------------------------------------------------------------------ */
/* 书评                                                               */
/* ------------------------------------------------------------------ */

export function addReview(bookId: number, rating: number | null, content: string) {
  const db = getDb();
  db.prepare('INSERT INTO reviews (book_id, rating, content) VALUES (?, ?, ?)')
    .run(bookId, rating, content.trim());
  return getBook(bookId);
}

export function updateReview(reviewId: number, rating: number | null, content: string) {
  const db = getDb();
  const r = db.prepare('SELECT book_id FROM reviews WHERE id = ?').get(reviewId) as any;
  if (!r) throw new Error('书评不存在');
  db.prepare(
    `UPDATE reviews SET rating = ?, content = ?, updated_at = datetime('now','localtime') WHERE id = ?`
  ).run(rating, content.trim(), reviewId);
  return getBook(r.book_id);
}

export function deleteReview(reviewId: number): number | null {
  const db = getDb();
  const r = db.prepare('SELECT book_id FROM reviews WHERE id = ?').get(reviewId) as any;
  if (!r) return null;
  db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
  return r.book_id;
}


/* ------------------------------------------------------------------ */
/* 借出 / 归还                                                        */
/* ------------------------------------------------------------------ */

/** 借出书籍 */
export function borrowBook(bookId: number, borrower: string, note?: string) {
  const db = getDb();
  const book = getBook(bookId);
  if (!book) throw new Error('书籍不存在');
  if (book.status === 'out') throw new Error('这本书已经在借出状态');
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO lendings (book_id, borrower, note) VALUES (?, ?, ?)')
      .run(bookId, borrower.trim(), note?.trim() || null);
    db.prepare("UPDATE books SET status = 'out', updated_at = datetime('now','localtime') WHERE id = ?")
      .run(bookId);
  });
  tx();
  return getBook(bookId);
}

/** 归还书籍（将当前所有未归还记录置为已归还） */
export function returnBook(bookId: number): Book | null {
  const db = getDb();
  const book = getBook(bookId);
  if (!book) throw new Error('书籍不存在');
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE lendings SET status = 'returned', returned_at = datetime('now','localtime')
       WHERE book_id = ? AND status = 'borrowed'`
    ).run(bookId);
    db.prepare("UPDATE books SET status = 'in', updated_at = datetime('now','localtime') WHERE id = ?")
      .run(bookId);
  });
  tx();
  return getBook(bookId);
}

/** 借阅记录列表 */
export function listLendings(status?: 'borrowed' | 'returned') {
  const db = getDb();
  const sql = `
    SELECT l.*, b.title AS book_title, b.authors AS book_authors, b.cover_path AS book_cover
    FROM lendings l
    JOIN books b ON b.id = l.book_id
    ${status ? 'WHERE l.status = ?' : ''}
    ORDER BY l.borrowed_at DESC LIMIT 500`;
  const rows = db.prepare(sql).all(...(status ? [status] : [])) as any[];
  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    borrower: r.borrower,
    borrowedAt: r.borrowed_at,
    returnedAt: r.returned_at,
    note: r.note,
    status: r.status,
    bookTitle: r.book_title,
    book: {
      title: r.book_title,
      authors: parseAuthors(r.book_authors),
      coverPath: r.book_cover,
    },
  }));
}

/* ------------------------------------------------------------------ */
/* 统计                                                               */
/* ------------------------------------------------------------------ */

export function getStats(): Stats {
  const db = getDb();
  const q = (sql: string): number =>
    (db.prepare(sql).get() as { c: number }).c;
  const recentRows = db
    .prepare('SELECT * FROM books ORDER BY created_at DESC LIMIT 5')
    .all() as any[];
  return {
    totalBooks: q('SELECT COUNT(*) AS c FROM books'),
    inLibrary: q(`SELECT COUNT(*) AS c FROM books WHERE status = 'in'`),
    borrowed: q(`SELECT COUNT(*) AS c FROM books WHERE status = 'out'`),
    tagCount: q('SELECT COUNT(*) AS c FROM tags'),
    categoryCount: q('SELECT COUNT(*) AS c FROM categories'),
    reviewCount: q('SELECT COUNT(*) AS c FROM reviews'),
    recentBooks: attachRelations(recentRows),
  };
}

