export async function fetchMlRecommendations({ userId, candidateBooks, activity }) {
  const base = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
  const url = `${base.replace(/\/+$/, "")}/recommend`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        books: candidateBooks,
        activity
      })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`ML service error: ${resp.status} ${text}`);
    }
    return await resp.json();
  } catch (err) {
    // Deterministic local fallback: activity and relevance first, then rating/newest.
    const saved = new Set((activity?.bookmarks || []).map((b) => String(b.bookId)));
    const purchased = new Set((activity?.purchases || []).map((b) => String(b.bookId)));
    const rated = new Set((activity?.ratings || []).map((b) => String(b.bookId)));
    const terms = (activity?.searches || []).map((s) => String(s.query || "").toLowerCase()).filter(Boolean);
    console.warn("ML service unreachable, using rating-based fallback:", err.message);
    const sorted = [...candidateBooks].sort(
      (a, b) => {
        const score = (book) => {
          const text = `${book.title} ${book.author} ${(book.genre || []).join(" ")} ${(book.keywords || []).join(" ")}`.toLowerCase();
          const searchHit = terms.some((term) => text.includes(term)) ? 0.35 : 0;
          const savedBoost = saved.has(String(book.id)) ? 0.1 : 0;
          return searchHit + savedBoost + (book.ratingsAvg || 0) + (book.ratingsCount || 0) * 0.01;
        };
        return score(b) - score(a);
      }
    );
    const excluded = new Set([...purchased, ...rated]);
    const unseen = sorted.filter((b) => !excluded.has(String(b.id)));
    const recommendations = unseen.length
      ? unseen
      : sorted;
    return {
      recommended_book_ids: recommendations.slice(0, 12).map((b) => b.id),
      debug: {
        fallback: true,
        reason: unseen.length
          ? "ML service unavailable; deterministic activity fallback"
          : "ML service unavailable; no unseen titles remained, showing popular/latest fallback",
        excluded: excluded.size,
        books_in_catalog: candidateBooks.length,
        relaxed_exclusions: unseen.length === 0
      }
    };
  }
}
