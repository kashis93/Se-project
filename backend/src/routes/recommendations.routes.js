import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { Book } from "../models/Book.js";
import { UserActivity } from "../models/UserActivity.js";
import { fetchMlRecommendations } from "../utils/mlClient.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const seedBookId = String(req.query.seedBookId || "").trim();
    const interest = String(req.query.interest || "").trim().slice(0, 160);
    const mood = String(req.query.mood || "").trim().slice(0, 80);
    const genre = String(req.query.genre || "").trim().slice(0, 80);
    const [activity, books] = await Promise.all([
      UserActivity.findOne({ userId: req.user._id }).lean(),
      Book.find({}).limit(300).lean()
    ]);
    const normalizedMood = mood.toLowerCase();
    const normalizedGenre = genre.toLowerCase();
    const matchesFilters = (book) => {
      const searchable = [
        book.title,
        book.author,
        ...(book.genre || []),
        ...(book.keywords || []),
        book.description || ""
      ].join(" ").toLowerCase();
      return (!normalizedMood || searchable.includes(normalizedMood)) &&
        (!normalizedGenre || (book.genre || []).some((item) => String(item).toLowerCase() === normalizedGenre));
    };
    const filteredBooks = (mood || genre) ? books.filter(matchesFilters) : books;
    const recommendationBooks = filteredBooks.length ? filteredBooks : books;

    const enrichedActivity = {
      ...(activity || { searches: [], purchases: [], ratings: [], bookmarks: [] }),
      searches: [
        ...((activity && activity.searches) || []),
        ...(interest ? [{ query: interest }] : []),
        ...(mood ? [{ query: mood }] : []),
        ...(genre ? [{ query: genre }] : []),
        ...(seedBookId ? [{ query: "", bookId: seedBookId }] : [])
      ]
    };
    const ml = await fetchMlRecommendations({
      userId: String(req.user._id),
      candidateBooks: recommendationBooks.map((b) => ({
        id: String(b._id),
        title: b.title,
        author: b.author,
        genre: b.genre,
        keywords: b.keywords,
        description: b.description,
        ratingsAvg: b.ratingsAvg,
        ratingsCount: b.ratingsCount
      })),
      activity: enrichedActivity
    });

    const recommendedIds = new Set((ml.recommended_book_ids || []).map(String));
    const ordered = (ml.recommended_book_ids || []).map(String);

    const fullBooks = await Book.find({ _id: { $in: [...recommendedIds] } }).lean();
    const byId = new Map(fullBooks.map((b) => [String(b._id), b]));
    const items = ordered.map((id) => byId.get(id)).filter(Boolean);

    res.json({
      items,
      debug: {
        ...(ml.debug || {}),
        filter: mood || genre ? [mood, genre].filter(Boolean).join(" + ") : "all shelves",
        books_in_catalog: recommendationBooks.length,
        source: ml.debug?.fallback ? "fallback" : "ml",
        bookmarked_events: enrichedActivity.bookmarks?.length || 0,
        bookmark_events: enrichedActivity.bookmarks?.length || 0,
        search_events: enrichedActivity.searches?.length || 0,
        purchase_events: enrichedActivity.purchases?.length || 0,
        ratings_events: enrichedActivity.ratings?.length || 0,
        personalized: Boolean(
        interest || seedBookId ||
        enrichedActivity.searches?.length ||
        enrichedActivity.purchases?.length ||
        enrichedActivity.ratings?.length ||
        enrichedActivity.bookmarks?.length
        ),
        generatedAt: new Date().toISOString()
      }
    });
  } catch (e) {
    next(e);
  }
});

export default router;
