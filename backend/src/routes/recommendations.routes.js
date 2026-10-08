import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { Book } from "../models/Book.js";
import { UserActivity } from "../models/UserActivity.js";
import { fetchMlRecommendations } from "../utils/mlClient.js";
import { generateGeminiRecommendations } from "../utils/gemini.js";

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
    const seedBook = seedBookId ? books.find((b) => String(b._id) === seedBookId) : null;

    const enrichedActivity = {
      ...(activity || { searches: [], purchases: [], ratings: [], bookmarks: [] }),
      searches: [
        ...((activity && activity.searches) || []),
        ...(interest ? [{ query: interest }] : []),
        ...(mood ? [{ query: mood }] : []),
        ...(genre ? [{ query: genre }] : []),
        ...(seedBookId ? [{ query: seedBook ? `${seedBook.title} ${(seedBook.genre || []).join(" ")}` : "", bookId: seedBookId }] : [])
      ]
    };

    const candidateBooks = recommendationBooks.map((b) => ({
      id: String(b._id),
      title: b.title,
      author: b.author,
      genre: b.genre,
      keywords: b.keywords,
      description: b.description,
      ratingsAvg: b.ratingsAvg,
      ratingsCount: b.ratingsCount
    }));

    let orderedIds = [];
    let reasonsById = new Map();
    let scoresById = new Map();
    let curatorNote = "";
    let source = "ml";
    let mlDebug = {};

    const geminiResult = await generateGeminiRecommendations({
      candidateBooks,
      activity: enrichedActivity,
      interest,
      mood,
      genre,
      seedBook
    });
    if (geminiResult && Array.isArray(geminiResult.recommendations) && geminiResult.recommendations.length > 0) {
      source = "gemini-ai";
      curatorNote = geminiResult.curatorNote || "";
      for (const rec of geminiResult.recommendations) {
        const id = String(rec.bookId);
        if (!reasonsById.has(id)) {
          orderedIds.push(id);
          reasonsById.set(id, rec.reason);
          scoresById.set(id, rec.matchScore);
        }
      }
    }

    if (orderedIds.length === 0) {
      const ml = await fetchMlRecommendations({
        userId: String(req.user._id),
        candidateBooks,
        activity: enrichedActivity
      });
      orderedIds = (ml.recommended_book_ids || []).map(String);
      mlDebug = ml.debug || {};
      source = ml.debug?.fallback ? "hybrid-scoring" : "ml";
      if (ml.explanations) {
        for (const [id, info] of Object.entries(ml.explanations)) {
          reasonsById.set(String(id), info.reason);
          scoresById.set(String(id), info.matchScore);
        }
      }
      curatorNote = ml.curatorNote || "Tailored using your saved bookmarks, ratings, search signals, and genre affinity.";
    }

    const byId = new Map(books.map((b) => [String(b._id), b]));
    const items = orderedIds
      .map((id) => {
        const b = byId.get(id);
        if (!b) return null;
        return {
          ...b,
          matchReason: reasonsById.get(id) || undefined,
          matchScore: scoresById.get(id) || undefined
        };
      })
      .filter(Boolean);

    res.json({
      items,
      curatorNote,
      debug: {
        ...mlDebug,
        curatorNote,
        filter: mood || genre ? [mood, genre].filter(Boolean).join(" + ") : "all shelves",
        books_in_catalog: recommendationBooks.length,
        source,
        bookmarked_events: enrichedActivity.bookmarks?.length || 0,
        bookmark_events: enrichedActivity.bookmarks?.length || 0,
        search_events: enrichedActivity.searches?.length || 0,
        purchase_events: enrichedActivity.purchases?.length || 0,
        ratings_events: enrichedActivity.ratings?.length || 0,
        personalized: Boolean(
          interest ||
            seedBookId ||
            mood ||
            genre ||
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

