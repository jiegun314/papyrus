/**
 * features/books/BookDetailModal.tsx —— 书籍详情弹窗。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Book, Category, ReadingStatus, Tag } from '../../../shared/types';
import {
  addReview,
  deleteBook,
  deleteReview,
  ebookDownloadUrl,
  getBook,
  refreshBook as refreshBookInfo,
  retryCover,
  setCategory,
  setTags,
  updateBook,
} from '../../api/books';
import { errorMessage } from '../../api/http';
import { listCategories } from '../../api/meta';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Cover } from '../../components/Cover';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Modal } from '../../components/Modal';
import { StarRating } from '../../components/StarRating';
import { useToast } from '../../components/Toast';
import { authorText, fmtBytes, fmtDate, fmtRating, starsText } from '../../lib/format';
import { BOOK_TYPE_TEXT } from '../../lib/bookType';
import { READING_STATUS_OPTIONS, READING_STATUS_TEXT } from '../../lib/readingStatus';
import { EditBookDialog } from './EditBookDialog';
import { TagPickerDialog } from './TagPickerDialog';

export interface BookDetailModalProps {
  bookId: number;
  onClose: () => void;
  /** 任何数据变更成功后回调（父级刷新列表/统计） */
  onMutated: () => void;
}

export function BookDetailModal({ bookId, onClose, onMutated }: BookDetailModalProps) {
  const toast = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catReady, setCatReady] = useState(false);
  const [catBusy, setCatBusy] = useState(false);
  const [retryArmed, setRetryArmed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [liveRating, setLiveRating] = useState(0);

  /** 重新拉取详情并通知父级 */
  const refreshBook = useCallback(async () => {
    const updated = await getBook(bookId);
    setBook(updated);
    setLiveRating(0);
    onMutated();
  }, [bookId, onMutated]);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    setBook(null);
    getBook(bookId)
      .then((b) => {
        if (alive) setBook(b);
      })
      .catch((e) => {
        if (alive) setLoadError(errorMessage(e));
      });
    setCategories([]);
    setCatReady(false);
    listCategories()
      .then((cs) => {
        if (alive) {
          setCategories(cs);
          setCatReady(true);
        }
      })
      .catch(() => {
        // 分类加载失败时仍开放「未分类」选项
        if (alive) setCatReady(true);
      });
    return () => {
      alive = false;
    };
  }, [bookId]);

  /* ---------- 封面：缺图 / 加载失败 → 可点击重新下载 ---------- */
  const hasCoverSource = Boolean(
    book &&
      (book.coverUrl ||
        book.amazonAsin ||
        book.openLibraryKey ||
        book.doubanId ||
        book.isbn13 ||
        book.isbn10)
  );
  const armCoverRetry = useCallback(() => {
    if (hasCoverSource) setRetryArmed(true);
  }, [hasCoverSource]);

  useEffect(() => {
    if (book?.coverPath) {
      setRetryArmed(false);
      setRetrying(false);
    } else if (book && hasCoverSource && !retryArmed) {
      armCoverRetry();
    }
  }, [book, hasCoverSource, retryArmed, armCoverRetry]);

  const onCoverRetry = async () => {
    if (!book || retrying) return;
    setRetrying(true);
    try {
      await retryCover(book.id);
      toast('封面下载成功', 'success');
      await refreshBook();
    } catch (e) {
      toast(errorMessage(e), 'error');
      setRetrying(false);
    }
  };

  /** 从原数据源重新抓取并刷新除封面图片外的书籍信息（保留本地封面/电子书/个人数据） */
  const onRefreshInfo = async () => {
    if (!book || refreshing) return;
    setRefreshing(true);
    try {
      const updated = await refreshBookInfo(book.id);
      setBook(updated);
      setLiveRating(0);
      toast('书籍信息已刷新', 'success');
      onMutated();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  /* ---------- 各类变更处理 ---------- */
  const changeCategory = async (val: string) => {
    if (!book) return;
    const nextId = val ? Number(val) : null;
    const curId = book.category?.id ?? null;
    if (nextId === curId) return;
    setCatBusy(true);
    try {
      await setCategory(book.id, nextId);
      toast(nextId ? '分类已设定' : '已设为未分类', 'success');
      await refreshBook();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setCatBusy(false);
    }
  };

  const removeTag = async (t: Tag) => {
    if (!book) return;
    try {
      const remaining = (book.tags ?? []).filter((x) => x.id !== t.id).map((x) => x.name);
      await setTags(book.id, remaining);
      toast('标签已删除', 'success');
      await refreshBook();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  /** 切换阅读状态（未读 / 阅读中 / 已读 / 放弃） */
  const changeReadingStatus = async (s: ReadingStatus) => {
    if (!book || s === book.readingStatus || statusBusy) return;
    setStatusBusy(true);
    try {
      await updateBook(book.id, { readingStatus: s });
      toast(`已标记为「${READING_STATUS_TEXT[s]}」`, 'success');
      await refreshBook();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!book) return;
    await deleteBook(book.id);
    toast('已删除', 'success');
    onMutated();
    onClose();
  };

  /* ---------- 书评区处理 ---------- */
  const submitReview = async (rating: number, contentRaw: string): Promise<boolean> => {
    if (!book) return false;
    const content = contentRaw.trim();
    if (!content && !rating) {
      toast('书评内容或评分至少填写一项', 'error');
      return false;
    }
    try {
      await addReview(book.id, rating || null, content || `评分 ${rating} 星`);
      toast('书评已保存', 'success');
      setLiveRating(0);
      await refreshBook();
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    try {
      await deleteReview(reviewId);
      toast('书评已删除', 'success');
      await refreshBook();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  /* ---------- 渲染 ---------- */
  if (loadError) {
    return (
      <Modal open title="" onClose={onClose}>
        <EmptyState icon="⚠️" compact>
          <p>{loadError}</p>
        </EmptyState>
      </Modal>
    );
  }

  if (!book) {
    return (
      <Modal open title="" onClose={onClose}>
        <Loading text="正在加载书籍详情…" />
      </Modal>
    );
  }

  const reviews = book.reviews ?? [];
  const sortedReviews = [...reviews].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  const latestRated = sortedReviews.find((r) => r.rating != null)?.rating ?? 0;
  const shownMyRating = liveRating || latestRated;
  const myRatingText = `我的评分 ${starsText(shownMyRating)}`;
  const catName = book.category?.name ?? '未分类';
  const catColor = book.category?.color;
  const coverCls = `detail-cover${retryArmed ? ' cover-retry' : ''}${retrying ? ' cover-retrying' : ''}`;

  return (
    <>
      <Modal open title="" onClose={onClose}>
        <div className="book-detail">
          {/* 左：封面 */}
          <Cover
            className={coverCls}
            url={book.coverPath}
            alt={book.title}
            onClick={retryArmed && !retrying ? onCoverRetry : undefined}
            title={retryArmed ? '点击重新下载封面' : undefined}
            onImageError={armCoverRetry}
            fallback={<span className="cover-fallback">{retrying ? '⏳' : '📖'}</span>}
          />

          {/* 右：书籍信息 */}
          <div className="detail-info">
            <div className="detail-category">
              <span className="tags-label">分类：</span>
              <span className="dot" style={{ background: catColor ?? 'transparent' }} title={catName} />
              <select
                className="category-select"
                value={book.category?.id ? String(book.category.id) : ''}
                disabled={!catReady || catBusy}
                onChange={(e) => changeCategory(e.target.value)}
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <h2 className="detail-title">
              <span className={`book-type-tag ${book.bookType}`}>{BOOK_TYPE_TEXT[book.bookType]}</span>
              {book.title}
              {book.subtitle ? <span className="detail-subtitle">{book.subtitle}</span> : null}
            </h2>
            <div className="detail-authors">{authorText(book)}</div>

            {/* 出版信息胶囊 */}
            <div className="detail-meta">
              {book.publisher ? <span className="meta-chip">📕 {book.publisher}</span> : null}
              {book.pubdate ? <span className="meta-chip">🗓 {book.pubdate}</span> : null}
              {book.pages ? <span className="meta-chip">📄 {book.pages}页</span> : null}
              {book.price ? <span className="meta-chip">💰 {book.price}</span> : null}
              {book.isbn13 ? <span className="meta-chip">🔢 ISBN {book.isbn13}</span> : null}
            </div>

            {/* 评分：豆瓣 + 我的 */}
            <div className="detail-ratings">
              {book.ratingAverage != null ? (
                <span className="db-rating">
                  ★ {fmtRating(book.ratingAverage)}
                  <small>豆瓣</small>
                </span>
              ) : null}
              <span className="my-rating">{myRatingText}</span>
            </div>

            {/* 标签 */}
            <div className="detail-tags">
              <span className="tags-label">标签：</span>
              {(book.tags ?? []).map((t) => (
                <span key={t.id} className="tag-chip removable">
                  {t.name}
                  <button
                    type="button"
                    className="chip-remove"
                    title={`移除标签「${t.name}」`}
                    onClick={() => removeTag(t)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="tag-add" title="添加标签" onClick={() => setTagOpen(true)}>
                ＋
              </button>
            </div>

            {/* 阅读状态 */}
            <div className="reading-box">
              <span className="reading-box-label">阅读状态：</span>
              <div className="reading-seg">
                {READING_STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`reading-seg-btn${book.readingStatus === s ? ' active' : ''}`}
                    data-status={s}
                    disabled={statusBusy}
                    title={`标记为「${READING_STATUS_TEXT[s]}」`}
                    onClick={() => changeReadingStatus(s)}
                  >
                    {READING_STATUS_TEXT[s]}
                  </button>
                ))}
              </div>
            </div>
            {/* 电子书文件：电子书已上传时显示，可在线预览 / 下载 */}
            {book.bookType === 'ebook' && book.ebookPath ? (
              <div className="detail-section ebook-section">
                <h3>电子书文件</h3>
                <div className="ebook-detail-row">
                  <span className="ebook-detail-file">
                    📕 {book.ebookFilename}
                    {book.ebookSize ? <small>（{fmtBytes(book.ebookSize)}）</small> : null}
                  </span>
                  <span className="ebook-detail-actions">
                    <a className="btn" href={book.ebookPath} target="_blank" rel="noreferrer">
                      查看
                    </a>
                    <a className="btn btn-primary" href={ebookDownloadUrl(book.id)}>
                      下载
                    </a>
                  </span>
                </div>
              </div>
            ) : null}
            {/* 内容简介 / 作者简介 / 我的备注 —— 位于右列 detail-info 内部 */}
          {book.summary ? (
            <div className="detail-section">
              <h3>内容简介</h3>
              <div className="content">{book.summary}</div>
            </div>
          ) : null}
          {book.authorIntro ? (
            <div className="detail-section">
              <h3>作者简介</h3>
              <div className="content">{book.authorIntro}</div>
            </div>
          ) : null}
          {book.notes ? (
            <div className="detail-section">
              <h3>我的备注</h3>
              <div className="content">{book.notes}</div>
            </div>
          ) : null}

          {/* 书评 */}
          <div className="detail-section">
            <h3>我的书评（{reviews.length}）</h3>
            {sortedReviews.length === 0 ? (
              <p className="no-reviews">还没有书评，写下第一句话吧。</p>
            ) : (
              <div className="review-list">
                {sortedReviews.map((r) => (
                  <div key={r.id} className="review-item">
                    <div className="review-head">
                      <StarRating value={r.rating ?? 0} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="review-date">{fmtDate(r.createdAt)}</span>
                        <button
                          type="button"
                          className="btn-link danger"
                          onClick={() => handleDeleteReview(r.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="review-content">{r.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 撰写书评 */}
            <ReviewComposer onRate={(v) => setLiveRating(v)} onSubmit={submitReview} />
          </div>
          </div>

          {/* 底部操作 */}
          <div className="detail-footer">
            <button type="button" className="btn" onClick={() => setEditOpen(true)}>
              ✏️ 编辑信息
            </button>
            {hasCoverSource ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={onCoverRetry}
                  disabled={retrying || refreshing}
                >
                  {retrying ? '下载中…' : '🔄 重新下载封面'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={onRefreshInfo}
                  disabled={refreshing || retrying}
                >
                  {refreshing ? '刷新中…' : '↻ 刷新书籍信息'}
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
              🗑 删除书籍
            </button>
          </div>
        </div>
      </Modal>
      {/* 嵌套弹窗 */}
      <TagPickerDialog
        book={book}
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        onDone={() => refreshBook().catch((e) => toast(errorMessage(e), 'error'))}
      />
      <EditBookDialog
        book={book}
        categories={categories}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          onMutated();
          onClose();
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="删除书籍"
        danger
        confirmText="确认删除"
        message={<p>确定要删除《{book.title}》吗？此操作不可恢复，书评与标签关联将一并删除。</p>}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/* ============================================================
 * 撰写书评小组件
 * ============================================================ */
function ReviewComposer({
  onRate,
  onSubmit,
}: {
  /** 实时预览「我的评分」 */
  onRate: (v: number) => void;
  onSubmit: (rating: number, content: string) => Promise<boolean>;
}) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await onSubmit(rating, content);
      if (ok) {
        setRating(0);
        setContent('');
        onRate(0);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="review-form">
      <div className="review-stars">
        评分：
        <StarRating
          value={rating}
          onChange={(v) => {
            setRating(v);
            onRate(v);
          }}
        />
      </div>
      <textarea
        placeholder="写点什么…（支持换行）"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
        {busy ? '保存中…' : '发表书评'}
      </button>
    </div>
  );
}

