import express from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Book } from "../models/Book.js";
import { UserActivity } from "../models/UserActivity.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../utils/validate.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(40, Math.max(1, Number(req.query.limit || 12)));
    const q = String(req.query.q || "").trim();
    const genre = String(req.query.genre || "").trim();
    const mood = String(req.query.mood || "").trim();
    const mode = String(req.query.mode || "").trim();

    const filter = {};
    if (genre) filter.genre = genre;
    if (q) filter.$text = { $search: q };
    if (mood) filter.$text = { $search: mood };
    if (q && mood) filter.$text = { $search: `${q} ${mood}` };

    const sort = q || mood ? { score: { $meta: "textScore" } } : mode === "trending" ? { ratingsAvg: -1, ratingsCount: -1, createdAt: -1 } : { createdAt: -1 };
    const projection = q || mood ? { score: { $meta: "textScore" } } : {};

    const [items, total] = await Promise.all([
      Book.find(filter, projection).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Book.countDocuments(filter)
    ]);

    res.json({ items, page, limit, total });
  } catch (e) {
    next(e);
  }
});

router.get("/saved", requireAuth, async (req, res, next) => {
  try {
    const activity = await UserActivity.findOne({ userId: req.user._id }).lean();
    const ids = (activity?.bookmarks || []).map((b) => b.bookId);
    const items = ids.length ? await Book.find({ _id: { $in: ids } }).lean() : [];
    const byId = new Map(items.map((b) => [String(b._id), b]));
    res.json({ items: ids.map((id) => byId.get(String(id))).filter(Boolean), total: items.length });
  } catch (e) { next(e); }
});

router.get("/autocomplete", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ items: [] });
    const items = await Book.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" }, title: 1, author: 1, coverImageUrl: 1, ratingsAvg: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(8)
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get("/trending", async (req, res, next) => {
  try {
    // Lightweight “trend”: highest rated with enough ratings, then newest
    const items = await Book.find({})
      .sort({ ratingsAvg: -1, ratingsCount: -1, createdAt: -1 })
      .limit(12)
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post("/track-search", requireAuth, async (req, res, next) => {
  try {
    const body = validate(
      z.object({
        query: z.string().min(1).max(200),
        bookId: z.string().optional()
      }),
      req.body
    );
    const bookId = body.bookId && mongoose.isValidObjectId(body.bookId) ? body.bookId : undefined;
    await UserActivity.updateOne(
      { userId: req.user._id },
      { $push: { searches: { query: body.query, bookId } } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error("Invalid book id");
    }
    const book = await Book.findById(req.params.id).lean();
    if (!book) {
      res.status(404);
      throw new Error("Book not found");
    }
    res.json({ book });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/review", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error("Invalid book id");
    }
    const body = validate(
      z.object({
        rating: z.number().min(1).max(5),
        comment: z.string().max(2000).optional()
      }),
      req.body
    );

    const book = await Book.findById(req.params.id);
    if (!book) {
      res.status(404);
      throw new Error("Book not found");
    }

    const existing = book.reviews.find((r) => String(r.userId) === String(req.user._id));
    if (existing) {
      existing.rating = body.rating;
      existing.comment = body.comment || "";
    } else {
      book.reviews.push({
        userId: req.user._id,
        userName: req.user.name,
        rating: body.rating,
        comment: body.comment || ""
      });
    }

    const ratings = book.reviews.map((r) => r.rating);
    book.ratingsCount = ratings.length;
    book.ratingsAvg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    await book.save();

    await UserActivity.updateOne(
      { userId: req.user._id },
      { $push: { ratings: { bookId: book._id, rating: body.rating } } },
      { upsert: true }
    );

    res.json({ book: book.toObject() });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/purchase", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error("Invalid book id");
    }
    const body = validate(
      z.object({
        price: z.number().min(0).max(999).optional()
      }),
      req.body || {}
    );

    const book = await Book.findById(req.params.id).lean();
    if (!book) {
      res.status(404);
      throw new Error("Book not found");
    }

    await UserActivity.updateOne(
      { userId: req.user._id },
      { $push: { purchases: { bookId: book._id, price: body.price ?? 9.99 } } },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/bookmark", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400); throw new Error("Invalid book id"); }
    const book = await Book.findById(req.params.id).lean();
    if (!book) { res.status(404); throw new Error("Book not found"); }
    const activity = await UserActivity.findOne({ userId: req.user._id }).lean();
    const saved = (activity?.bookmarks || []).some((b) => String(b.bookId) === String(book._id));
    if (saved) {
      await UserActivity.updateOne({ userId: req.user._id }, { $pull: { bookmarks: { bookId: book._id } } });
    } else {
      await UserActivity.updateOne({ userId: req.user._id }, { $push: { bookmarks: { bookId: book._id } } }, { upsert: true });
    }
    res.json({ saved: !saved });
  } catch (e) { next(e); }
});



export default router;
