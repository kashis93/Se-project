import React from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { getTheme, setTheme, type Theme } from "./lib/storage";
import HomePage from "./pages/Home";
import AuthPage from "./pages/Auth";
import DashboardPage from "./pages/Dashboard";
import BookDetailsPage from "./pages/BookDetails";
import RecommendationsPage from "./pages/Recommendations";
import { SearchBar } from "./components/SearchBar";
import { api } from "./lib/api";

function Shell() {
  const nav = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [savedCount, setSavedCount] = React.useState<number | null>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const profileTriggerRef = React.useRef<HTMLButtonElement>(null);

  const [theme, setThemeState] = React.useState<Theme>(getTheme());
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    setTheme(theme);
  }, [theme]);
  React.useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);
  React.useEffect(() => {
    if (!user) { setSavedCount(null); return; }
    api.activity().then(({ activity }) => setSavedCount(activity.bookmarks?.length ?? 0)).catch(() => {});
  }, [user]);
  React.useEffect(() => {
    function close(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileTriggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link className="brand" to="/">
            <span className="logo" />
            <span>BookRec</span>
          </Link>
          <div className="nav-search">
            <SearchBar compact onSearch={(q) => nav(`/?q=${encodeURIComponent(q)}`)} onPick={(id) => nav(`/books/${id}`)} />
          </div>
          <button className="mobile-menu-btn" aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen((open) => !open)}>Menu</button>
          <nav id="primary-navigation" className={`nav-links ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
            <Link className={`nav-link ${location.pathname === "/" ? "active" : ""}`} to="/">Browse</Link>
            <Link className={`nav-link ${location.pathname === "/dashboard" ? "active" : ""}`} to="/dashboard">My Library</Link>
            <Link className={`nav-link ${location.pathname === "/recommendations" ? "active" : ""}`} to="/recommendations">Recommendations</Link>
            <Link className="nav-icon-btn saved-nav" to="/dashboard?section=bookmarks" aria-label={`Open saved books${savedCount !== null ? `, ${savedCount} saved` : ""}`}>♡<span className="saved-count">{savedCount ?? 0}</span></Link>
            <button className="nav-icon-btn" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setThemeState((t) => (t === "dark" ? "light" : "dark"))}>{theme === "dark" ? "☼" : "☾"}</button>
            {loading ? null : user ? (
              <div className="profile-menu" ref={profileRef}>
                <button ref={profileTriggerRef} className="profile-trigger" aria-expanded={profileOpen} aria-controls="profile-dropdown" onClick={() => setProfileOpen((open) => !open)}>
                  <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="profile-name">{user.name}</span><span aria-hidden="true">⌄</span>
                </button>
                {profileOpen ? <div id="profile-dropdown" className="profile-dropdown">
                  <div className="profile-heading"><span className="eyebrow">SIGNED IN AS</span><b>{user.email}</b></div>
                  <Link to="/dashboard">Dashboard</Link>
                  <Link to="/dashboard?section=orders">My orders</Link>
                  <Link to="/dashboard?section=bookmarks">My bookmarks</Link>
                  <Link to="/recommendations">Recommendations</Link>
                  <button onClick={() => { logout(); nav("/"); }}>Logout</button>
                </div> : null}
              </div>
            ) : (
              <Link className="btn btn-primary" to="/auth">Login / Register</Link>
            )}
          </nav>
        </div>
      </header>

      <div className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/books/:id" element={<BookDetailsPage />} />
          <Route path="/recommendations" element={<RequireAuth><RecommendationsPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <div style={{ height: 28 }} />
    </>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 22 }} className="muted">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
