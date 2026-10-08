import React from "react";
import { Book } from "../lib/api";

export function MoodCarousel3D({
  books,
  activeMood,
  onSelectMood,
  onOpenBook,
  savedIds,
  onToggleSave
}: {
  books: Book[];
  activeMood: string;
  onSelectMood: (mood: string) => void;
  onOpenBook: (bookId: string) => void;
  savedIds: Set<string>;
  onToggleSave?: (bookId: string) => void;
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);

  const items = React.useMemo(() => {
    if (!books || books.length === 0) return [];
    return books.slice(0, 9);
  }, [books]);

  React.useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(0);
    }
  }, [items.length, activeIndex]);

  React.useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [isPaused, items.length]);

  if (!items.length) {
    return (
      <div className="carousel-3d-wrapper">
        <div className="carousel-3d-stage">
          <div className="carousel-empty muted">Loading editions…</div>
        </div>
      </div>
    );
  }

  const currentBook = items[activeIndex] || items[0];

  function getCircularOffset(index: number, current: number, total: number) {
    let diff = index - current;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  }

  const moodOptions = ["Any mood", "Adventure", "Emotional", "Exciting", "Cozy", "Thought-provoking"];

  return (
    <div
      className="carousel-3d-wrapper"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="3D auto-scrolling book showcase"
    >
      <div className="carousel-3d-stage">
        <div className="carousel-3d-pedestal" />
        <div className="carousel-3d-track">
          {items.map((book, idx) => {
            const offset = getCircularOffset(idx, activeIndex, items.length);
            const absOffset = Math.abs(offset);
            const isVisible = absOffset <= 3;
            const translateX = offset * 116;
            const translateZ = -absOffset * 96;
            const rotateY = offset * -24;
            const scale = offset === 0 ? 1.08 : Math.max(0.72, 1 - absOffset * 0.12);
            const opacity = !isVisible ? 0 : offset === 0 ? 1 : Math.max(0.28, 1 - absOffset * 0.25);
            const zIndex = 30 - absOffset * 5;

            return (
              <div
                key={book._id}
                className={`carousel-3d-item ${offset === 0 ? "is-center" : ""}`}
                style={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex,
                  pointerEvents: isVisible ? "auto" : "none"
                }}
                onClick={() => {
                  if (offset === 0) {
                    onOpenBook(book._id);
                  } else {
                    setActiveIndex(idx);
                  }
                }}
                role="button"
                tabIndex={offset === 0 ? 0 : -1}
                aria-label={`${book.title} by ${book.author}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (offset === 0) onOpenBook(book._id);
                    else setActiveIndex(idx);
                  }
                }}
              >
                <div className="book-3d-frame">
                  <div className="book-3d-spine" />
                  <div className="book-3d-cover">
                    <BookCoverImage book={book} />
                  </div>
                  <div className="book-3d-pages" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {currentBook ? (
        <div className="carousel-3d-spotlight">
          <div className="spotlight-meta">
            <div className="spotlight-kicker">
              <span>{(currentBook.genre || ["Literary"])[0]}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{(currentBook.ratingsAvg || 4.6).toFixed(1)} ★</span>
              {currentBook.keywords?.[0] ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{currentBook.keywords[0]}</span>
                </>
              ) : null}
            </div>
            <h3 className="spotlight-title">{currentBook.title}</h3>
            <div className="spotlight-author">{currentBook.author}</div>
          </div>
          <div className="spotlight-actions">
            {onToggleSave ? (
              <button
                type="button"
                className={`btn spotlight-save-btn ${savedIds.has(currentBook._id) ? "is-saved" : ""}`}
                onClick={() => onToggleSave(currentBook._id)}
                aria-label={savedIds.has(currentBook._id) ? "Remove bookmark" : "Bookmark book"}
              >
                {savedIds.has(currentBook._id) ? "♥ Saved" : "♡ Save"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenBook(currentBook._id)}
            >
              Read Preview
            </button>
          </div>
        </div>
      ) : null}

      <div className="carousel-bottom-bar">
        <div className="carousel-mood-selector" role="tablist" aria-label="Filter by reading mood">
          {moodOptions.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={activeMood === m}
              className={`mood-tab ${activeMood === m ? "active" : ""}`}
              onClick={() => onSelectMood(m)}
            >
              {m === "Any mood" ? "All Moods" : m}
            </button>
          ))}
        </div>

        <div className="carousel-dots" aria-hidden="true">
          {items.map((b, idx) => (
            <button
              key={b._id}
              type="button"
              className={`carousel-dot ${idx === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(idx)}
              tabIndex={-1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const COVER_PALETTES = [
  { bg: "linear-gradient(155deg, #163d35 0%, #0d2621 100%)", border: "#4d9b89", accent: "#d8b47c" },
  { bg: "linear-gradient(155deg, #4a251d 0%, #29130e 100%)", border: "#c7775c", accent: "#f0d3b5" },
  { bg: "linear-gradient(155deg, #1f2b3d 0%, #111824 100%)", border: "#6684ad", accent: "#d9c398" },
  { bg: "linear-gradient(155deg, #33291f 0%, #1c1610 100%)", border: "#9e8264", accent: "#e8d5b7" },
  { bg: "linear-gradient(155deg, #2d2238 0%, #181120 100%)", border: "#8e71ab", accent: "#e3c896" },
  { bg: "linear-gradient(155deg, #1f3628 0%, #101f16 100%)", border: "#5f9673", accent: "#dfca9f" }
];

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function BookCoverImage({
  book
}: {
  book: Pick<Book, "title" | "author" | "coverImageUrl"> & { genre?: string[] };
}) {
  const [failed, setFailed] = React.useState(false);
  const palette = COVER_PALETTES[hashTitle(book.title || "Book") % COVER_PALETTES.length];
  const primaryGenre = book.genre?.[0] || "EDITION";

  if (!book.coverImageUrl || failed) {
    return (
      <div
        className="cover-fallback"
        style={{
          background: palette.bg,
          borderColor: palette.border
        }}
      >
        <div className="cover-fallback-inner" style={{ borderColor: `${palette.accent}44` }}>
          <span className="cover-fallback-kicker" style={{ color: palette.accent }}>
            {primaryGenre}
          </span>
          <div className="cover-fallback-center">
            <span className="cover-fallback-ornament" style={{ color: palette.accent }}>
              ✦
            </span>
            <span className="cover-fallback-title">{book.title}</span>
          </div>
          <span className="cover-fallback-author" style={{ color: palette.accent }}>
            {book.author}
          </span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={book.coverImageUrl}
      alt={book.title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 5 || img.naturalHeight <= 5) {
          setFailed(true);
        }
      }}
      onError={() => setFailed(true)}
    />
  );
}
