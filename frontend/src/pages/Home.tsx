import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Book } from "../lib/api";
import { BookCard } from "../components/BookCard";
import { Skeleton } from "../components/Skeleton";
import { SearchBar } from "../components/SearchBar";
import { useAuth } from "../contexts/AuthContext";
import { CHAT_ENABLED } from "../lib/config";
import { Chatbot } from "../components/Chatbot";

const genres = ["All shelves", "Fiction", "Science Fiction", "Fantasy", "Technology", "Nonfiction", "Mystery", "Romance"];
const moods = ["Any mood", "Adventure", "Emotional", "Exciting", "Cozy", "Thought-provoking"];
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
  const [recommendationError, setRecommendationError] = React.useState("");
  const [searchParams] = useSearchParams();

  const load = React.useCallback(() => {
    let alive = true;
    const list = mode === "Saved" ? api.savedBooks() : api.listBooks({ page: 1, limit: 18, genre, mood: mood === "Any mood" ? undefined : mood, mode: mode === "For you" ? "trending" : mode.toLowerCase() });
    Promise.all([list, api.trending()])
      .then(([result, trend]) => alive && (setBooks(result.items), setTotal(result.total ?? result.items.length), setTrending(trend.items)))
      .catch((e: any) => alive && setErr(e?.message || "We couldn't load the shelves."));
    return () => { alive = false; };
  }, [genre, mood, mode]);

  React.useEffect(() => load(), [load]);
  React.useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    api.activity().then(({ activity }) => setSavedIds(new Set((activity.bookmarks || []).map((b: any) => String(b.bookId))))).catch(() => {});
  }, [user]);
  React.useEffect(() => {
    if (!user) { setRecommendations(null); return; }
    setRecommendationError("");
    api.recommendations().then((res) => setRecommendations(res.items.slice(0, 4))).catch((e: any) => setRecommendationError(e?.message || "Recommendations are taking a moment."));
  }, [user]);

  async function handleSearch(q: string) {
    setErr("");
    setQuery(q.trim());
    try {
      const res = await api.listBooks({ q, page: 1, limit: 18, genre, mood: mood === "Any mood" ? undefined : mood });
      setBooks(res.items); setTotal(res.total);
      if (user) api.trackSearch({ query: q }).catch(() => {});
    } catch (e: any) { setErr(e?.message || "Search failed."); }
  }
  React.useEffect(() => {
    const requested = searchParams.get("q");
    if (requested && requested !== query) handleSearch(requested);
  }, [searchParams]);

  const normalizedQuery = query.toLowerCase();
  const visible = books?.filter((book) => {
    if (!normalizedQuery) return true;
    const text = [
      book.title,
      book.author,
      ...(book.genre || []),
      ...(book.keywords || []),
      book.description || ""
    ].join(" ").toLowerCase();
    return text.includes(normalizedQuery);
  });
  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow">BOOKREC / THE OPEN SHELF</span>
          <h1>Find a story that meets you where you are.</h1>
          <p>Search a living shelf of curious books, tune the mood, and let BookRec connect your taste with the right next chapter.</p>
          <SearchBar onSearch={handleSearch} onPick={(id) => nav(`/books/${id}`)} />
          <div className="filter-bar" style={{ marginTop: 16 }}>
            {genres.map((item) => <button key={item} className={genre === item ? "btn btn-primary" : "btn"} onClick={() => setGenre(item)}>{item}</button>)}
          </div>
          <div className="filter-bar">
            {moods.map((item) => <button key={item} className={mood === item ? "btn btn-primary" : "btn"} onClick={() => setMood(item)}>{item}</button>)}
          </div>
          {err ? <div className="error"><b>Something went wrong.</b> {err}</div> : null}
        </div>
        <div className="hero-art" aria-label="A rotating selection of book covers from the catalogue">
          {(trending || books || []).slice(0, 4).map((book, index) => (
            <button
              className={`hero-book hero-book-${index + 1}`}
              key={book._id}
              onClick={() => nav(`/books/${book._id}`)}
              aria-label={`Open ${book.title} by ${book.author}`}
            >
              <div className="hero-book-cover">
                {book.coverImageUrl ? <img src={book.coverImageUrl} alt="" /> : <span>{book.title.slice(0, 1)}</span>}
              </div>
              <span className="hero-book-label">{book.title}</span>
            </button>
          ))}
          <div className="hero-note"><span className="hero-note-dot" /> Curated for your mood</div>
        </div>
      </section>

      <section className="recommendation-band">
        <div className="section-head"><div><span className="eyebrow">A QUIETLY PERSONAL SHELF</span><h2>Recommended for you</h2></div><button className="btn btn-primary" onClick={() => nav(user ? "/recommendations" : "/auth")}>{user ? "Tune your recommendations" : "Sign in to personalize"}</button></div>
        {!user ? <div className="recommendation-empty"><b>Your next chapter should feel like yours.</b><span>Sign in to let your searches, saves, and ratings shape this shelf.</span></div> :
          recommendationError ? <div className="error">{recommendationError}</div> :
          !recommendations ? <div className="recommendation-loading">{[1, 2, 3, 4].map((n) => <Skeleton key={n} style={{ height: 210 }} />)}</div> :
          recommendations.length ? <div className="recommendation-grid">{recommendations.map((book) => <BookCard key={book._id} book={book} saved={savedIds.has(book._id)} onSaved={(value) => setSavedIds((previous) => { const next = new Set(previous); value ? next.add(book._id) : next.delete(book._id); return next; })} />)}</div> :
          <div className="recommendation-empty"><b>Your shelf is still learning.</b><span>Save or rate a few books and we’ll bring something considered back here.</span></div>}
      </section>

      <div className="two-col">
        <section>
          <div className="section-head"><h2>{mode} · {genre === "All shelves" ? "The open shelf" : genre}</h2><span className="pill">{query ? `${visible?.length ?? 0} matches` : `${total} results`} · {user ? "signals on" : "sign in to personalize"}</span></div>
          <div className="filter-bar shelf-modes">{modes.map((item) => <button key={item} className={mode === item ? "btn btn-primary" : "btn"} onClick={() => { if (item === "Saved" && !user) { nav("/auth"); return; } setErr(""); setMode(item); }}>{item}</button>)}{(genre !== "All shelves" || mood !== "Any mood" || mode !== "Latest") ? <button className="btn" onClick={() => { setGenre("All shelves"); setMood("Any mood"); setMode("Latest"); }}>Clear filters</button> : null}</div>
          <div className="grid">
            {!visible ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ gridColumn: "span 6" }}><Skeleton style={{ height: 190 }} /></div>) :
              visible.length ? visible.map((b) => <BookCard key={b._id} book={b} saved={savedIds.has(b._id)} onSaved={(value) => setSavedIds((previous) => { const next = new Set(previous); value ? next.add(b._id) : next.delete(b._id); return next; })} />) :
                <div className="card card-pad" style={{ gridColumn: "span 12" }}><b>No books on this shelf yet.</b><p className="muted">Try another genre or search the catalogue.</p></div>}
          </div>
        </section>
        <aside>
          <div className="section-head"><h2>Trending now</h2><span className="pill">reader signal</span></div>
          <div style={{ display: "grid", gap: 10 }}>
            {!trending ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 78 }} />) :
              trending.slice(0, 6).map((b) => <button key={b._id} className="card card-pad" style={{ textAlign: "left", display: "flex", gap: 12, alignItems: "center", cursor: "pointer", color: "var(--ink)" }} onClick={() => nav(`/books/${b._id}`)}>
                <div className="cover" style={{ width: 46, height: 68, flexShrink: 0 }}>{b.coverImageUrl ? <img src={b.coverImageUrl} alt="" /> : null}</div>
                <span><b>{b.title}</b><small className="muted" style={{ display: "block", marginTop: 4 }}>{b.author} · {b.ratingsAvg?.toFixed?.(1) ?? "0.0"} / 5</small></span>
              </button>)}
          </div>
          {CHAT_ENABLED ? <div style={{ marginTop: 24 }}><Chatbot onPick={(id) => nav(`/books/${id}`)} /></div> : null}
        </aside>
      </div>
    </main>
  );
}
