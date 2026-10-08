import React from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Skeleton } from "../components/Skeleton";
import { Toast, type ToastState } from "../components/Toast";

export default function DashboardPage() {
  const [toast, setToast] = React.useState<ToastState>(null);
  const [activity, setActivity] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string>("");
  const [saved, setSaved] = React.useState<any[] | null>(null);
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section");
  const active = section === "bookmarks" ? "saved" : section === "orders" ? "purchased" : "overview";

  React.useEffect(() => {
    Promise.all([api.activity(), api.savedBooks()])
      .then(([activityRes, savedRes]) => { setActivity(activityRes.activity); setSaved(savedRes.items); })
      .catch((e: any) => setErr(e?.message || "Failed to load activity"));
  }, []);

  return (
    <div style={{ padding: "22px 0" }}>
      <div className="section-head" style={{ marginTop: 12 }}>
        <div><span className="eyebrow">YOUR READING ROOM</span><h1 style={{ font: '700 42px "Libre Baskerville",serif', margin: "10px 0 4px" }}>{active === "purchased" ? "Your purchases" : active === "saved" ? "Your saved shelf" : "A record of your reading"}</h1><p className="muted">Keep the books and signals that shape your next chapter in one calm place.</p></div>
        <span className="pill">{saved?.length ?? "—"} saved books</span>
      </div>
      <div className="filter-bar shelf-modes" role="tablist" aria-label="Library sections">
        <a className={active === "overview" ? "btn btn-primary" : "btn"} href="/dashboard">Overview</a>
        <a className={active === "saved" ? "btn btn-primary" : "btn"} href="/dashboard?section=bookmarks">Saved</a>
        <a className={active === "purchased" ? "btn btn-primary" : "btn"} href="/dashboard?section=orders">Purchased</a>
        <span className="btn" aria-disabled="true">Rated</span>
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: "var(--danger)" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="card card-pad" style={{ gridColumn: "span 12" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><div style={{ fontWeight: 800 }}>Saved for later</div><div className="muted" style={{ marginTop: 4 }}>Bookmarks are active recommendation signals.</div></div><span className="pill">{saved?.length ?? "—"} books</span></div>
          {!saved ? <Skeleton style={{ height: 80, marginTop: 12 }} /> : saved.length ? <div className="saved-strip">{saved.slice(0, 6).map((book) => <a className="saved-book" key={book._id} href={`/books/${book._id}`}><div className="cover" style={{ width: 42, height: 62 }}>{book.coverImageUrl ? <img src={book.coverImageUrl} alt="" /> : null}</div><span><b>{book.title}</b><small className="muted">{book.author}</small></span></a>)}</div> : <div className="recommendation-empty"><b>Your saved shelf is waiting.</b><span>Browse the open shelf and tap Save on a title you want to remember.</span><a className="btn btn-primary" href="/">Browse books</a></div>}
        </div>
        <div className="card card-pad" style={{ gridColumn: "span 4" }}>
          <div style={{ fontWeight: 800 }}>Search history</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {activity ? (
              (activity.searches || []).slice(-8).reverse().map((s: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700 }}>{s.query}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {s.createdAt ? new Date(s.createdAt).toLocaleString() : ""}
                  </div>
                </div>
              ))
            ) : (
              <Skeleton style={{ height: 160 }} />
            )}
          </div>
        </div>

        <div className="card card-pad" style={{ gridColumn: "span 4" }}>
          <div style={{ fontWeight: 800 }}>Purchases (simulation)</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {activity ? (
              (activity.purchases || []).slice(-8).reverse().map((p: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700 }}>Book ID: {p.bookId}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Price: ${p.price ?? 9.99} {p.createdAt ? `• ${new Date(p.createdAt).toLocaleString()}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <Skeleton style={{ height: 160 }} />
            )}
          </div>
        </div>

        <div className="card card-pad" style={{ gridColumn: "span 4" }}>
          <div style={{ fontWeight: 800 }}>Ratings</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {activity ? (
              (activity.ratings || []).slice(-8).reverse().map((r: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700 }}>Book ID: {r.bookId}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Rating: {r.rating}★ {r.createdAt ? `• ${new Date(r.createdAt).toLocaleString()}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <Skeleton style={{ height: 160 }} />
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }} className="muted">
        Tip: go to any book details page to “purchase” or “rate & review” a book. Those signals will change your
        recommendations.
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
