import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Book, type RecommendationDebug } from "../lib/api";
import { BookCard } from "../components/BookCard";
import { Skeleton } from "../components/Skeleton";

const quickPrompts = [
  "Fast-paced sci-fi survival with deep science & friendship",
  "Cozy philosophical fable about purpose and following dreams",
  "Gripping investigative mystery with dark family secrets",
  "Practical habits, human psychology, and craft mastery"
];

export default function RecommendationsPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = React.useState<Book[]>([]);
  const [items, setItems] = React.useState<Book[] | null>(null);
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());
  const [debug, setDebug] = React.useState<RecommendationDebug>();
  const [curatorNote, setCuratorNote] = React.useState("");
  const [seed, setSeed] = React.useState(() => searchParams.get("seed") || "");
  const [interest, setInterest] = React.useState("");
  const [mood, setMood] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    api
      .listBooks({ page: 1, limit: 40 })
      .then((res) => setCatalog(res.items))
      .catch(() => {});
    api
      .activity()
      .then(({ activity }) =>
        setSavedIds(new Set((activity.bookmarks || []).map((b: any) => String(b.bookId))))
      )
      .catch(() => {});
  }, []);

  const loadRecommendations = React.useCallback(
    async (overrides?: { seed?: string; interest?: string; mood?: string; genre?: string }) => {
      const activeSeed = overrides?.seed !== undefined ? overrides.seed : seed;
      const activeInterest = overrides?.interest !== undefined ? overrides.interest : interest;
      const activeMood = overrides?.mood !== undefined ? overrides.mood : mood;
      const activeGenre = overrides?.genre !== undefined ? overrides.genre : genre;

      setLoading(true);
      setErr("");
      try {
        const res = await api.recommendations({
          seedBookId: activeSeed || undefined,
          interest: activeInterest.trim() || undefined,
          mood: activeMood || undefined,
          genre: activeGenre || undefined
        });
        setItems(res.items);
        setCuratorNote(res.curatorNote || res.debug?.curatorNote || "");
        setDebug({
          ...res.debug,
          generatedAt: new Date().toLocaleTimeString()
        });
      } catch (e: any) {
        setErr(e?.message || "Failed to generate AI recommendations.");
      } finally {
        setLoading(false);
      }
    },
    [seed, interest, mood, genre]
  );

  React.useEffect(() => {
    loadRecommendations();
  }, []);

  function resetSignals() {
    setSeed("");
    setInterest("");
    setMood("");
    setGenre("");
    loadRecommendations({ seed: "", interest: "", mood: "", genre: "" });
  }

  const personalized = Boolean(
    debug?.personalized ||
      debug?.ratings_events ||
      debug?.purchase_events ||
      debug?.search_events ||
      debug?.bookmark_events ||
      interest ||
      seed ||
      mood ||
      genre
  );

  return (
    <main style={{ padding: "36px 0" }}>
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <span className="eyebrow">AI LITERARY CURATOR STUDIO</span>
          <h1 style={{ font: '700 42px "Libre Baskerville",serif', margin: "10px 0 6px" }}>
            Made for your next chapter.
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Our real-time AI engine synthesizes your saved bookmarks, ratings, searches, and mood into a bespoke reading shortlist.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => loadRecommendations()}
          disabled={loading}
        >
          {loading ? "Curating with AI…" : "Regenerate AI Shortlist"}
        </button>
      </div>

      <section className="card card-pad" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "end" }}>
          <label style={{ flex: "1 1 250px" }}>
            <span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
              Anchor to a specific book (optional)
            </span>
            <select
              className="input"
              value={seed}
              onChange={(e) => {
                const val = e.target.value;
                setSeed(val);
                loadRecommendations({ seed: val });
              }}
            >
              <option value="">Blend all my bookmarks & activity</option>
              {catalog.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.title} — {b.author}
                </option>
              ))}
            </select>
          </label>

          <label style={{ flex: "2 1 320px" }}>
            <span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
              Describe what you’re in the mood to read
            </span>
            <input
              className="input"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  loadRecommendations();
                }
              }}
              placeholder="e.g., A cerebral sci-fi mystery or reflective nature memoir…"
            />
          </label>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => loadRecommendations()}
            disabled={loading}
          >
            Curate Shelf
          </button>
          <button
            type="button"
            className="btn"
            onClick={resetSignals}
            disabled={loading}
          >
            Reset
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <span className="muted" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Try an AI prompt or filter by mood & genre:
          </span>
          <div className="filter-bar">
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                className={interest === p ? "btn btn-primary" : "btn"}
                style={{ fontSize: 12, padding: "6px 11px" }}
                onClick={() => {
                  setInterest(p);
                  loadRecommendations({ interest: p });
                }}
              >
                “{p}”
              </button>
            ))}
          </div>
          <div className="filter-bar" style={{ marginTop: 10 }}>
            {["Adventure", "Emotional", "Exciting", "Cozy", "Thought-provoking"].map((item) => (
              <button
                key={item}
                type="button"
                className={mood === item ? "btn btn-primary" : "btn"}
                onClick={() => {
                  const next = mood === item ? "" : item;
                  setMood(next);
                  loadRecommendations({ mood: next });
                }}
              >
                Mood: {item}
              </button>
            ))}
            {["Fantasy", "Science Fiction", "Mystery", "Technology", "Nonfiction"].map((item) => (
              <button
                key={item}
                type="button"
                className={genre === item ? "btn btn-primary" : "btn"}
                onClick={() => {
                  const next = genre === item ? "" : item;
                  setGenre(next);
                  loadRecommendations({ genre: next });
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {curatorNote ? (
        <div className="curator-insight-box" style={{ marginBottom: 24 }}>
          <span className="eyebrow">AI CURATOR SYNTHESIS</span>
          <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.6 }}>{curatorNote}</p>
        </div>
      ) : null}

      <div className="two-col">
        <section>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Your Personalized Shortlist</h2>
            <span className="muted tabular-nums" style={{ fontSize: 13 }}>
              {items?.length ?? 0} curated editions
            </span>
          </div>
          {err ? <div className="error">{err}</div> : null}
          <div className="grid">
            {loading || !items ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ gridColumn: "span 6" }}>
                  <Skeleton style={{ height: 210 }} />
                </div>
              ))
            ) : items.length ? (
              items.map((b) => (
                <BookCard
                  key={b._id}
                  book={b}
                  saved={savedIds.has(b._id)}
                  onSaved={(val) => {
                    setSavedIds((prev) => {
                      const next = new Set(prev);
                      val ? next.add(b._id) : next.delete(b._id);
                      return next;
                    });
                  }}
                  reason={
                    b.matchReason ||
                    (interest
                      ? `Matches “${interest}”`
                      : mood
                      ? `Fits your ${mood.toLowerCase()} reading mood`
                      : genre
                      ? `Selected from ${genre}`
                      : seed
                      ? "Shares narrative DNA with your anchor book"
                      : personalized
                      ? "Aligned with your saved bookmarks & reading signals"
                      : "Standout reader consensus")
                  }
                />
              ))
            ) : (
              <div className="card card-pad" style={{ gridColumn: "span 12" }}>
                <b>Your shelf is still learning.</b>
                <p className="muted">
                  Bookmark, rate, or search for a book to unlock deeper personal signals.
                </p>
                <button className="btn btn-primary" onClick={() => nav("/")}>
                  Browse the Open Shelf
                </button>
              </div>
            )}
          </div>
        </section>

        <aside>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Signal Profile</h2>
          </div>
          <div className="status-card">
            <div className="status-row">
              <span>Engine</span>
              <b>
                {debug?.source === "gemini-ai"
                  ? "Gemini AI Curator"
                  : debug?.source === "hybrid-scoring"
                  ? "Hybrid Affinity Engine"
                  : debug
                  ? "Hybrid ML"
                  : "Analyzing…"}
              </b>
            </div>
            <div className="status-row">
              <span>Personalization</span>
              <b>{personalized ? "Active" : "Awaiting signals"}</b>
            </div>
            <div className="status-row tabular-nums">
              <span>Bookmarked Books</span>
              <b>{debug?.bookmark_events ?? savedIds.size} saved</b>
            </div>
            <div className="status-row tabular-nums">
              <span>Ratings & Reviews</span>
              <b>{debug?.ratings_events ?? 0} rated</b>
            </div>
            <div className="status-row tabular-nums">
              <span>Search Queries</span>
              <b>{debug?.search_events ?? 0} tracked</b>
            </div>
            <div className="status-row">
              <span>Active Filter</span>
              <b>{debug?.filter || "All shelves"}</b>
            </div>
            <div className="status-row tabular-nums">
              <span>Catalog Scanned</span>
              <b>{debug?.books_in_catalog ?? catalog.length} editions</b>
            </div>
            <div className="status-row tabular-nums">
              <span>Updated</span>
              <b>{debug?.generatedAt ?? "Just now"}</b>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
