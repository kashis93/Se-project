import React from "react";
import { api } from "../lib/api";

type Item = { _id: string; title: string; author: string; coverImageUrl: string; ratingsAvg: number };

export function SearchBar({
  onSearch,
  onPick,
  compact = false
}: {
  onSearch: (q: string) => void;
  onPick: (id: string) => void;
  compact?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.autocomplete(q.trim());
        setItems(res.items as any);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    onSearch(query);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <form onSubmit={submit} className={compact ? "search-form search-form-compact" : "search-form"} style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          className="input"
          aria-label={compact ? "Search the catalogue from the navbar" : "Search books by title, author, genre"}
          placeholder={compact ? "Search the catalogue…" : "Search books by title, author, genre…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(items.length > 0)}
        />
        {q ? <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { setQ(""); setOpen(false); }}>×</button> : null}
        <button className="btn btn-primary search-submit" type="submit">
          Search
        </button>
      </form>

      {open ? (
        <div
          className="card"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginTop: 10,
            overflow: "hidden"
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
            {loading ? "Searching…" : "Suggestions"}
          </div>
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {items.length === 0 && !loading ? (
              <div style={{ padding: 12, color: "var(--muted)" }}>No matches</div>
            ) : null}
            {items.map((it) => (
              <button
                key={it._id}
                className="btn"
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 0,
                  textAlign: "left",
                  display: "flex",
                  gap: 10,
                  padding: 12,
                  background: "transparent",
                  borderBottom: "1px solid var(--border)"
                }}
                onClick={() => {
                  setOpen(false);
                  setQ(it.title);
                  onPick(it._id);
                }}
              >
                <div className="cover" style={{ width: 42, height: 58, borderRadius: 10 }}>
                  {it.coverImageUrl ? <img src={it.coverImageUrl} alt={it.title} /> : null}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{it.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {it.author} • {it.ratingsAvg?.toFixed?.(1) ?? "0.0"}★
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
