/**
 * frontend/main.ts
 * ------------------------------------------------------------------
 * Papyrus 前端主逻辑：视图渲染 + 用户交互。
 * 入口文件，由 esbuild 打包为 public/app.js。
 */
import './style.css';
import { api, ApiError } from './api.js';
import {
  esc, el, toast, openModal, starsComponent, loadingElement, fmtDate, fmtRating,
} from './ui.js';
import type { Book, BookQuery, Category, Tag, Lending, DoubanSearchResult } from '../shared/types.js';

/* ============================================================
 * 全局状态
 * ============================================================ */

type ViewName = 'shelf' | 'lendings' | 'tags' | 'categories';

const state: {
  view: ViewName;
  shelfQuery: BookQuery;
  categories: Category[];
  tags: Tag[];
  books: Book[];
} = {
  view: 'shelf',
  shelfQuery: {},
  categories: [],
  tags: [],
  books: [],
};

const appEl = () => document.getElementById('app')!;

/* ============================================================
 * 工具：封面 URL / 书籍展示
 * ============================================================ */

function coverUrl(book: Book): string | null {
  if (book.coverPath) return book.coverPath;
  return null;
}

function coverBlock(book: Book, cls = 'book-cover'): HTMLElement {
  const box = el('div', cls);
  const url = coverUrl(book);
  if (url) {
    const img = el('img');
    img.src = url;
    img.alt = book.title;
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      box.innerHTML = '';
      box.appendChild(placeholderIcon());
    });
    box.appendChild(img);
  } else {
    box.appendChild(placeholderIcon());
  }
  return box;
}

function placeholderIcon(): HTMLElement {
  const s = el('span', 'cover-fallback', '📖');
  return s;
}

function authorText(book: Book): string {
  return Array.isArray(book.authors) && book.authors.length ? book.authors.join(' / ') : '佚名';
}

/* ============================================================
 * 视图切换
 * ============================================================ */

function switchView(view: ViewName): void {
  state.view = view;
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.getAttribute('data-view') === view);
  });
  if (view === 'shelf') renderShelf();
  else if (view === 'lendings') renderLendings();
  else if (view === 'tags') renderTags();
  else renderCategories();
}

/* ============================================================
 * 书架视图
 * ============================================================ */

async function renderShelf(): Promise<void> {
  appEl().innerHTML = '';
  appEl().appendChild(loadingElement('正在加载书架…'));
  try {
    const [stats, categories, tags, books] = await Promise.all([
      api.getStats(),
      api.listCategories(),
      api.listTags(),
      api.listBooks(state.shelfQuery),
    ]);
    state.categories = categories;
    state.tags = tags;
    state.books = books;

    const root = document.createDocumentFragment();
    root.appendChild(renderStats(stats));

    // 筛选栏
    root.appendChild(renderFilterBar());

    // 书籍网格
    const grid = el('div', 'book-grid');
    if (books.length === 0) {
      const empty = el('div', 'empty-state');
      empty.innerHTML =
        `<span class="empty-icon">🪴</span>` +
        `<p>书架空空如也</p>` +
        `<p style="font-size:13px;margin-top:6px;">点击右上角「＋ 添加书籍」，通过 ISBN 或书名从豆瓣导入</p>`;
      grid.appendChild(empty);
    } else {
      for (const b of books) grid.appendChild(renderBookCard(b));
    }
    root.appendChild(grid);

    appEl().innerHTML = '';
    appEl().appendChild(root);
  } catch (e: any) {
    appEl().innerHTML = '';
    const empty = el('div', 'empty-state');
    empty.innerHTML = `<span class="empty-icon">⚠️</span><p>加载失败：${esc(e.message || e)}</p>`;
    appEl().appendChild(empty);
  }
}

/** 统计卡片 */
function renderStats(stats: { totalBooks: number; inLibrary: number; borrowed: number; tagCount: number; categoryCount: number; reviewCount: number }): HTMLElement {
  const row = el('div', 'stats-row');
  const cards: [string, number | string, string?][] = [
    ['藏书总数', stats.totalBooks],
    ['在架', stats.inLibrary, 'green'],
    ['借出', stats.borrowed, 'teal'],
    ['书评数', stats.reviewCount],
    ['标签', stats.tagCount],
    ['分类', stats.categoryCount],
  ];
  for (const [label, num, color] of cards) {
    const card = el('div', 'stat-card');
    const n = el('div', `stat-num ${color || ''}`, String(num));
    card.append(n, el('div', 'stat-label', label));
    row.appendChild(card);
  }
  return row;
}

/** 筛选栏 */
function renderFilterBar(): HTMLElement {
  const bar = el('div', 'filter-bar');

  // 搜索框
  const searchBox = el('div', 'search-box');
  searchBox.innerHTML = `<span class="search-icon">🔍</span>`;
  const searchInput = el('input');
  searchInput.type = 'text';
  searchInput.placeholder = '搜索书名 / 作者 / ISBN / 出版社…';
  searchInput.value = state.shelfQuery.keyword ?? '';
  let debounce: number | undefined;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      state.shelfQuery.keyword = searchInput.value.trim() || undefined;
      renderShelf();
    }, 350);
  });
  searchBox.appendChild(searchInput);

  // 分类下拉
  const catSelect = el('select', 'select');
  catSelect.appendChild(new Option('全部分类', ''));
  for (const c of state.categories) {
    catSelect.appendChild(new Option(c.name, String(c.id)));
  }
  catSelect.value = state.shelfQuery.categoryId ? String(state.shelfQuery.categoryId) : '';
  catSelect.addEventListener('change', () => {
    const v = catSelect.value;
    state.shelfQuery.categoryId = v ? Number(v) : undefined;
    renderShelf();
  });

  // 状态下拉
  const statusSelect = el('select', 'select');
  statusSelect.appendChild(new Option('全部状态', ''));
  statusSelect.appendChild(new Option('在架', 'in'));
  statusSelect.appendChild(new Option('借出', 'out'));
  statusSelect.value = state.shelfQuery.status ?? '';
  statusSelect.addEventListener('change', () => {
    const v = statusSelect.value;
    state.shelfQuery.status = (v === 'in' || v === 'out' ? v : undefined) as BookQuery['status'];
    renderShelf();
  });

  bar.append(searchBox, catSelect, statusSelect);
  return bar;
}

/** 书籍卡片 */
function renderBookCard(book: Book): HTMLElement {
  const card = el('button', 'book-card');
  const cover = coverBlock(book);
  if (book.status === 'out') {
    const badge = el('span', 'status-badge', '借出');
    cover.appendChild(badge);
  } else {
    const badge = el('span', 'status-badge in', '在架');
    cover.appendChild(badge);
  }

  const meta = el('div', 'book-meta');
  meta.appendChild(el('div', 'book-title', book.title));
  meta.appendChild(el('div', 'book-author', authorText(book)));
  if (book.ratingAverage != null) {
    const rating = el('div', 'book-rating');
    rating.innerHTML = `★ ${fmtRating(book.ratingAverage)}<span class="votes">${book.ratingCount ? book.ratingCount + ' 人评价' : ''}</span>`;
    meta.appendChild(rating);
  }

  card.append(cover, meta);
  card.addEventListener('click', () => openBookDetail(book.id));
  return card;
}

/* ============================================================
 * 添加书籍弹窗（豆瓣搜索 / 手动录入）
 * ============================================================ */

function openAddBookModal(): void {
  const body = el('div');
  const tabs = el('div', 'tabs');
  const tabDouban = el('button', 'tab active', '① 从豆瓣导入');
  const tabManual = el('button', 'tab', '② 手动录入');
  tabs.append(tabDouban, tabManual);
  const panel = el('div');
  body.append(tabs, panel);

  let activeTab = 'douban';
  const showTab = () => {
    panel.innerHTML = '';
    if (activeTab === 'douban') panel.appendChild(doubanPanel());
    else panel.appendChild(manualPanel());
  };

  tabDouban.addEventListener('click', () => {
    activeTab = 'douban';
    tabDouban.classList.add('active');
    tabManual.classList.remove('active');
    showTab();
  });
  tabManual.addEventListener('click', () => {
    activeTab = 'manual';
    tabManual.classList.add('active');
    tabDouban.classList.remove('active');
    showTab();
  });

  showTab();
  _closeCurrentModal = openModal({ title: '添加书籍', body, size: 'medium' });
}

/** 豆瓣导入面板：ISBN 或关键字搜索 */
function doubanPanel(): HTMLElement {
  const wrap = el('div');

  // 搜索输入区
  const inputRow = el('div', 'add-form');
  const input = el('input');
  input.type = 'text';
  input.placeholder = '输入 ISBN / 书名 / 作者，回车搜索豆瓣…';
  const searchBtn = el('button', 'btn btn-primary', '搜索');
  inputRow.append(input, searchBtn);
  wrap.appendChild(inputRow);

  // 结果显示区
  const results = el('div', 'douban-results');
  wrap.appendChild(results);

  const doSearch = async () => {
    const q = input.value.trim();
    if (!q) return toast('请输入搜索内容', 'error');
    results.innerHTML = '';
    results.appendChild(loadingElement('正在向豆瓣请求…'));
    try {
      const list = await api.doubanSearch(q);
      results.innerHTML = '';
      if (list.length === 0) {
        results.innerHTML = `<div class="empty-state" style="padding:40px 0;"><span class="empty-icon">📭</span><p>没有找到相关图书，换个关键词试试</p></div>`;
        return;
      }
      for (const item of list) results.appendChild(doubanResultItem(item));
    } catch (e: any) {
      results.innerHTML = '';
      results.innerHTML = `<div class="empty-state" style="padding:40px 0;"><span class="empty-icon">⚠️</span><p>${esc(e.message || e)}</p></div>`;
    }
  };

  searchBtn.addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  input.focus();

  // 默认展示一段提示
  results.innerHTML = `<div class="empty-state" style="padding:30px 0;"><span class="empty-icon">🔍</span><p>支持 ISBN（如 9787544270878）、书名或作者搜索</p></div>`;
  return wrap;
}

/** 单个豆瓣搜索结果条目 */
function doubanResultItem(item: DoubanSearchResult): HTMLElement {
  const row = el('div', 'douban-item');
  row.innerHTML = `
    <img src="${esc(item.image)}" alt="" onerror="this.style.visibility='hidden'" />
    <div style="flex:1;min-width:0;">
      <div class="db-title">${esc(item.title)}${item.subtitle ? `<span style="color:var(--ink-faint);font-size:12.5px;"> ${esc(item.subtitle)}</span>` : ''}</div>
      <div class="db-meta">${esc(item.authors ?? '')}${item.year ? ` · ${esc(item.year)}` : ''}${item.isbn ? ` · ISBN ${esc(item.isbn)}` : ''}</div>
    </div>
    <div class="db-actions">
      <button class="btn btn-sm btn-primary">保存到书架</button>
    </div>`;
  const saveBtn = row.querySelector('button')!;
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    try {
      const result = await api.doubanSave({ searchResult: item });
      toast(result.alreadyExists ? '这本书已在书架中' : '已保存到书架', 'success');
      switchView('shelf');
      openModalCloseCurrent();
    } catch (e: any) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存到书架';
      toast(e.message || '保存失败', 'error');
    }
  });
  return row;
}

// 保存最近的弹窗关闭函数，用于“保存到书架”成功后关闭添加弹窗
let _closeCurrentModal: (() => void) | null = null;
function openModalCloseCurrent(): void {
  _closeCurrentModal?.();
  _closeCurrentModal = null;
}


/** 手动录入表单（新增/编辑共用）。返回表单 DOM + 读取数据函数 */
function manualForm(initial?: Partial<Book>): { panel: HTMLElement; read: () => Record<string, unknown> } {
  const grid = el('div', 'form-grid');
  const fields: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};

  const mkInput = (label: string, key: string, value = '', full = false, type: 'text' | 'number' = 'text') => {
    const f = el('div', `form-field${full ? ' full' : ''}`);
    f.innerHTML = `<label for="mf-${key}">${label}</label>`;
    const input = el('input');
    input.id = `mf-${key}`;
    input.type = type;
    input.value = value ?? '';
    f.appendChild(input);
    grid.appendChild(f);
    fields[key] = input;
    return input;
  };
  const mkArea = (label: string, key: string, value = '') => {
    const f = el('div', 'form-field full');
    f.innerHTML = `<label for="mf-${key}">${label}</label>`;
    const area = el('textarea');
    area.id = `mf-${key}`;
    area.value = value ?? '';
    f.appendChild(area);
    grid.appendChild(f);
    fields[key] = area;
    return area;
  };

  mkInput('书名 *', 'title', initial?.title ?? '', true);
  mkInput('作者（多个用逗号分隔）', 'authors', Array.isArray(initial?.authors) ? initial.authors.join(', ') : '', true);
  mkInput('副标题', 'subtitle', initial?.subtitle ?? '');
  mkInput('出版社', 'publisher', initial?.publisher ?? '');
  mkInput('出版年', 'pubdate', initial?.pubdate ?? '');
  mkInput('定价', 'price', initial?.price ?? '');
  mkInput('页数', 'pages', initial?.pages ? String(initial.pages) : '', false, 'number');
  mkInput('ISBN', 'isbn', initial?.isbn13 ?? '');

  // 分类下拉
  const catField = el('div', 'form-field');
  catField.innerHTML = `<label for="mf-category">分类</label>`;
  const catSelect = el('select');
  catSelect.id = 'mf-category';
  catSelect.appendChild(new Option('（未分类）', ''));
  for (const c of state.categories) catSelect.appendChild(new Option(c.name, String(c.id)));
  catSelect.value = initial?.categoryId != null ? String(initial.categoryId) : '';
  catField.appendChild(catSelect);
  grid.appendChild(catField);
  fields.category = catSelect;

  mkArea('内容简介', 'summary', initial?.summary ?? '');
  mkArea('个人备注', 'notes', initial?.notes ?? '');

  const read = (): Record<string, unknown> => ({
    title: String(fields.title.value).trim(),
    authors: String(fields.authors.value)
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    subtitle: String(fields.subtitle.value).trim() || undefined,
    publisher: String(fields.publisher.value).trim() || undefined,
    pubdate: String(fields.pubdate.value).trim() || undefined,
    price: String(fields.price.value).trim() || undefined,
    pages: fields.pages.value ? Number(fields.pages.value) : undefined,
    isbn13: String(fields.isbn.value).trim() || undefined,
    categoryId: fields.category.value ? Number(fields.category.value) : null,
    summary: String(fields.summary.value).trim() || undefined,
    notes: String(fields.notes.value).trim() || undefined,
  });

  return { panel: grid, read };
}

/** 手动录入面板（含保存按钮逻辑，供添加弹窗使用） */
function manualPanel(): HTMLElement {
  const wrap = el('div');
  const { panel, read } = manualForm();
  wrap.appendChild(panel);
  const saveBtn = el('button', 'btn btn-primary btn-block', '保存到书架');
  saveBtn.style.marginTop = '18px';
  saveBtn.addEventListener('click', async () => {
    const data = read();
    if (!data.title) return toast('书名不能为空', 'error');
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    try {
      await api.createBook(data as any);
      toast('已保存到书架', 'success');
      openModalCloseCurrent();
      switchView('shelf');
    } catch (e: any) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存到书架';
      toast(e.message || '保存失败', 'error');
    }
  });
  wrap.appendChild(saveBtn);
  return wrap;
}

/* ============================================================
 * 书籍详情弹窗
 * ============================================================ */

async function openBookDetail(id: number): Promise<void> {
  const body = el('div');
  const close = openModal({ title: '', body, size: '' });
  body.appendChild(loadingElement('正在加载书籍详情…'));

  try {
    const book = await api.getBook(id);
    renderDetailContent(body, book, close);
  } catch (e: any) {
    body.innerHTML = `<div class="empty-state" style="padding:40px 0;"><span class="empty-icon">⚠️</span><p>${esc(e.message || e)}</p></div>`;
  }
}

function renderDetailContent(body: HTMLElement, book: Book, close: () => void): void {
  body.innerHTML = '';
  const detail = el('div', 'book-detail');

  // 封面
  const coverCell = el('div');
  coverCell.appendChild(coverBlock(book, 'detail-cover'));

  // 信息区
  const info = el('div', 'detail-info');

  const titleLine = el('div');
  const title = el('h2', undefined, book.title);
  if (book.subtitle) title.append(el('span', 'detail-subtitle', book.subtitle));
  titleLine.appendChild(title);

  const authorLine = el('div', 'detail-author', authorText(book));
  const metaLine = el('div', 'detail-meta');
  const chips: string[] = [];
  if (book.publisher) chips.push(`📕 ${book.publisher}`);
  if (book.pubdate) chips.push(`🗓 ${book.pubdate}`);
  if (book.pages) chips.push(`📄 ${book.pages}页`);
  if (book.price) chips.push(`💰 ${book.price}`);
  if (book.isbn13) chips.push(`🔢 ISBN ${book.isbn13}`);
  metaLine.innerHTML = chips.map((c) => `<span class="meta-chip">${esc(c)}</span>`).join('');

  // 评分（豆瓣 + 我的）——我的评分取自最新带评分的书评
  const myRating = book.reviews?.find((r) => r.rating != null)?.rating ?? 0;
  const ratingLine = el('div', 'detail-ratings');
  if (book.ratingAverage != null) {
    ratingLine.innerHTML =
      `<span class="db-rating">★ ${fmtRating(book.ratingAverage)}<small>豆瓣</small></span>` +
      `<span class="my-rating">我的评分 ${starsIcon(myRating)}</span>`;
  }

  // 分类
  if (book.category) {
    const catLine = el('div', 'detail-category');
    catLine.innerHTML = `<span class="dot" style="background:${esc(book.category.color)}"></span>${esc(book.category.name)}`;
    info.appendChild(catLine);
  }

  // 标签（可编辑）
  const tagsBox = el('div', 'detail-tags');
  tagsBox.appendChild(el('span', 'tags-label', '标签：'));
  for (const t of book.tags ?? []) {
    tagsBox.appendChild(tagChip(t.name));
  }
  const addTagBtn = el('button', 'tag-add', '＋');
  addTagBtn.title = '添加标签';
  tagsBox.appendChild(addTagBtn);

  addTagBtn.addEventListener('click', async () => {
    const res = await promptAddTag(book);
    if (res) {
      await api.setTags(book.id, res);
      const updated = await api.getBook(book.id);
      renderDetailContent(body, updated, close);
      renderShelf();
    }
  });

  // 借阅状态
  const borrowBox = el('div', 'borrow-box');
  if (book.activeLending) {
    const l = book.activeLending;
    borrowBox.innerHTML =
      `<div class="lend-status out">📤 借出中 — 借阅人：<b>${esc(l.borrower)}</b>，借于 ${esc(fmtDate(l.borrowedAt))}${l.note ? `，备注：${esc(l.note)}` : ''}</div>`;
    const returnBtn = el('button', 'btn btn-primary', '还书');
    returnBtn.addEventListener('click', async () => {
      try {
        await api.returnBook(book.id);
        toast('归还成功', 'success');
        const updated = await api.getBook(book.id);
        renderDetailContent(body, updated, close);
        renderShelf();
      } catch (e: any) {
        toast(e.message || '归还失败', 'error');
      }
    });
    borrowBox.appendChild(returnBtn);
  } else {
    borrowBox.innerHTML = `<div class="lend-status in">📥 在架</div>`;
    const lendBtn = el('button', 'btn btn-primary', '借出');
    lendBtn.addEventListener('click', () => promptBorrow(book, close));
    borrowBox.appendChild(lendBtn);
  }

  info.append(titleLine, authorLine, metaLine, ratingLine, tagsBox, borrowBox);
  body.appendChild(detail);
  detail.append(coverCell, info);

  // 简介
  if (book.summary) {
    const summaryBox = el('div', 'detail-section');
    summaryBox.innerHTML = `<h4>内容简介</h4><div class="summary-text">${esc(book.summary)}</div>`;
    info.appendChild(summaryBox);
  }

  // 作者简介
  if (book.authorIntro) {
    const introBox = el('div', 'detail-section');
    introBox.innerHTML = `<h4>作者简介</h4><div class="summary-text">${esc(book.authorIntro)}</div>`;
    info.appendChild(introBox);
  }

  // 我的备注
  if (book.notes) {
    const notesBox = el('div', 'detail-section');
    notesBox.innerHTML = `<h4>我的备注</h4><div class="summary-text">${esc(book.notes)}</div>`;
    info.appendChild(notesBox);
  }

  // 我的书评
  const reviewBox = el('div', 'detail-section');
  reviewBox.innerHTML = `<h4>我的书评（${(book.reviews ?? []).length}）</h4>`;
  const reviews = book.reviews ?? [];
  if (reviews.length === 0) {
    reviewBox.appendChild(el('p', 'no-reviews', '还没有书评，写下第一句话吧。'));
  } else {
    const sorted = [...reviews].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    for (const r of sorted) {
      const item = el('div', 'review-item');
      const head = el('div', 'review-head');
      head.append(starsComponent(r.rating ?? 0), el('span', 'review-date', fmtDate(r.createdAt)));
      const del = el('button', 'btn-link danger', '删除');
      del.addEventListener('click', async () => {
        try {
          await api.deleteReview(r.id);
          toast('书评已删除', 'success');
          const updated = await api.getBook(book.id);
          renderDetailContent(body, updated, close);
        } catch (e: any) {
          toast(e.message || '删除失败', 'error');
        }
      });
      head.appendChild(del);
      item.append(head, el('p', 'review-content', r.content));
      reviewBox.appendChild(item);
    }
  }

  // 添加书评
  const reviewForm = el('div', 'review-form');
  const myRatingBox = el('span', 'my-rating');
  const updateMyRating = (v: number) => {
    myRatingBox.innerHTML = `我的评分 ${starsIcon(v)}`;
  };
  updateMyRating(myRating);
  if (book.ratingAverage != null) {
    ratingLine.innerHTML += ` ${myRatingBox.outerHTML}`;
  }
  let selectedRating = 0;
  const stars = starsComponent(0, (v) => {
    selectedRating = v;
    updateMyRating(v);
  });
  const textArea = el('textarea');
  textArea.placeholder = '写点什么…（支持换行）';
  const submitBtn = el('button', 'btn btn-primary', '发表书评');
  submitBtn.addEventListener('click', async () => {
    const content = textArea.value.trim();
    if (!content && !selectedRating) return toast('书评内容或评分至少填写一项', 'error');
    try {
      await api.addReview(book.id, selectedRating || null, content || `评分 ${selectedRating} 星`);
      toast('书评已保存', 'success');
      const updated = await api.getBook(book.id);
      renderDetailContent(body, updated, close);
    } catch (e: any) {
      toast(e.message || '保存失败', 'error');
    }
  });
  reviewForm.append(el('div', 'review-stars', '评分：'), stars, textArea, submitBtn);
  reviewBox.appendChild(reviewForm);
  info.appendChild(reviewBox);

  detail.append(coverCell, info);
  body.appendChild(detail);

  // 底部操作
  const footer = el('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.flexWrap = 'wrap';
  const editBtn = el('button', 'btn', '✏️ 编辑信息');
  editBtn.addEventListener('click', () => openEditBook(book, close));
  const deleteBtn = el('button', 'btn btn-danger', '🗑 删除书籍');
  deleteBtn.addEventListener('click', () => confirmDelete(book, close));
  footer.append(editBtn, deleteBtn);
  const footerWrap = body.parentElement?.querySelector('.modal-footer');
  if (footerWrap) footerWrap.appendChild(footer);
}

function starsIcon(v: number): string {
  const filled = Math.round(v);
  return '★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled));
}

function tagChip(name: string, color?: string): HTMLElement {
  const chip = el('span', 'tag-chip');
  if (color) chip.style.borderColor = color;
  chip.textContent = name;
  return chip;
}


/* ============================================================
 * 借出 / 标签 / 编辑 / 删除
 * ============================================================ */

function promptBorrow(book: Book, closeDetail?: () => void): void {
  const wrap = el('div');
  const form = el('div', 'add-form');
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.placeholder = '借阅人姓名 *';
  const noteInput = el('input');
  noteInput.type = 'text';
  noteInput.placeholder = '备注（可选）';
  form.append(nameInput, noteInput);
  wrap.appendChild(form);
  wrap.appendChild(el('p', 'no-reviews', `将把《${book.title}》借出。`));

  const footer = el('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.justifyContent = 'flex-end';
  const cancelBtn = el('button', 'btn', '取消');
  const okBtn = el('button', 'btn btn-primary', '确认借出');
  footer.append(cancelBtn, okBtn);

  const close = openModal({ title: '借出书籍', body: wrap, footer });
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', async () => {
    const borrower = nameInput.value.trim();
    if (!borrower) return toast('请输入借阅人姓名', 'error');
    okBtn.disabled = true;
    okBtn.textContent = '借出中…';
    try {
      await api.borrow(book.id, borrower, noteInput.value.trim() || undefined);
      toast('借出成功', 'success');
      close();
      closeDetail?.();
      renderShelf();
    } catch (e: any) {
      okBtn.disabled = false;
      okBtn.textContent = '确认借出';
      toast(e.message || '借出失败', 'error');
    }
  });
  nameInput.focus();
}

/** 选择/输入标签。返回选中的标签名数组（空数组表示不变更） */
async function promptAddTag(book: Book): Promise<string[] | null> {
  const current = new Set((book.tags ?? []).map((t) => t.name));
  const wrap = el('div');
  const chips = el('div', 'tag-picker');

  // 常用标签（已有标签，可切换）
  let selected = new Set<string>(current);
  const refresh = () => {
    chips.querySelectorAll('.tag-chip.selectable').forEach((c) => {
      c.classList.toggle('active', selected.has(c.textContent || ''));
    });
  };
  for (const tag of state.tags) {
    const chip = el('span', 'tag-chip selectable');
    chip.textContent = tag.name;
    chip.addEventListener('click', () => {
      if (selected.has(tag.name)) selected.delete(tag.name);
      else selected.add(tag.name);
      refresh();
    });
    chips.appendChild(chip);
  }

  const inputRow = el('div', 'add-form');
  const newTagInput = el('input');
  newTagInput.type = 'text';
  newTagInput.placeholder = '输入新标签，回车添加';
  inputRow.appendChild(newTagInput);
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const name = newTagInput.value.trim();
      if (name && !selected.has(name)) {
        selected.add(name);
        const chip = el('span', 'tag-chip selectable active', name);
        chip.addEventListener('click', () => {
          selected.delete(name);
          chip.remove();
        });
        chips.appendChild(chip);
        newTagInput.value = '';
      }
    }
  });

  wrap.append(chips, inputRow);

  const footer = el('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.justifyContent = 'flex-end';
  const cancelBtn = el('button', 'btn', '取消');
  const okBtn = el('button', 'btn btn-primary', '保存');
  footer.append(cancelBtn, okBtn);

  return new Promise((resolve) => {
    const close = openModal({
      title: '设置标签',
      body: wrap,
      footer,
      onClose: () => resolve(null),
    });
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', () => {
      const result = Array.from(selected).filter(Boolean);
      resolve(result);
      close();
    });
    newTagInput.focus();
  });
}

function openEditBook(book: Book, closeDetail?: () => void): void {
  const { panel, read } = manualForm(book);
  const wrap = el('div');
  wrap.appendChild(panel);

  const footer = el('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.justifyContent = 'flex-end';
  const cancelBtn = el('button', 'btn', '取消');
  const okBtn = el('button', 'btn btn-primary', '保存修改');
  footer.append(cancelBtn, okBtn);

  const close = openModal({ title: `编辑《${book.title}》`, body: wrap, footer });
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', async () => {
    const data = read();
    if (!data.title) return toast('书名不能为空', 'error');
    okBtn.disabled = true;
    okBtn.textContent = '保存中…';
    try {
      await api.updateBook(book.id, data as any);
      toast('修改已保存', 'success');
      close();
      closeDetail?.();
      renderShelf();
    } catch (e: any) {
      okBtn.disabled = false;
      okBtn.textContent = '保存修改';
      toast(e.message || '保存失败', 'error');
    }
  });
}

function confirmDelete(book: Book, closeDetail?: () => void): void {
  const wrap = el('div');
  wrap.appendChild(el('p', undefined, `确定要删除《${book.title}》吗？此操作不可恢复，书评与借阅记录将一并删除。`));

  const footer = el('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.justifyContent = 'flex-end';
  const cancelBtn = el('button', 'btn', '取消');
  const delBtn = el('button', 'btn btn-danger', '确认删除');
  footer.append(cancelBtn, delBtn);

  const close = openModal({ title: '删除书籍', body: wrap, footer });
  cancelBtn.addEventListener('click', close);
  delBtn.addEventListener('click', async () => {
    delBtn.disabled = true;
    delBtn.textContent = '删除中…';
    try {
      await api.deleteBook(book.id);
      toast('已删除', 'success');
      close();
      closeDetail?.();
      renderShelf();
    } catch (e: any) {
      delBtn.disabled = false;
      delBtn.textContent = '确认删除';
      toast(e.message || '删除失败', 'error');
    }
  });
}

/* ============================================================
 * 借阅记录视图
 * ============================================================ */

async function renderLendings(): Promise<void> {
  appEl().innerHTML = '';
  appEl().appendChild(loadingElement('正在加载借阅记录…'));
  try {
    const [borrowed, returned] = await Promise.all([
      api.listLendings('borrowed'),
      api.listLendings('returned'),
    ]);

    const root = document.createDocumentFragment();
    root.appendChild(lendingsSection('📤 当前借出', borrowed, false));
    root.appendChild(lendingsSection('📥 历史归还', returned, true));
    appEl().innerHTML = '';
    appEl().appendChild(root);
  } catch (e: any) {
    appEl().innerHTML = '';
    appEl().appendChild(el('p', undefined, `加载失败：${e.message}`));
  }
}

function lendingsSection(title: string, list: Lending[], isHistory: boolean): HTMLElement {
  const sec = el('div', 'lendings-section');
  const h3 = el('h3', undefined, title);
  h3.appendChild(el('span', 'lend-count', String(list.length)));
  sec.appendChild(h3);

  if (list.length === 0) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = `<span class="empty-icon">${isHistory ? '🗂' : '🕊'}</span><p>${isHistory ? '还没有归还记录' : '没有正在借出的书籍'}</p>`;
    sec.appendChild(empty);
    return sec;
  }

  const table = el('table', 'lend-table');
  const thead = el('thead');
  thead.innerHTML =
    `<tr><th>书籍</th><th>借阅人</th><th>借出时间</th><th>${isHistory ? '归还时间' : '备注'}</th><th>状态</th></tr>`;
  table.appendChild(thead);
  const tbody = el('tbody');
  for (const l of list) {
    const tr = el('tr');
    const bookCell = el('td', 'td-book');
    bookCell.innerHTML =
      `<img src="${esc(l.book?.coverPath ?? '')}" alt="" onerror="this.style.visibility='hidden'" />` +
      `<div><div class="td-title">${esc(l.book?.title ?? '未知书籍')}</div><div class="td-sub">${esc(l.book?.authors?.join(' / ') ?? '')}</div></div>`;
    bookCell.addEventListener('click', () => {
      if (l.bookId) openBookDetail(l.bookId);
    });
    tr.append(
      bookCell,
      el('td', undefined, l.borrower),
      el('td', undefined, fmtDate(l.borrowedAt)),
      el('td', undefined, isHistory ? fmtDate(l.returnedAt) : (l.note || '—')),
    );
    const statusTd = el('td');
    if (l.returnedAt) {
      statusTd.appendChild(el('span', 'lend-badge', '已归还'));
    } else {
      statusTd.appendChild(el('span', 'lend-badge active', '借出中'));
    }
    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  sec.appendChild(table);
  return sec;
}

/* ============================================================
 * 标签管理视图
 * ============================================================ */

async function renderTags(): Promise<void> {
  appEl().innerHTML = '';
  appEl().appendChild(loadingElement('正在加载标签…'));
  try {
    const tags = await api.listTags();
    state.tags = tags;
    const root = document.createDocumentFragment();
    root.appendChild(el('h3', 'view-title', '🏷 标签管理'));

    if (tags.length === 0) {
      const empty = el('div', 'empty-state');
      empty.innerHTML = `<span class="empty-icon">🏷</span><p>还没有标签。给书籍添加标签后会自动出现在这里。</p>`;
      root.appendChild(empty);
    } else {
      const list = el('div', 'meta-list');
      for (const t of tags) {
        const item = el('div', 'meta-item');
        const left = el('div', 'meta-left');
        const name = el('span', 'tag-chip', t.name);
        left.append(name, el('span', 'meta-count', `${t.bookCount} 本书`));
        const delBtn = el('button', 'btn-link danger', '删除');
        delBtn.addEventListener('click', async () => {
          if (!confirm(`确定删除标签「${t.name}」？书籍会保留，只是移除该标签。`)) return;
          try {
            await api.deleteTag(t.id);
            toast('标签已删除', 'success');
            renderTags();
            renderShelf();
          } catch (e: any) {
            toast(e.message || '删除失败', 'error');
          }
        });
        item.append(left, delBtn);
        list.appendChild(item);
      }
      root.appendChild(list);
    }
    appEl().innerHTML = '';
    appEl().appendChild(root);
  } catch (e: any) {
    appEl().innerHTML = '';
    appEl().appendChild(el('p', undefined, `加载失败：${e.message}`));
  }
}

/* ============================================================
 * 分类管理视图
 * ============================================================ */

const PALETTE = ['#b4552d', '#2d6a4f', '#1d4e89', '#8d5a2a', '#6d597a', '#2c3e50', '#a45c40', '#3a5a40'];

async function renderCategories(): Promise<void> {
  appEl().innerHTML = '';
  appEl().appendChild(loadingElement('正在加载分类…'));
  try {
    const categories = await api.listCategories();
    state.categories = categories;
    const root = document.createDocumentFragment();
    root.appendChild(el('h3', 'view-title', '📚 分类管理'));

    const list = el('div', 'meta-list');
    for (const c of categories) {
      const item = el('div', 'meta-item');
      const left = el('div', 'meta-left');
      const swatch = el('span', 'dot');
      swatch.style.background = c.color;
      left.append(swatch, el('span', 'meta-name', c.name), el('span', 'meta-count', `${c.bookCount} 本书`));
      const renameBtn = el('button', 'btn-link', '重命名');
      renameBtn.addEventListener('click', () => promptRenameCategory(c));
      const delBtn = el('button', 'btn-link danger', '删除');
      delBtn.addEventListener('click', async () => {
        if (!confirm(`确定删除分类「${c.name}」？分类下的书籍会变为「未分类」。`)) return;
        try {
          await api.deleteCategory(c.id);
          toast('分类已删除', 'success');
          renderCategories();
          renderShelf();
        } catch (e: any) {
          toast(e.message || '删除失败', 'error');
        }
      });
      item.append(left, renameBtn, delBtn);
      list.appendChild(item);
    }
    root.appendChild(list);

    // 新增分类
    const addRow = el('div', 'add-form');
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.placeholder = '新分类名称';
    const colorInput = el('input');
    colorInput.type = 'color';
    colorInput.value = PALETTE[0];
    colorInput.style.width = '44px';
    colorInput.style.padding = '0';
    const addBtn = el('button', 'btn btn-primary', '添加分类');
    addBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return toast('请输入分类名称', 'error');
      try {
        await api.createCategory(name, colorInput.value);
        toast('分类已添加', 'success');
        nameInput.value = '';
        renderCategories();
        renderShelf();
      } catch (e: any) {
        toast(e.message || '添加失败', 'error');
      }
    });
    addRow.append(nameInput, colorInput, addBtn);
    root.appendChild(addRow);

    appEl().innerHTML = '';
    appEl().appendChild(root);
  } catch (e: any) {
    appEl().innerHTML = '';
    appEl().appendChild(el('p', undefined, `加载失败：${e.message}`));
  }
}

function promptRenameCategory(c: Category): void {
  const wrap = el('div', 'add-form');
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.value = c.name;
  const colorInput = el('input');
  colorInput.type = 'color';
  colorInput.value = c.color;
  colorInput.style.width = '44px';
  colorInput.style.padding = '0';
  wrap.append(nameInput, colorInput);

  const footer = el('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.justifyContent = 'flex-end';
  const cancelBtn = el('button', 'btn', '取消');
  const okBtn = el('button', 'btn btn-primary', '保存');
  footer.append(cancelBtn, okBtn);

  const close = openModal({ title: '编辑分类', body: wrap, footer });
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) return toast('分类名称不能为空', 'error');
    try {
      await api.updateCategory(c.id, name, colorInput.value);
      toast('分类已更新', 'success');
      close();
      renderCategories();
      renderShelf();
    } catch (e: any) {
      toast(e.message || '保存失败', 'error');
    }
  });
  nameInput.focus();
  nameInput.select();
}

/* ============================================================
 * 初始化
 * ============================================================ */

function init(): void {
  // 导航切换
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      switchView(tab.getAttribute('data-view') as ViewName);
    });
  });

  // 添加书籍按钮
  const addBtn = document.getElementById('btn-add-book');
  addBtn?.addEventListener('click', openAddBookModal);

  // 初始视图
  switchView('shelf');
}

// 全局异常兜底（网络错误时给出提示）
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
});

init();

