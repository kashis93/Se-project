import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Book, type RecommendationDebug } from "../lib/api";
import { BookCard } from "../components/BookCard";
import { Skeleton } from "../components/Skeleton";

export default function RecommendationsPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = React.useState<Book[]>([]);
  const [items, setItems] = React.useState<Book[] | null>(null);
  const [debug, setDebug] = React.useState<RecommendationDebug>();
  const [seed, setSeed] = React.useState(() => searchParams.get("seed") || "");
  const [interest, setInterest] = React.useState("");
  const [mood, setMood] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { api.listBooks({ page: 1, limit: 40 }).then((res) => setCatalog(res.items)).catch(() => {}); }, []);
  async function loadRecommendations() {
    setLoading(true); setErr("");
    try {
      const res = await api.recommendations({ seedBookId: seed || undefined, interest: interest.trim() || undefined, mood: mood || undefined, genre: genre || undefined });
      setItems(res.items); setDebug({ ...res.debug, generatedAt: new Date().toLocaleTimeString() });
    } catch (e: any) { setErr(e?.message || "Failed to fetch recommendations."); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { loadRecommendations(); }, []);

  function resetSignals() { setSeed(""); setInterest(""); setMood(""); setGenre(""); setTimeout(loadRecommendations, 0); }

  const personalized = Boolean(debug?.personalized || debug?.ratings_events || debug?.purchase_events || debug?.search_events || debug?.bookmark_events || interest || seed || mood || genre);
  return <main style={{ padding: "42px 0" }}>
    <div className="section-head"><div><span className="pill">A considered shortlist</span><h1 style={{ font: '700 42px "Libre Baskerville",serif', margin: "14px 0 6px" }}>Made for your next chapter.</h1><p className="muted">Tune the signal, then see exactly what shaped the shelf.</p></div><button className="btn btn-primary" onClick={loadRecommendations} disabled={loading}>{loading ? "Thinking…" : "Refresh shelf"}</button></div>
    <section className="card card-pad" style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <label style={{ flex: "1 1 260px" }}><span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Start from a book (optional)</span><select className="input" value={seed} onChange={(e) => setSeed(e.target.value)}><option value="">Use my activity</option>{catalog.map((b) => <option key={b._id} value={b._id}>{b.title} — {b.author}</option>)}</select></label>
        <label style={{ flex: "1 1 220px" }}><span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Or name a reading mood</span><input className="input" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="quiet, ambitious, strange…" /></label>
        <button className="btn" onClick={loadRecommendations} disabled={loading}>Apply signal</button>
        <button className="btn" onClick={resetSignals} disabled={loading}>Reset</button>
      </div>
      <div className="filter-bar" style={{ marginTop: 14 }}>
        {["Adventure", "Emotional", "Cozy", "Thought-provoking"].map((item) => <button key={item} className={mood === item ? "btn btn-primary" : "btn"} onClick={() => setMood(mood === item ? "" : item)}>{item}</button>)}
        {["Fantasy", "Mystery", "Technology", "Nonfiction"].map((item) => <button key={item} className={genre === item ? "btn btn-primary" : "btn"} onClick={() => setGenre(genre === item ? "" : item)}>{item}</button>)}
      </div>
    </section>
    <div className="two-col">
      <section><div className="section-head" style={{ marginTop: 0 }}><h2>Your shortlist</h2><span className="pill">{items?.length ?? 0} titles</span></div>{err ? <div className="error">{err}</div> : null}<div className="grid">{loading || !items ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ gridColumn: "span 6" }}><Skeleton style={{ height: 190 }} /></div>) : items.length ? items.map((b) => <BookCard key={b._id} book={b} reason={interest ? `matches “${interest}”` : mood ? `fits the ${mood.toLowerCase()} mood` : genre ? `filtered to ${genre}` : seed ? "shares signals with your starting book" : personalized ? "matches your saved, search, purchase, or rating activity" : "popular with confident ratings"} />) : <div className="card card-pad" style={{ gridColumn: "span 12" }}><b>Your shelf is still learning.</b><p className="muted">Search, rate, or purchase a book to unlock more personal signals.</p><button className="btn btn-primary" onClick={() => nav("/")}>Browse the open shelf</button></div>}</div></section>
      <aside><div className="section-head" style={{ marginTop: 0 }}><h2>Recommendation health</h2></div><div className="status-card"><div className="status-row"><span>Source</span><b>{debug?.source === "fallback" ? "Local fallback" : debug ? "Hybrid ML" : "Waiting"}</b></div>      <div className="status-row"><span>Personalization</span><b>{personalized ? "Active" : "Needs a signal"}</b></div><div className="status-row"><span>Signals</span><b>{[debug?.search_events && "searches", debug?.bookmark_events && "saved", debug?.purchase_events && "purchases", debug?.ratings_events && "ratings", mood && `mood:${mood}`, genre && `genre:${genre}`].filter(Boolean).join(" · ") || "popular + latest"}</b></div><div className="status-row"><span>Filter</span><b>{debug?.filter || "all shelves"}</b></div><div className="status-row"><span>Catalog scanned</span><b>{debug?.books_in_catalog ?? "—"} books</b></div><div className="status-row"><span>Excluded</span><b>{debug?.excluded ?? 0}{debug?.relaxed_exclusions ? " · shelf relaxed" : " seen books"}</b></div><div className="status-row"><span>Generated</span><b>{debug?.generatedAt ?? "—"}</b></div>{debug?.reason ? <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{debug.reason}</p> : null}</div><p className="muted" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 14 }}>BookRec blends content similarity, rating confidence, saved books, purchases, searches, and your mood. If the optional ML service is offline, the shelf stays useful with a transparent deterministic fallback.</p></aside>
    </div>
  </main>;
}
