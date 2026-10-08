import React from "react";
import { Link } from "react-router-dom";
import { api, type Book } from "../lib/api";
import { formatRating } from "../lib/utils";
import { Toast, type ToastState } from "./Toast";

export function BookCard({ book, reason, saved = false, onSaved }: { book: Book; reason?: string; saved?: boolean; onSaved?: (saved: boolean) => void }) {
  const [toast, setToast] = React.useState<ToastState>(null);
  const [saving, setSaving] = React.useState(false);
  async function toggleSave() {
    if (!onSaved) return;
    const previous = saved;
    onSaved(previous ? false : true);
    setSaving(true);
    try {
      const result = await api.bookmark(book._id);
      onSaved(result.saved);
      setToast({ title: result.saved ? "Saved to your shelf" : "Removed from your shelf", message: book.title });
    } catch (error: any) {
      onSaved(previous);
      setToast({ title: "Couldn’t update bookmark", message: error?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="card card-pad book-card" style={{ gridColumn: "span 4" }}>
      <div className="book">
        <div className="cover">
          {book.coverImageUrl ? <img src={book.coverImageUrl} alt={book.title} /> : null}
        </div>
        <div className="meta">
          <h3>{book.title}</h3>
          <div className="author">{book.author}</div>
          <div className="small">
            <span>Rating: {formatRating(book.ratingsAvg, book.ratingsCount)}</span>
            <span>Reviews: {book.reviews?.length ?? 0}</span>
          </div>
          <div className="tags">
            {(book.genre || []).slice(0, 3).map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
          {reason ? <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Why it’s here: {reason}</div> : null}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" to={`/books/${book._id}`}>
              View details
            </Link>
            {onSaved ? <button className="btn" type="button" onClick={toggleSave} disabled={saving} aria-busy={saving} aria-pressed={saved} aria-label={saved ? `Remove ${book.title} from bookmarks` : `Save ${book.title}`}>{saving ? "Saving…" : saved ? "♥ Saved" : "♡ Save"}</button> : null}
          </div>
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </article>
  );
}
