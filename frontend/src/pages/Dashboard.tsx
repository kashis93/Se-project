import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type Book } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { Toast, type ToastState } from "../components/Toast";
import { BookCard } from "../components/BookCard";
import { BookCoverImage } from "../components/MoodCarousel3D";

export default function DashboardPage() {
  const nav = useNavigate();
  const [toast, setToast] = React.useState<ToastState>(null);
  const [activity, setActivity] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string>("");
  const [saved, setSaved] = React.useState<Book[] | null>(null);
  const [catalog, setCatalog] = React.useState<Book[]>([]);
  const [catalogMap, setCatalogMap] = React.useState<Map<string, Book>>(new Map());
  const [updatingGoal, setUpdatingGoal] = React.useState(false);
  const [selectedBookToLog, setSelectedBookToLog] = React.useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section");
  const active =
    section === "bookmarks"
      ? "saved"
      : section === "orders"
      ? "purchased"
      : section === "rated"
      ? "rated"
      : section === "goals"
      ? "goals"
      : "overview";

  const loadData = React.useCallback(() => {
    Promise.all([api.activity(), api.savedBooks(), api.listBooks({ page: 1, limit: 40 })])
      .then(([activityRes, savedRes, catalogRes]) => {
        setActivity(activityRes.activity);
        setSaved(savedRes.items || []);
        const items = catalogRes.items || [];
        setCatalog(items);
        setCatalogMap(new Map(items.map((b) => [String(b._id), b])));
      })
      .catch((e: any) => setErr(e?.message || "Failed to load your reading room"));
  }, []);

  React.useEffect(() => {
    loadData();
    const onChanged = () => loadData();
    window.addEventListener("bookrec:bookmarks-changed", onChanged);
    return () => window.removeEventListener("bookrec:bookmarks-changed", onChanged);
  }, [loadData]);

  const savedSet = React.useMemo(
    () => new Set((saved || []).map((b) => String(b._id))),
    [saved]
  );

  const monthlyTarget: number = activity?.readingGoal?.monthlyTarget ?? 4;
  const completedBookIds: string[] = activity?.readingGoal?.completedBookIds ?? [];
  const completedCount = completedBookIds.length;
  const progressPercent = Math.min(100, Math.round((completedCount / Math.max(1, monthlyTarget)) * 100));
  const remainingCount = Math.max(0, monthlyTarget - completedCount);

  const currentMonthName = React.useMemo(() => {
    return new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  }, []);

  async function handleTargetChange(nextTarget: number) {
    const clamped = Math.max(1, Math.min(50, nextTarget));
    setUpdatingGoal(true);
    try {
      const res = await api.updateReadingGoal({ monthlyTarget: clamped });
      setActivity(res.activity);
      setToast({
        title: "Monthly Reading Goal Updated",
        message: `Target set to ${clamped} ${clamped === 1 ? "book" : "books"} for ${currentMonthName}.`
      });
    } catch (e: any) {
      setToast({ title: "Couldn’t update goal", message: e?.message || "Please try again." });
    } finally {
      setUpdatingGoal(false);
    }
  }

  async function handleToggleCompletedBook(bookId: string) {
    if (!bookId) return;
    setUpdatingGoal(true);
    try {
      const res = await api.updateReadingGoal({ toggleBookId: bookId });
      setActivity(res.activity);
      const book = catalogMap.get(bookId);
      const isNowDone = (res.readingGoal.completedBookIds || []).includes(bookId);
      setToast({
        title: isNowDone ? "Logged toward Monthly Goal" : "Removed from Monthly Goal",
        message: book ? book.title : "Reading progress updated."
      });
    } catch (e: any) {
      setToast({ title: "Couldn’t update progress", message: e?.message || "Please try again." });
    } finally {
      setUpdatingGoal(false);
    }
  }

  function switchTab(nextSection?: string) {
    if (!nextSection) {
      setSearchParams({});
    } else {
      setSearchParams({ section: nextSection });
    }
  }

  const completedBooksList = React.useMemo(() => {
    return completedBookIds
      .map((id) => catalogMap.get(String(id)))
      .filter(Boolean) as Book[];
  }, [completedBookIds, catalogMap]);

  const uncompletedCatalog = React.useMemo(() => {
    const doneSet = new Set(completedBookIds.map(String));
    return catalog.filter((b) => !doneSet.has(String(b._id)));
  }, [catalog, completedBookIds]);

  return (
    <div style={{ padding: "28px 0" }}>
      <div className="section-head" style={{ marginTop: 8 }}>
        <div>
          <span className="eyebrow">YOUR READING ROOM & SIGNALS</span>
          <h1 style={{ font: '700 42px "Libre Baskerville",serif', margin: "10px 0 6px" }}>
            {active === "purchased"
              ? "Your Purchased Editions"
              : active === "saved"
              ? "Your Saved Bookmarks"
              : active === "rated"
              ? "Your Ratings & Reviews"
              : active === "goals"
              ? "Monthly Reading Goals"
              : "A Record of Your Reading"}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Set your monthly reading target, track completed books, and manage the bookmarks that train your AI shelf.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => nav("/recommendations")}
          >
            Generate AI Recommendations
          </button>
        </div>
      </div>

      <div className="filter-bar shelf-modes" role="tablist" aria-label="Library sections">
        <button
          type="button"
          className={active === "overview" ? "btn btn-primary" : "btn"}
          onClick={() => switchTab()}
        >
          Overview
        </button>
        <button
          type="button"
          className={active === "goals" ? "btn btn-primary" : "btn"}
          onClick={() => switchTab("goals")}
        >
          Reading Goals ({completedCount}/{monthlyTarget})
        </button>
        <button
          type="button"
          className={active === "saved" ? "btn btn-primary" : "btn"}
          onClick={() => switchTab("bookmarks")}
        >
          Saved Bookmarks ({saved?.length ?? 0})
        </button>
        <button
          type="button"
          className={active === "purchased" ? "btn btn-primary" : "btn"}
          onClick={() => switchTab("orders")}
        >
          Purchased ({activity?.purchases?.length ?? 0})
        </button>
        <button
          type="button"
          className={active === "rated" ? "btn btn-primary" : "btn"}
          onClick={() => switchTab("rated")}
        >
          Rated ({activity?.ratings?.length ?? 0})
        </button>
      </div>

      {err ? (
        <div className="error">
          <b>Error:</b> {err}
        </div>
      ) : null}

      {/* READING GOALS TRACKER SECTION (Visible in Overview and Goals tabs) */}
      {active === "overview" || active === "goals" ? (
        <section className="card card-pad reading-goal-card" style={{ marginTop: 18 }}>
          <div className="reading-goal-top">
            <div>
              <span className="eyebrow">MONTHLY READING CHALLENGE · {currentMonthName.toUpperCase()}</span>
              <h2 className="reading-goal-title">
                {completedCount >= monthlyTarget
                  ? `Goal Achieved! ${completedCount} of ${monthlyTarget} Books Read`
                  : `${completedCount} of ${monthlyTarget} Books Completed This Month`}
              </h2>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
                {completedCount >= monthlyTarget
                  ? "Congratulations! You have reached your monthly reading target. Raise your target or keep logging books."
                  : `${remainingCount} more ${remainingCount === 1 ? "book" : "books"} to reach your ${currentMonthName} target (${progressPercent}% complete).`}
              </p>
            </div>

            <div className="goal-target-controls">
              <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                Monthly Target:
              </span>
              <div className="goal-stepper">
                <button
                  type="button"
                  className="btn"
                  disabled={updatingGoal || monthlyTarget <= 1}
                  onClick={() => handleTargetChange(monthlyTarget - 1)}
                  aria-label="Decrease monthly book target"
                >
                  −
                </button>
                <span className="goal-target-num tabular-nums">{monthlyTarget} books</span>
                <button
                  type="button"
                  className="btn"
                  disabled={updatingGoal || monthlyTarget >= 50}
                  onClick={() => handleTargetChange(monthlyTarget + 1)}
                  aria-label="Increase monthly book target"
                >
                  +
                </button>
              </div>
              <div className="goal-presets">
                {[2, 4, 6, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={monthlyTarget === preset ? "btn btn-primary" : "btn"}
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    disabled={updatingGoal}
                    onClick={() => handleTargetChange(preset)}
                  >
                    {preset}/mo
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="goal-progress-wrap">
            <div className="goal-progress-labels tabular-nums">
              <span>Progress: {completedCount} / {monthlyTarget} books</span>
              <b>{progressPercent}%</b>
            </div>
            <div
              className="goal-progress-track"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Monthly reading goal progress"
            >
              <div
                className={`goal-progress-fill ${completedCount >= monthlyTarget ? "is-complete" : ""}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="goal-milestones tabular-nums">
              {Array.from({ length: Math.min(monthlyTarget, 12) }).map((_, idx) => {
                const filled = idx < completedCount;
                return (
                  <span
                    key={idx}
                    className={`goal-slot ${filled ? "is-filled" : ""}`}
                    title={filled ? `Book ${idx + 1} completed` : `Book ${idx + 1} remaining`}
                  >
                    {filled ? "✓" : idx + 1}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Completed Books & Log New Book Controls */}
          <div className="goal-books-row">
            <div style={{ flex: "1 1 380px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                Completed Books This Month ({completedBooksList.length})
              </div>
              {completedBooksList.length > 0 ? (
                <div className="goal-completed-grid">
                  {completedBooksList.map((book) => (
                    <div key={book._id} className="goal-completed-item">
                      <Link
                        to={`/books/${book._id}`}
                        className="cover"
                        style={{ width: 42, height: 62, flexShrink: 0 }}
                      >
                        <BookCoverImage book={book} />
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          to={`/books/${book._id}`}
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {book.title}
                        </Link>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {book.author}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        disabled={updatingGoal}
                        onClick={() => handleToggleCompletedBook(book._id)}
                        title="Remove from completed books"
                      >
                        Undo
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>
                  No books logged as completed yet this month. Log a book from the selector or mark one from your bookmarks!
                </div>
              )}
            </div>

            <div className="goal-log-box">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                Log a Finished Book
              </div>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                Finished reading an edition? Add it to your monthly progress bar.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="input"
                  style={{ padding: "8px 10px", fontSize: 13 }}
                  value={selectedBookToLog}
                  onChange={(e) => setSelectedBookToLog(e.target.value)}
                >
                  <option value="">Select a book from catalog…</option>
                  {uncompletedCatalog.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.title} — {b.author}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedBookToLog || updatingGoal}
                  onClick={() => {
                    if (!selectedBookToLog) return;
                    handleToggleCompletedBook(selectedBookToLog);
                    setSelectedBookToLog("");
                  }}
                >
                  + Log Read
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* SAVED BOOKMARKS FULL VIEW */}
      {active === "saved" ? (
        <section style={{ marginTop: 20 }}>
          {!saved ? (
            <div className="grid">
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ gridColumn: "span 4" }}>
                  <Skeleton style={{ height: 200 }} />
                </div>
              ))}
            </div>
          ) : saved.length > 0 ? (
            <div className="grid">
              {saved.map((book) => (
                <BookCard
                  key={book._id}
                  book={book}
                  saved={savedSet.has(book._id)}
                  reason="Saved in your bookmarks shelf"
                  onSaved={(val) => {
                    if (!val) {
                      setSaved((prev) => (prev || []).filter((item) => item._id !== book._id));
                      setToast({ title: "Removed from bookmarks", message: book.title });
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="recommendation-empty">
              <div>
                <b>Your bookmarks shelf is empty.</b>
                <div style={{ marginTop: 4 }}>
                  Explore the 3D mood showcase or catalog and tap “♡ Bookmark” on any book you want to save for later.
                </div>
              </div>
              <Link className="btn btn-primary" to="/">
                Browse the Catalog
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {/* OVERVIEW OR SPECIFIC SECTIONS */}
      {active !== "saved" ? (
        <div className="grid" style={{ marginTop: 18 }}>
          <div className="card card-pad" style={{ gridColumn: "span 12" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Saved Bookmarks Shelf</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
                  Your bookmarked books act as primary affinity anchors for the AI recommendation engine. You can also mark them as read directly.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="muted tabular-nums" style={{ fontSize: 13 }}>
                  {saved?.length ?? 0} saved editions
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => switchTab("bookmarks")}
                >
                  Manage Bookmarks
                </button>
              </div>
            </div>
            {!saved ? (
              <Skeleton style={{ height: 90, marginTop: 14 }} />
            ) : saved.length ? (
              <div className="saved-strip">
                {saved.map((book) => {
                  const isDone = completedBookIds.includes(String(book._id));
                  return (
                    <div className="saved-book" key={book._id}>
                      <Link
                        to={`/books/${book._id}`}
                        className="cover"
                        style={{ width: 48, height: 70, flexShrink: 0 }}
                      >
                        <BookCoverImage book={book} />
                      </Link>
                      <div style={{ display: "grid", alignContent: "center", gap: 4, flex: 1, minWidth: 0 }}>
                        <Link
                          to={`/books/${book._id}`}
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {book.title}
                        </Link>
                        <small className="muted">{book.author}</small>
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className={isDone ? "btn btn-saved" : "btn"}
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            onClick={() => handleToggleCompletedBook(book._id)}
                          >
                            {isDone ? "✓ Read" : "+ Mark Read"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            onClick={() => nav(`/recommendations?seed=${book._id}`)}
                          >
                            AI Similar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="recommendation-empty" style={{ marginTop: 14 }}>
                <b>Your saved shelf is waiting.</b>
                <span>Browse the catalog and tap Bookmark on any title you want to remember.</span>
                <Link className="btn btn-primary" to="/">
                  Browse books
                </Link>
              </div>
            )}
          </div>

          <div className="card card-pad" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Recent Search Signals</div>
            <div className="muted" style={{ marginTop: 8 }}>
              {activity ? (
                (activity.searches || []).length ? (
                  (activity.searches || [])
                    .slice(-8)
                    .reverse()
                    .map((s: any, i: number) => (
                      <div key={i} className="activity-row">
                        <div style={{ fontWeight: 600, color: "var(--ink)" }}>“{s.query}”</div>
                        <div className="muted tabular-nums" style={{ fontSize: 12 }}>
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Recorded signal"}
                        </div>
                      </div>
                    ))
                ) : (
                  <div style={{ padding: "12px 0" }}>No searches recorded yet.</div>
                )
              ) : (
                <Skeleton style={{ height: 160 }} />
              )}
            </div>
          </div>

          <div className="card card-pad" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Purchased Editions</div>
            <div className="muted" style={{ marginTop: 8 }}>
              {activity ? (
                (activity.purchases || []).length ? (
                  (activity.purchases || [])
                    .slice(-8)
                    .reverse()
                    .map((p: any, i: number) => {
                      const b = catalogMap.get(String(p.bookId));
                      return (
                        <div key={i} className="activity-row">
                          <Link
                            to={`/books/${p.bookId}`}
                            style={{ fontWeight: 600, color: "var(--ink)", display: "block" }}
                          >
                            {b ? b.title : `Edition #${String(p.bookId).slice(-6)}`}
                          </Link>
                          <div className="muted tabular-nums" style={{ fontSize: 12 }}>
                            ${(p.price ?? 9.99).toFixed(2)} ·{" "}
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "Acquired"}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div style={{ padding: "12px 0" }}>No purchases recorded yet.</div>
                )
              ) : (
                <Skeleton style={{ height: 160 }} />
              )}
            </div>
          </div>

          <div className="card card-pad" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Your Ratings</div>
            <div className="muted" style={{ marginTop: 8 }}>
              {activity ? (
                (activity.ratings || []).length ? (
                  (activity.ratings || [])
                    .slice(-8)
                    .reverse()
                    .map((r: any, i: number) => {
                      const b = catalogMap.get(String(r.bookId));
                      return (
                        <div key={i} className="activity-row">
                          <Link
                            to={`/books/${r.bookId}`}
                            style={{ fontWeight: 600, color: "var(--ink)", display: "block" }}
                          >
                            {b ? b.title : `Edition #${String(r.bookId).slice(-6)}`}
                          </Link>
                          <div className="muted tabular-nums" style={{ fontSize: 12 }}>
                            Rated {r.rating} / 5 ★ ·{" "}
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Saved"}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div style={{ padding: "12px 0" }}>No ratings submitted yet.</div>
                )
              ) : (
                <Skeleton style={{ height: 160 }} />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
