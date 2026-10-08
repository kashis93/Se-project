import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Book } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { clamp } from "../lib/utils";
import { Toast, type ToastState } from "../components/Toast";
import { BookCoverImage } from "../components/MoodCarousel3D";

export default function BookDetailsPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [toast, setToast] = React.useState<ToastState>(null);

  const [book, setBook] = React.useState<Book | null>(null);
  const [err, setErr] = React.useState<string>("");
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [completedGoal, setCompletedGoal] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([api.getBook(id), user ? api.activity() : Promise.resolve({ activity: { bookmarks: [], readingGoal: { completedBookIds: [] } } })])
      .then(([res, activity]) => {
        setBook(res.book);
        setSaved((activity.activity.bookmarks || []).some((b: any) => String(b.bookId) === id));
        setCompletedGoal((activity.activity.readingGoal?.completedBookIds || []).map(String).includes(String(id)));
      })
      .catch((e: any) => setErr(e?.message || "Failed to load book"));
  }, [id, user]);

  async function toggleCompletedGoal() {
    if (!id) return;
    if (!user) {
      setToast({ title: "Login required", message: "Sign in to track your monthly reading goal" });
      nav("/auth");
      return;
    }
    try {
      const res = await api.updateReadingGoal({ toggleBookId: id });
      const nowDone = (res.readingGoal.completedBookIds || []).map(String).includes(String(id));
      setCompletedGoal(nowDone);
      setToast({
        title: nowDone ? "Added to Monthly Reading Goal" : "Removed from Monthly Goal",
        message: `Progress: ${res.readingGoal.completedBookIds.length} / ${res.readingGoal.monthlyTarget} books this month.`
      });
    } catch (e: any) {
      setToast({ title: "Could not update goal", message: e?.message || "Try again" });
    }
  }

  async function toggleBookmark() {
    if (!id) return;
    if (!user) { setToast({ title: "Login required", message: "Sign in to save books to your shelf" }); nav("/auth"); return; }
    try {
      const res = await api.bookmark(id);
      setSaved(res.saved);
      window.dispatchEvent(new CustomEvent("bookrec:bookmarks-changed"));
      setToast({ title: res.saved ? "Saved to your bookmarks" : "Removed from bookmarks", message: "Your AI recommendations will use this signal." });
    }
    catch (e: any) { setToast({ title: "Save failed", message: e?.message || "Try again" }); }
  }

  async function purchase() {
    if (!id) return;
    if (!user) {
      setToast({ title: "Login required", message: "Please login to simulate purchase" });
      nav("/auth");
      return;
    }
    setBusy(true);
    try {
      await api.purchase(id);
      setToast({ title: "Purchased", message: "Purchase simulated and saved to your history" });
    } catch (e: any) {
      setToast({ title: "Purchase failed", message: e?.message || "Try again" });
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!user) {
      setToast({ title: "Login required", message: "Please login to rate & review" });
      nav("/auth");
      return;
    }
    setBusy(true);
    try {
      const res = await api.review(id, { rating: clamp(rating, 1, 5), comment: comment.trim() });
      setBook(res.book);
      setToast({ title: "Review saved", message: "Thanks for your feedback" });
      setComment("");
    } catch (e: any) {
      setToast({ title: "Review failed", message: e?.message || "Try again" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "22px 0" }}>
      {err ? (
        <div className="error">
          <b>Error:</b> {err}
        </div>
      ) : null}

      {!book ? (
        <Skeleton style={{ height: 260 }} />
      ) : (
        <div className="grid">
          <div className="card card-pad" style={{ gridColumn: "span 7" }}>
            <div className="book" style={{ gridTemplateColumns: "132px 1fr", gap: 22 }}>
              <div className="cover" style={{ width: 132, height: 192, borderRadius: 6 }}>
                <BookCoverImage book={book} />
              </div>
              <div className="meta">
                <h1 style={{ font: '700 34px/1.15 "Libre Baskerville",serif', margin: 0 }}>{book.title}</h1>
                <div className="author">{book.author}</div>
                <div className="small tabular-nums" style={{ marginTop: 10 }}>
                  <span>
                    Rating: {book.ratingsAvg?.toFixed?.(1) ?? "0.0"} ★ ({book.ratingsCount ?? 0} ratings)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{book.reviews?.length ?? 0} reviews</span>
                </div>
                <div className="tags">
                  {(book.genre || []).map((g) => (
                    <span className="tag" key={g}>
                      {g}
                    </span>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
                  {book.description || "No description."}
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={purchase} disabled={busy}>
                    {busy ? "Working…" : "Acquire Edition"}
                  </button>
                  <button className={`btn ${saved ? "btn-saved" : ""}`} onClick={toggleBookmark} disabled={busy} aria-pressed={saved}>
                    {saved ? "♥ Bookmarked" : "♡ Bookmark"}
                  </button>
                  <button className={`btn ${completedGoal ? "btn-saved" : ""}`} onClick={toggleCompletedGoal} disabled={busy} aria-pressed={completedGoal}>
                    {completedGoal ? "✓ Completed (Goal)" : "+ Log Read for Goal"}
                  </button>
                  <button className="btn" onClick={() => nav(`/recommendations?seed=${book._id}`)}>
                    AI Similar Picks
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad" style={{ gridColumn: "span 5" }}>
            <h3 style={{ marginTop: 0 }}>Rate & review</h3>
            <form onSubmit={submitReview} style={{ display: "grid", gap: 10 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Rating (1–5)
                </div>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Comment
                </div>
                <textarea
                  className="input"
                  style={{ minHeight: 110, resize: "vertical" }}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you like?"
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Submit review"}
              </button>
            </form>
          </div>

          <div className="card card-pad" style={{ gridColumn: "span 12" }}>
            <h3 style={{ marginTop: 0 }}>Reviews</h3>
            {book.reviews?.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {book.reviews
                  .slice()
                  .reverse()
                  .map((r, idx) => (
                    <div key={idx} className="card card-pad" style={{ boxShadow: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>{r.userName}</div>
                        <span className="pill">{r.rating}★</span>
                      </div>
                      {r.comment ? <div className="muted" style={{ marginTop: 8 }}>{r.comment}</div> : null}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="muted">No reviews yet.</div>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
