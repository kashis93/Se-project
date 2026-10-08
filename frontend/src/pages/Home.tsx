import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Book } from "../lib/api";
import { BookCard } from "../components/BookCard";
import { Skeleton } from "../components/Skeleton";
import { SearchBar } from "../components/SearchBar";
import { useAuth } from "../contexts/AuthContext";
import { CHAT_ENABLED } from "../lib/config";
import { Chatbot } from "../components/Chatbot";
import { MoodCarousel3D, BookCoverImage } from "../components/MoodCarousel3D";
import { Toast, type ToastState } from "../components/Toast";

const genres = ["All shelves", "Fiction", "Science Fiction", "Fantasy", "Technology", "Nonfiction", "Mystery", "Romance"];
const modes = ["Latest", "Trending", "For you", "Saved"];

export default function HomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [books, setBooks] = React.useState<Book[] | null>(null);
  const [trending, setTrending] = React.useState<Book[] | null>(null);
  const [err, setErr] = React.useState("");
  const [genre, setGenre] = React.useState("All shelves");
  const [mood, setMood] = React.useState("Any mood");
  const [mode, setMode] = React.useState("Latest");
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());
  const [total, setTotal] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [recommendations, setRecommendations] = React.useState<Book[] | null>(null);
  const [curatorNote, setCuratorNote] = React.useState("");
  const [recommendationError, setRecommendationError] = React.useState("");
  const [toast, setToast] = React.useState<ToastState>(null);
  const [searchParams] = useSearchParams();

  const load = React.useCallback(() => {
    let alive = true;
    const list =
      mode === "Saved"
        ? api.savedBooks()
        : api.listBooks({
            page: 1,
            limit: 36,
            genre,
            mood: mood === "Any mood" ? undefined : mood,
            mode: mode === "For you" ? "trending" : mode.toLowerCase()
          });
    Promise.all([list, api.trending()])
      .then(([result, trend]) => {
        if (!alive) return;
        setBooks(result.items);
        setTotal(result.total ?? result.items.length);
        setTrending(trend.items);
      })
      .catch((e: any) => alive && setErr(e?.message || "We couldn’t load the shelves."));
    return () => {
      alive = false;
    };
  }, [genre, mood, mode]);

  React.useEffect(() => load(), [load]);

  const syncSaved = React.useCallback(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    api
      .activity()
      .then(({ activity }) =>
        setSavedIds(new Set((activity.bookmarks || []).map((b: any) => String(b.bookId))))
      )
      .catch(() => {});
  }, [user]);

  React.useEffect(() => {
    syncSaved();
    const handler = () => syncSaved();
    window.addEventListener("bookrec:bookmarks-changed", handler);
    return () => window.removeEventListener("bookrec:bookmarks-changed", handler);
  }, [syncSaved]);

  const loadRecs = React.useCallback(() => {
    if (!user) {
      setRecommendations(null);
      return;
    }
    setRecommendationError("");
    api
      .recommendations({ mood: mood === "Any mood" ? undefined : mood })
      .then((res) => {
        setRecommendations(res.items.slice(0, 6));
        setCuratorNote(res.curatorNote || res.debug?.curatorNote || "");
      })
      .catch((e: any) =>
        setRecommendationError(e?.message || "Recommendations are taking a moment.")
      );
  }, [user, mood]);

  React.useEffect(() => {
    loadRecs();
  }, [loadRecs]);

  async function handleSearch(q: string) {
    setErr("");
    setQuery(q.trim());
    try {
      const res = await api.listBooks({
        q,
        page: 1,
        limit: 36,
        genre,
        mood: mood === "Any mood" ? undefined : mood
      });
      setBooks(res.items);
      setTotal(res.total);
      if (user) api.trackSearch({ query: q }).catch(() => {});
    } catch (e: any) {
      setErr(e?.message || "Search failed.");
    }
  }

  React.useEffect(() => {
    const requested = searchParams.get("q");
    if (requested && requested !== query) handleSearch(requested);
  }, [searchParams]);

  async function toggleHeroBookmark(bookId: string) {
    if (!user) {
      nav("/auth");
      return;
    }
    try {
      const res = await api.bookmark(bookId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (res.saved) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
      window.dispatchEvent(new CustomEvent("bookrec:bookmarks-changed"));
      setToast({
        title: res.saved ? "Saved to your bookmarks" : "Removed from bookmarks",
        message: "Your AI recommendations have been updated."
      });
      loadRecs();
    } catch (e: any) {
      setToast({ title: "Could not save bookmark", message: e?.message || "Try again" });
    }
  }

  const normalizedQuery = query.toLowerCase();
  const visible = books?.filter((book) => {
    if (!normalizedQuery) return true;
    const text = [
      book.title,
      book.author,
      ...(book.genre || []),
      ...(book.keywords || []),
      book.description || ""
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(normalizedQuery);
  });

  const carouselBooks = React.useMemo(() => {
    const source = visible?.length ? visible : trending?.length ? trending : books || [];
    if (mood === "Any mood") return (trending?.length ? trending : source).slice(0, 9);
    const moodLower = mood.toLowerCase();
    const matching = source.filter((b) =>
      `${b.title} ${(b.genre || []).join(" ")} ${(b.keywords || []).join(" ")} ${b.description || ""}`
        .toLowerCase()
        .includes(moodLower)
    );
    return (matching.length >= 3 ? matching : source).slice(0, 9);
  }, [visible, trending, books, mood]);

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <h1>Find a story that meets you where you are.</h1>
          <p>
            Browse an editorial collection of acclaimed books, filter by mood, save editions to your personal shelf, and discover tailored AI recommendations.
          </p>
          <SearchBar onSearch={handleSearch} onPick={(id) => nav(`/books/${id}`)} />

          <div className="filter-bar" style={{ marginTop: 18 }}>
            {genres.map((item) => (
              <button
                key={item}
                type="button"
                className={genre === item ? "btn btn-primary" : "btn"}
                onClick={() => setGenre(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {err ? (
            <div className="error">
              <b>Something went wrong.</b> {err}
            </div>
          ) : null}
        </div>

        <MoodCarousel3D
          books={carouselBooks}
          activeMood={mood}
          onSelectMood={(m) => setMood(m)}
          onOpenBook={(id) => nav(`/books/${id}`)}
          savedIds={savedIds}
          onToggleSave={toggleHeroBookmark}
        />
      </section>

      <section className="recommendation-band">
        <div className="section-head">
          <div>
            <h2>Recommended for You</h2>
            {curatorNote && user ? (
              <p className="curator-note-banner">{curatorNote}</p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {user ? (
              <button
                type="button"
                className="btn"
                onClick={() => nav("/dashboard?section=bookmarks")}
              >
                Saved Bookmarks ({savedIds.size})
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => nav(user ? "/recommendations" : "/auth")}
            >
              {user ? "Tune AI Curator" : "Sign in to personalize"}
            </button>
          </div>
        </div>
        {!user ? (
          <div className="recommendation-empty">
            <div>
              <b>Your next chapter should feel unmistakably yours.</b>
              <div style={{ marginTop: 4 }}>
                Sign in (demo: <code>demo@demo.com</code> / <code>Password123!</code>) to unlock personalized AI recommendations shaped by your bookmarks, searches, and ratings.
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => nav("/auth")}>
              Sign in now
            </button>
          </div>
        ) : recommendationError ? (
          <div className="error">{recommendationError}</div>
        ) : !recommendations ? (
          <div className="recommendation-loading">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} style={{ height: 340 }} />
            ))}
          </div>
        ) : recommendations.length ? (
          <div className="grid">
            {recommendations.slice(0, 3).map((book) => (
              <BookCard
                key={book._id}
                book={book}
                saved={savedIds.has(book._id)}
                onSaved={(value) => {
                  setSavedIds((previous) => {
                    const next = new Set(previous);
                    value ? next.add(book._id) : next.delete(book._id);
                    return next;
                  });
                  loadRecs();
                }}
              />
            ))}
          </div>
        ) : (
          <div className="recommendation-empty">
            <b>Your shelf is still learning.</b>
            <span>Save or rate a few books and we’ll bring something considered back here.</span>
          </div>
        )}
      </section>

      <div className="two-col" style={{ marginTop: 42 }}>
        <section>
          <div className="section-head" style={{ marginTop: 0 }}>
            <div>
              <h2>
                {mode} · {genre === "All shelves" ? "The Open Shelf" : genre}
              </h2>
            </div>
            <div className="catalog-summary tabular-nums">
              {query ? `${visible?.length ?? 0} matches` : `${total} editions`} ·{" "}
              {user ? `${savedIds.size} saved` : "guest view"}
            </div>
          </div>

          <div className="filter-bar shelf-modes">
            {modes.map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? "btn btn-primary" : "btn"}
                onClick={() => {
                  if (item === "Saved" && !user) {
                    nav("/auth");
                    return;
                  }
                  setErr("");
                  setMode(item);
                }}
              >
                {item === "Saved" ? `Saved (${savedIds.size})` : item}
              </button>
            ))}
            {genre !== "All shelves" || mood !== "Any mood" || mode !== "Latest" || query ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setGenre("All shelves");
                  setMood("Any mood");
                  setMode("Latest");
                  setQuery("");
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>

          <div className="grid">
            {!visible ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ gridColumn: "span 4" }}>
                  <Skeleton style={{ height: 360 }} />
                </div>
              ))
            ) : visible.length ? (
              visible.map((b) => (
                <BookCard
                  key={b._id}
                  book={b}
                  saved={savedIds.has(b._id)}
                  onSaved={(value) =>
                    setSavedIds((previous) => {
                      const next = new Set(previous);
                      value ? next.add(b._id) : next.delete(b._id);
                      return next;
                    })
                  }
                />
              ))
            ) : (
              <div className="card card-pad" style={{ gridColumn: "span 12" }}>
                <b>No books on this shelf yet.</b>
                <p className="muted">
                  {mode === "Saved"
                    ? "You haven't bookmarked any books yet. Tap '♡' on any book card to build your saved shelf."
                    : "Try another genre or clear active filters."}
                </p>
              </div>
            )}
          </div>
        </section>

        <aside>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Top Rated</h2>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {!trending
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 84 }} />)
              : trending.slice(0, 6).map((b, idx) => (
                  <button
                    key={b._id}
                    type="button"
                    className="card card-pad trending-row-btn"
                    onClick={() => nav(`/books/${b._id}`)}
                  >
                    <span className="trending-rank tabular-nums">0{idx + 1}</span>
                    <div className="cover" style={{ width: 52, height: 76, flexShrink: 0 }}>
                      <BookCoverImage book={b} />
                    </div>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14 }}>
                        {b.title}
                      </b>
                      <small className="muted tabular-nums" style={{ display: "block", marginTop: 4 }}>
                        {b.author} · {b.ratingsAvg?.toFixed?.(1) ?? "0.0"} ★
                      </small>
                    </span>
                  </button>
                ))}
          </div>
          {CHAT_ENABLED ? (
            <div style={{ marginTop: 24 }}>
              <Chatbot onPick={(id) => nav(`/books/${id}`)} />
            </div>
          ) : null}
        </aside>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
