/**
 * server/services/bookService.ts
 * ------------------------------------------------------------------
 * 书籍业务服务：所有针对 books / tags / reviews 的数据库操作
 * 都集中在这里，路由层只负责解析参数和返回 HTTP 响应。
 *
 * 数据访问统一使用 Drizzle ORM 构建类型安全的查询（不再拼接 SQL 字符串），
 * 且所有函数均为 async（Promise），为将来切换到 Cloudflare D1 做好准备——
 * D1 的驱动粒度与下方 await db.select()/insert()/update()/delete() 一致，
 * 仅需把 getDb() 的驱动实例换成 drizzle-orm/d1 即可。
 */
import type { Book, BookInput, BookQuery, ReadingStatus, Stats } from '../../shared/types.js';
import { getDb, rowToBook, stringifyAuthors } from '../db/index.js';
import { removeCover } from './cover.js';
import { removeEbookFile } from './ebook.js';
import { eq, and, or, like, desc, count, sql, inArray, isNotNull, ne, type SQL } from 'drizzle-orm';
import { books, categories, tags, bookTags, reviews } from '../db/schema.js';

/* ------------------------------------------------------------------ */
/* 私有工具：查询书籍时的关联数据                                     */
/* ------------------------------------------------------------------ */

async function loadCategoriesMap(): Promise<Map<number, { id: number; name: string; color: string; createdAt: string }>> {
  const db = getDb();
  const rows = await db
    .select({ id: categories.id, name: categories.name, color: categories.color, createdAt: categories.createdAt })
    .from(categories);
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, color: r.color, createdAt: r.createdAt }]));
}

async function attachRelations(booksRows: any[]): Promise<Book[]> {
  if (booksRows.length === 0) return [];
  const db = getDb();
  const ids = booksRows.map((b) => b.id);
  const catMap = await loadCategoriesMap();

  // 标签
  const tagRows = await db
    .select({ bookId: bookTags.bookId, id: tags.id, name: tags.name, createdAt: tags.createdAt })
    .from(bookTags)
    .innerJoin(tags, eq(tags.id, bookTags.tagId))
    .where(inArray(bookTags.bookId, ids))
    .orderBy(tags.name);
  const tagsByBook = new Map<number, { id: number; name: string; createdAt: string }[]>();
  for (const r of tagRows) {
    if (!tagsByBook.has(r.bookId)) tagsByBook.set(r.bookId, []);
    tagsByBook.get(r.bookId)!.push({ id: r.id, name: r.name, createdAt: r.createdAt });
  }

  return booksRows.map((row) => {
    const b = rowToBook(row) as Book;
    b.category = b.categoryId != null ? catMap.get(b.categoryId) ?? null : null;
    b.tags = tagsByBook.get(b.id) ?? [];
    return b;
  });
}

/** 统计某表的行数（可选条件），返回 number */
async function countFrom(table: any, where?: SQL): Promise<number> {
  const db = getDb();
  const rows = await db.select({ c: count() }).from(table).where(where);
  return Number(rows[0]?.c ?? 0);
}

/* ------------------------------------------------------------------ */
/* 书籍 CRUD                                                          */
/* ------------------------------------------------------------------ */

/** 列出书籍（支持关键字/分类/标签/阅读状态筛选） */
export async function listBooks(query: BookQuery): Promise<Book[]> {
  const db = getDb();
  const conds: SQL[] = [];

  if (query.keyword) {
    const kw = `%${query.keyword}%`;
    conds.push(
      or(
        like(books.title, kw),
        like(books.originalTitle, kw),
        like(books.authors, kw),
        like(books.isbn13, kw),
        like(books.isbn10, kw),
        like(books.publisher, kw)
      ) as SQL
    );
  }
  if (query.categoryId) conds.push(eq(books.categoryId, query.categoryId));
  if (query.readingStatus) conds.push(eq(books.readingStatus, query.readingStatus));
  if (query.bookType) conds.push(eq(books.bookType, query.bookType));
  if (query.tagId)
    conds.push(sql`EXISTS (SELECT 1 FROM book_tags bt2 WHERE bt2.book_id = ${books.id} AND bt2.tag_id = ${query.tagId})`);
  if (query.hasReview) conds.push(sql`EXISTS (SELECT 1 FROM reviews r WHERE r.book_id = ${books.id})`);
  if (query.hasTag) conds.push(sql`EXISTS (SELECT 1 FROM book_tags bt3 WHERE bt3.book_id = ${books.id})`);
  if (query.hasCategory) conds.push(isNotNull(books.categoryId));

  const limit = Math.min(query.limit ?? 200, 500);
  const offset = query.offset ?? 0;

  const where: SQL | undefined = conds.length > 0 ? (and(...conds) as SQL) : undefined;
  const rows = await db
    .select()
    .from(books)
    .where(where)
    .orderBy(desc(books.createdAt))
    .limit(limit)
    .offset(offset);
  return attachRelations(rows);
}

/** 书籍详情（含标签、书评） */
export async function getBook(id: number): Promise<Book | null> {
  const db = getDb();
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const book = (await attachRelations([row]))[0];
  const reviewsRows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.bookId, id))
    .orderBy(desc(reviews.createdAt));
  book.reviews = reviewsRows.map((r) => ({
    id: r.id,
    bookId: r.bookId,
    rating: r.rating,
    content: r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return book;
}

/** 检查豆瓣 id 是否已存在 */
export async function findBookByDoubanId(doubanId: string): Promise<Book | null> {
  const db = getDb();
  const rows = await db.select().from(books).where(eq(books.doubanId, doubanId)).limit(1);
  return rows[0] ? (await attachRelations([rows[0]]))[0] : null;
}

/** 检查 Amazon ASIN 是否已存在 */
export async function findBookByAmazonAsin(asin: string): Promise<Book | null> {
  const db = getDb();
  const rows = await db.select().from(books).where(eq(books.amazonAsin, asin)).limit(1);
  return rows[0] ? (await attachRelations([rows[0]]))[0] : null;
}

/** 检查 Open Library work key 是否已存在 */
export async function findBookByOpenLibraryKey(key: string): Promise<Book | null> {
  const db = getDb();
  const rows = await db.select().from(books).where(eq(books.openLibraryKey, key)).limit(1);
  return rows[0] ? (await attachRelations([rows[0]]))[0] : null;
}

/** 新建书籍（手动录入或豆瓣/Amazon/Open Library 导入） */
export async function createBook(
  input: BookInput & {
    doubanId?: string | null;
    amazonAsin?: string | null;
    amazonUrl?: string | null;
    openLibraryKey?: string | null;
    openLibraryUrl?: string | null;
  }
): Promise<number> {
  const db = getDb();

  const res = await db.insert(books).values({
    doubanId: input.doubanId ?? null,
    amazonAsin: input.amazonAsin ?? null,
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
    coverPath: input.coverPath ?? null,
    bookType: input.bookType ?? 'physical',
    ebookPath: input.ebookPath ?? null,
    ebookFilename: input.ebookFilename ?? null,
    ebookSize: input.ebookSize ?? null,
    ratingAverage: input.ratingAverage ?? null,
    ratingCount: input.ratingCount ?? null,
    doubanUrl: input.doubanUrl ?? null,
    amazonUrl: input.amazonUrl ?? null,
    openLibraryKey: input.openLibraryKey ?? null,
    openLibraryUrl: input.openLibraryUrl ?? null,
    categoryId: input.categoryId ?? null,
    readingStatus: input.readingStatus ?? 'unread',
    notes: input.notes?.trim() || null,
  });
  return Number(res.lastInsertRowid);
}

/** 更新书籍（允许只传入部分字段，只更新出现的字段） */
export async function updateBook(id: number, input: Partial<BookInput>): Promise<Book | null> {
  const db = getDb();
  const prev = await getBook(id);

  const set: Record<string, unknown> = {};
  const map: Record<string, string> = {
    title: 'title',
    subtitle: 'subtitle',
    originalTitle: 'originalTitle',
    publisher: 'publisher',
    pubdate: 'pubdate',
    price: 'price',
    pages: 'pages',
    binding: 'binding',
    series: 'series',
    summary: 'summary',
    authorIntro: 'authorIntro',
    catalog: 'catalog',
    isbn13: 'isbn13',
    isbn10: 'isbn10',
    categoryId: 'categoryId',
    readingStatus: 'readingStatus',
    notes: 'notes',
    coverUrl: 'coverUrl',
    coverPath: 'coverPath',
    bookType: 'bookType',
    ebookPath: 'ebookPath',
    ebookFilename: 'ebookFilename',
    ebookSize: 'ebookSize',
  };
  for (const key of Object.keys(map)) {
    if (key in input && input[key as keyof BookInput] !== undefined) {
      set[key] = input[key as keyof BookInput] ?? null;
    }
  }
  if ('authors' in input && input.authors !== undefined) {
    set.authors = stringifyAuthors(input.authors);
  }
  if (Object.keys(set).length === 0) return getBook(id);

  // 封面 / 电子书被替换或清除时，事后清理旧文件（避免磁盘上残留孤儿文件）
  const coverChanged =
    'coverPath' in input &&
    input.coverPath !== undefined &&
    (input.coverPath ?? null) !== (prev?.coverPath ?? null);
  const ebookChanged =
    'ebookPath' in input &&
    input.ebookPath !== undefined &&
    (input.ebookPath ?? null) !== (prev?.ebookPath ?? null);

  (set as any).updatedAt = sql`datetime('now', 'localtime')`;
  await db.update(books).set(set as any).where(eq(books.id, id));

  const next = await getBook(id);
  if (coverChanged && prev?.coverPath) removeCover(prev.coverPath);
  if (ebookChanged && prev?.ebookPath) removeEbookFile(prev.ebookPath);
  return next;
}

/** 设置书籍封面本地路径（豆瓣导入后调用） */
export async function setBookCoverPath(id: number, coverPath: string | null): Promise<void> {
  const db = getDb();
  await db
    .update(books)
    .set({ coverPath, updatedAt: sql`datetime('now', 'localtime')` })
    .where(eq(books.id, id));
}

/** 设置书籍分类 */
export async function setBookCategory(id: number, categoryId: number | null): Promise<Book | null> {
  return updateBook(id, { categoryId });
}

/** 删除书籍（级联删除标签关联、书评与封面文件） */
export async function deleteBook(id: number): Promise<boolean> {
  const db = getDb();
  const book = await getBook(id);
  if (!book) return false;
  await db.delete(books).where(eq(books.id, id));
  if (book.coverPath) removeCover(book.coverPath);
  if (book.ebookPath) removeEbookFile(book.ebookPath);
  return true;
}

/* ------------------------------------------------------------------ */
/* 分类 / 标签                                                         */
/* ------------------------------------------------------------------ */

export async function listCategories() {
  const db = getDb();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      createdAt: categories.createdAt,
      bookCount: count(books.id),
    })
    .from(categories)
    .leftJoin(books, eq(books.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(categories.id);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    bookCount: r.bookCount,
    createdAt: r.createdAt,
  }));
}

/** 校验分类颜色不与其他分类重复（excludeId 用于重命名/改色时排除自身） */
async function assertColorUnique(color: string, excludeId?: number): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      excludeId != null
        ? and(eq(categories.color, color), ne(categories.id, excludeId))
        : eq(categories.color, color)
    )
    .limit(1);
  if (rows.length > 0) throw new Error('该分类颜色已被其他分类使用，请更换');
}

export async function createCategory(name: string, color: string): Promise<number> {
  const db = getDb();
  const c = color?.trim() || '#6b7280';
  await assertColorUnique(c);
  const res = await db.insert(categories).values({ name: name.trim(), color: c });
  return Number(res.lastInsertRowid);
}

export async function updateCategory(id: number, name?: string, color?: string) {
  const db = getDb();
  const cur = (await db.select().from(categories).where(eq(categories.id, id)).limit(1))[0];
  if (!cur) return null;
  const newName = name?.trim() || cur.name;
  const newColor = color?.trim() || cur.color;
  if (newColor !== cur.color) await assertColorUnique(newColor, id);
  await db.update(categories).set({ name: newName, color: newColor }).where(eq(categories.id, id));
  return (await db.select().from(categories).where(eq(categories.id, id)).limit(1))[0];
}

export async function deleteCategory(id: number): Promise<boolean> {
  const db = getDb();
  // 分类删除后，书籍的 category_id 通过外键 ON DELETE SET NULL 自动置空
  const res = await db.delete(categories).where(eq(categories.id, id));
  return res.changes > 0;
}

export async function listTags() {
  const db = getDb();
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      createdAt: tags.createdAt,
      bookCount: count(bookTags.bookId),
    })
    .from(tags)
    .leftJoin(bookTags, eq(bookTags.tagId, tags.id))
    .groupBy(tags.id);
  return rows
    .map((r) => ({ id: r.id, name: r.name, bookCount: r.bookCount, createdAt: r.createdAt }))
    .sort((a, b) => (b.bookCount - a.bookCount) || a.name.localeCompare(b.name));
}

/** 设置书籍的标签（传入标签名数组，自动创建新标签） */
export async function setBookTags(bookId: number, tagNames: string[]): Promise<void> {
  const db = getDb();
  // better-sqlite3 的 db.transaction 回调须同步执行（不能返回 Promise），
  // 所以这里用同步的 .run()/.get() 驱动 Drizzle；D1 场景下改为 await 即可。
  db.transaction(() => {
    db.delete(bookTags).where(eq(bookTags.bookId, bookId)).run();
    const names = [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))];
    for (const name of names) {
      let tag = db.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get();
      let tagId: number;
      if (tag) {
        tagId = tag.id;
      } else {
        const info = db.insert(tags).values({ name }).run();
        tagId = Number(info.lastInsertRowid);
      }
      db.insert(bookTags).values({ bookId, tagId }).onConflictDoNothing().run();
    }
  });
}

export async function deleteTag(id: number): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(tags).where(eq(tags.id, id));
  return res.changes > 0;
}

/* ------------------------------------------------------------------ */
/* 书评                                                               */
/* ------------------------------------------------------------------ */

export async function addReview(bookId: number, rating: number | null, content: string): Promise<Book | null> {
  const db = getDb();
  await db.insert(reviews).values({ bookId, rating, content: content.trim() });
  return getBook(bookId);
}

export async function updateReview(reviewId: number, rating: number | null, content: string): Promise<Book | null> {
  const db = getDb();
  const r = (await db.select({ bookId: reviews.bookId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1))[0];
  if (!r) throw new Error('书评不存在');
  await db
    .update(reviews)
    .set({ rating, content: content.trim(), updatedAt: sql`datetime('now', 'localtime')` })
    .where(eq(reviews.id, reviewId));
  return getBook(r.bookId);
}

export async function deleteReview(reviewId: number): Promise<number | null> {
  const db = getDb();
  const r = (await db.select({ bookId: reviews.bookId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1))[0];
  if (!r) return null;
  await db.delete(reviews).where(eq(reviews.id, reviewId));
  return r.bookId;
}

/* ------------------------------------------------------------------ */
/* 统计                                                               */
/* ------------------------------------------------------------------ */

export async function getStats(): Promise<Stats> {
  const db = getDb();
  const countByReadingStatus = (s: ReadingStatus): Promise<number> => countFrom(books, eq(books.readingStatus, s));
  const recentRows = await db.select().from(books).orderBy(desc(books.createdAt)).limit(5);

  return {
    totalBooks: await countFrom(books),
    physicalCount: await countFrom(books, eq(books.bookType, 'physical')),
    ebookCount: await countFrom(books, eq(books.bookType, 'ebook')),
    unread: await countByReadingStatus('unread'),
    reading: await countByReadingStatus('reading'),
    read: await countByReadingStatus('read'),
    abandoned: await countByReadingStatus('abandoned'),
    tagCount: await countFrom(tags),
    categoryCount: await countFrom(categories),
    reviewCount: await countFrom(reviews),
    recentBooks: await attachRelations(recentRows),
  };
}





