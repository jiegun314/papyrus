/**
 * features/books/BookCard.tsx —— 书架网格中的单本书卡片。
 */
import type { Book } from '../../../shared/types';
import { Cover } from '../../components/Cover';
import { authorText, fmtRating } from '../../lib/format';
import { READING_STATUS_TEXT } from '../../lib/readingStatus';

export function BookCard({ book, onOpen }: { book: Book; onOpen: (id: number) => void }) {
  return (
    <button type="button" className="book-card" onClick={() => onOpen(book.id)}>
      <Cover className="book-cover" url={book.coverPath} alt={book.title}>
        <span className={`reading-badge ${book.readingStatus}`}>
          {READING_STATUS_TEXT[book.readingStatus]}
        </span>
      </Cover>
      <div className="book-meta">
        <div className="book-title-line">
          {book.category?.color ? (
            <span
              className="cat-dot"
              style={{ background: book.category.color }}
              title={book.category.name}
            />
          ) : null}
          <div className="book-title">{book.title}</div>
        </div>
        <div className="book-author">{authorText(book)}</div>
        {/* 评分行始终占位：无评分时留同等空白，保证所有卡片各行位置一致 */}
        <div className="book-rating">
          {book.ratingAverage != null ? (
            <>
              ★ {fmtRating(book.ratingAverage)}
              {book.ratingCount ? <span className="votes">{book.ratingCount} 人评价</span> : null}
            </>
          ) : null}
        </div>
      </div>
    </button>
  );
}
