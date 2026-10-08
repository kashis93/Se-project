import React from "react";
import { api, type Book } from "../lib/api";

export function Chatbot({ onPick }: { onPick: (bookId: string) => void }) {
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [reply, setReply] = React.useState<string>("");
  const [items, setItems] = React.useState<Book[]>([]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const m = message.trim();
    if (!m) return;
    setLoading(true);
    setReply("");
    setItems([]);
    try {
      const res = await api.chatSuggest(m);
      setReply(res.reply);
      setItems(res.items);
    } catch (err: any) {
      setReply(err?.message || "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Chatbot (bonus)</div>
        <div className="pill">Natural language → suggestions</div>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        Example: “I want a fast-paced sci‑fi adventure with politics and a desert planet”
      </div>

      <form onSubmit={send} style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask for a book…" />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Thinking…" : "Send"}
        </button>
      </form>

      {reply ? <div style={{ marginTop: 12, color: "var(--muted)" }}>{reply}</div> : null}

      {items.length ? (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {items.slice(0, 5).map((b) => (
            <button
              key={b._id}
              className="btn"
              style={{ textAlign: "left", padding: 12, display: "flex", gap: 10, alignItems: "center" }}
              onClick={() => onPick(b._id)}
            >
              <div className="cover" style={{ width: 44, height: 62, borderRadius: 12 }}>
                {b.coverImageUrl ? <img src={b.coverImageUrl} alt={b.title} /> : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{b.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {b.author}
                </div>
              </div>
              <span className="pill">Open</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

