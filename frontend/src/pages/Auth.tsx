import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Toast, type ToastState } from "../components/Toast";

export default function AuthPage() {
  const nav = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [toast, setToast] = React.useState<ToastState>(null);
  const [loading, setLoading] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("demo@demo.com");
  const [password, setPassword] = React.useState("Password123!");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        setToast({ title: "Welcome back", message: "Login successful" });
      } else {
        await register(name.trim(), email.trim(), password);
        setToast({ title: "Account created", message: "You are logged in" });
      }
      setTimeout(() => nav("/dashboard"), 300);
    } catch (err: any) {
      setToast({ title: "Auth failed", message: err?.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="grid">
        <div className="card card-pad" style={{ gridColumn: "span 7" }}>
          <span className="eyebrow">WELCOME BACK TO THE SHELF</span>
          <h1 style={{ font: '700 38px "Libre Baskerville",serif', margin: "12px 0 8px" }}>{mode === "login" ? "Return to your reading room." : "Make the shelf yours."}</h1>
          <div className="muted">
            Use the demo account from the README or register a new user.
          </div>
          <form onSubmit={submit} style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {mode === "register" ? (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Name
                </div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            ) : null}
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Email
              </div>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Password
              </div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 chars"
                type="password"
              />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Please wait…" : mode === "login" ? "Login" : "Register"}
              </button>
              <button className="btn" type="button" onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}>
                Switch to {mode === "login" ? "Register" : "Login"}
              </button>
            </div>
          </form>
        </div>

        <div className="card card-pad" style={{ gridColumn: "span 5" }}>
          <h3 style={{ marginTop: 0 }}>What gets personalized?</h3>
          <div className="muted">
            Once logged in, the system tracks:
            <ul>
              <li>Search history</li>
              <li>Purchase simulation</li>
              <li>Ratings & reviews</li>
            </ul>
            and uses the ML service to generate hybrid recommendations.
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
