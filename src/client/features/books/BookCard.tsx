/**
 * features/books/BookCard.tsx —— 书架网格中的单本书卡片。
 */
import type { Book } from '../../../shared/types';
import { Cover } from '../../components/Cover';
import { authorText, fmtRating } from '../../lib/format';

export function BookCard({ book, onOpen }: { book: Book; onOpen: (id: number) => void }) {
  return (
    <button type="button" className="book-card" onClick={() => onOpen(book.id)}>
      <Cover className="book-cover" url={book.coverPath} alt={book.title}>
        <span className={`status-badge${book.status === 'in' ? ' in' : ''}`}>
          {book.status === 'out' ? '借出' : '在架'}
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
        {book.ratingAverage != null && (
          <div className="book-rating">
            ★ {fmtRating(book.ratingAverage)}
            {book.ratingCount ? <span className="votes">{book.ratingCount} 人评价</span> : null}
          </div>
        )}
      </div>
    </button>
  );
}
