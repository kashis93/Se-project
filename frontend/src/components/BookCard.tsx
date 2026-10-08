import React from "react";
import { Link } from "react-router-dom";
import { api, type Book } from "../lib/api";
import { formatRating } from "../lib/utils";
import { Toast, type ToastState } from "./Toast";
import { BookCoverImage } from "./MoodCarousel3D";

export function BookCard({
  book,
  reason,
  saved = false,
  onSaved
}: {
  book: Book;
  reason?: string;
  saved?: boolean;
  onSaved?: (saved: boolean) => void;
}) {
  const [toast, setToast] = React.useState<ToastState>(null);
  const [saving, setSaving] = React.useState(false);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!onSaved) return;
    const previous = saved;
    onSaved(!previous);
    setSaving(true);
    try {
      const result = await api.bookmark(book._id);
      onSaved(result.saved);
      window.dispatchEvent(new CustomEvent("bookrec:bookmarks-changed"));
      setToast({
        title: result.saved ? "Saved to your bookmarks" : "Removed from bookmarks",
        message: book.title
      });
    } catch (error: any) {
      onSaved(previous);
      setToast({
        title: "Couldn’t update bookmark",
        message: error?.message || "Please sign in to save books."
      });
    } finally {
      setSaving(false);
    }
  }

  const displayReason = book.matchReason || reason;

  return (
    <article className="book-card-v2" style={{ gridColumn: "span 4" }}>
      <div className="book-card-stage">
        <Link to={`/books/${book._id}`} className="book-card-cover-wrap" aria-label={`Inspect ${book.title}`}>
          <div className="book-card-cover">
            <BookCoverImage book={book} />
          </div>
        </Link>
        {onSaved ? (
          <button
            className={`book-card-bookmark-btn ${saved ? "is-saved" : ""}`}
            type="button"
            onClick={toggleSave}
            disabled={saving}
            aria-busy={saving}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${book.title} from bookmarks` : `Bookmark ${book.title}`}
            title={saved ? "Bookmarked" : "Save to bookmarks"}
          >
            {saved ? "♥" : "♡"}
          </button>
        ) : null}
        {book.matchScore ? (
          <span className="book-card-match tabular-nums">{book.matchScore}% match</span>
        ) : null}
      </div>

      <div className="book-card-body">
        <div className="meta-kicker">
          <span>{(book.genre || ["Literary"])[0]}</span>
          {book.genre?.[1] ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{book.genre[1]}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatRating(book.ratingsAvg, book.ratingsCount)} ★</span>
        </div>

        <h3 className="book-card-title">
          <Link to={`/books/${book._id}`}>{book.title}</Link>
        </h3>
        <div className="book-card-author">{book.author}</div>

        {displayReason ? (
          <div className="book-reason">{displayReason}</div>
        ) : book.description ? (
          <p className="book-card-desc">{book.description}</p>
        ) : null}

        <div className="book-card-footer">
          <Link className="btn btn-primary book-card-cta" to={`/books/${book._id}`}>
            Explore Edition
          </Link>
          {onSaved ? (
            <button
              type="button"
              className={`btn ${saved ? "btn-saved" : ""}`}
              onClick={toggleSave}
              disabled={saving}
            >
              {saving ? "…" : saved ? "Saved" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </article>
  );
}
