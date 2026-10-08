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
import { api, type Book } from "./lib/api";
import { BookCoverImage } from "./components/MoodCarousel3D";

function Shell() {
  const nav = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = React.useState(false);
  const [savedBooks, setSavedBooks] = React.useState<Book[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = React.useState(false);

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
  }, [location.pathname, location.search]);

  const refreshSavedBooks = React.useCallback(() => {
    if (!user) {
      setSavedBooks([]);
      return;
    }
    setLoadingBookmarks(true);
    api
      .savedBooks()
      .then((res) => setSavedBooks(res.items || []))
      .catch(() => {})
      .finally(() => setLoadingBookmarks(false));
  }, [user]);

  React.useEffect(() => {
    refreshSavedBooks();
  }, [refreshSavedBooks, location.pathname]);

  React.useEffect(() => {
    const onChanged = () => refreshSavedBooks();
    window.addEventListener("bookrec:bookmarks-changed", onChanged);
    return () => window.removeEventListener("bookrec:bookmarks-changed", onChanged);
  }, [refreshSavedBooks]);

  React.useEffect(() => {
    function close(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setBookmarksDrawerOpen(false);
        profileTriggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleRemoveBookmark(bookId: string) {
    try {
      await api.bookmark(bookId);
      setSavedBooks((prev) => prev.filter((b) => b._id !== bookId));
      window.dispatchEvent(new CustomEvent("bookrec:bookmarks-changed"));
    } catch {
      // ignore
    }
  }

  const isBookmarksActive =
    location.pathname === "/dashboard" && location.search.includes("section=bookmarks");

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          {/* Zone 1: Brand wordmark */}
          <Link className="brand" to="/">
            BookRec
          </Link>

          {/* Zone 2: Clean navigation links + integrated search */}
          <nav
            id="primary-navigation"
            className={`nav-links ${mobileOpen ? "is-open" : ""}`}
            aria-label="Primary navigation"
          >
            <Link
              className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
              to="/"
            >
              Catalog
            </Link>
            <Link
              className={`nav-link ${location.pathname === "/recommendations" ? "active" : ""}`}
              to="/recommendations"
            >
              AI Curator
            </Link>
            <Link
              className={`nav-link ${isBookmarksActive ? "active" : ""}`}
              to={user ? "/dashboard?section=bookmarks" : "/auth"}
            >
              Bookmarks
            </Link>
            <Link
              className={`nav-link ${location.pathname === "/dashboard" && !isBookmarksActive ? "active" : ""}`}
              to="/dashboard"
            >
              Reading Room
            </Link>
          </nav>

          {/* Zone 3: Search, Bookmarks Drawer Trigger, Theme & Account */}
          <div className="nav-actions">
            <div className="nav-search">
              <SearchBar
                compact
                onSearch={(q) => nav(`/?q=${encodeURIComponent(q)}`)}
                onPick={(id) => nav(`/books/${id}`)}
              />
            </div>

            <button
              type="button"
              className={`nav-bookmark-trigger ${savedBooks.length > 0 ? "has-items" : ""}`}
              onClick={() => {
                if (!user) {
                  nav("/auth");
                  return;
                }
                refreshSavedBooks();
                setBookmarksDrawerOpen(true);
              }}
              aria-label={`Open saved bookmarks drawer (${savedBooks.length} saved)`}
            >
              <span>♥ Saved</span>
              <span className="saved-count tabular-nums">{savedBooks.length}</span>
            </button>

            <button
              type="button"
              className="nav-icon-btn"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() => setThemeState((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "☼" : "☾"}
            </button>

            {loading ? null : user ? (
              <div className="profile-menu" ref={profileRef}>
                <button
                  ref={profileTriggerRef}
                  type="button"
                  className="profile-trigger"
                  aria-expanded={profileOpen}
                  aria-controls="profile-dropdown"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                  <span className="profile-name">{user.name}</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {profileOpen ? (
                  <div id="profile-dropdown" className="profile-dropdown">
                    <div className="profile-heading">
                      <span className="eyebrow">Signed in reader</span>
                      <b>{user.email}</b>
                    </div>
                    <Link to="/dashboard">Reading Room Overview</Link>
                    <Link to="/dashboard?section=bookmarks">
                      Saved Bookmarks ({savedBooks.length})
                    </Link>
                    <Link to="/dashboard?section=orders">Purchases & History</Link>
                    <Link to="/recommendations">AI Curator Shortlist</Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        nav("/");
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link className="btn btn-primary" to="/auth">
                Sign In
              </Link>
            )}

            <button
              type="button"
              className="mobile-menu-btn"
              aria-expanded={mobileOpen}
              aria-controls="primary-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Bookmarks Drawer */}
      {bookmarksDrawerOpen ? (
        <div
          className="drawer-backdrop"
          onClick={() => setBookmarksDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Your Saved Bookmarks"
        >
          <aside className="bookmarks-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="eyebrow">YOUR SAVED SHELF</span>
                <h2>Bookmarked Editions ({savedBooks.length})</h2>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setBookmarksDrawerOpen(false)}
                aria-label="Close bookmarks drawer"
              >
                Close
              </button>
            </div>

            <div className="drawer-body">
              {loadingBookmarks ? (
                <div className="muted" style={{ padding: "24px 0" }}>
                  Loading your bookmarks…
                </div>
              ) : savedBooks.length === 0 ? (
                <div className="drawer-empty">
                  <b>No books bookmarked yet.</b>
                  <p className="muted">
                    Tap “♡ Bookmark” on any book across the 3D showcase or catalog to save it here and train your AI recommendations.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setBookmarksDrawerOpen(false);
                      nav("/");
                    }}
                  >
                    Explore the Catalog
                  </button>
                </div>
              ) : (
                <div className="drawer-list">
                  {savedBooks.map((book) => (
                    <div key={book._id} className="drawer-book-item">
                      <Link
                        to={`/books/${book._id}`}
                        className="cover drawer-book-cover"
                        onClick={() => setBookmarksDrawerOpen(false)}
                      >
                        <BookCoverImage book={book} />
                      </Link>
                      <div className="drawer-book-info">
                        <Link
                          to={`/books/${book._id}`}
                          className="drawer-book-title"
                          onClick={() => setBookmarksDrawerOpen(false)}
                        >
                          {book.title}
                        </Link>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {book.author}
                        </div>
                        <div className="drawer-book-meta">
                          <span>{(book.genre || ["Literary"])[0]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {(book.ratingsAvg || 4.5).toFixed(1)} ★
                          </span>
                        </div>
                        <div className="drawer-book-actions">
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: "5px 10px", fontSize: 12 }}
                            onClick={() => {
                              setBookmarksDrawerOpen(false);
                              nav(`/recommendations?seed=${book._id}`);
                            }}
                          >
                            More like this
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: "5px 10px", fontSize: 12 }}
                            onClick={() => handleRemoveBookmark(book._id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setBookmarksDrawerOpen(false);
                  nav("/dashboard?section=bookmarks");
                }}
              >
                Open Full Bookmarks Page
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setBookmarksDrawerOpen(false);
                  nav("/recommendations");
                }}
              >
                Generate AI Picks from Saved
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route path="/books/:id" element={<BookDetailsPage />} />
          <Route
            path="/recommendations"
            element={
              <RequireAuth>
                <RecommendationsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <b>BookRec</b> · Curated Literary Discovery & Personalized AI Shelves
          </div>
          <div className="footer-links">
            <Link to="/">Catalog</Link>
            <Link to="/recommendations">AI Curator</Link>
            <Link to="/dashboard?section=bookmarks">Bookmarks</Link>
          </div>
        </div>
      </footer>
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
