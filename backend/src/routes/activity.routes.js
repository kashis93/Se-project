import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { UserActivity } from "../models/UserActivity.js";
import { validate } from "../utils/validate.js";

const router = express.Router();

function ensureGoal(activity, userId) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const base = activity || {
    userId: String(userId),
    searches: [],
    purchases: [],
    ratings: [],
    bookmarks: []
  };
  const existingGoal = base.readingGoal || {};
  // Seed completed books from rated/purchased if empty so new users have immediate progress
  const autoCompleted = Array.from(
    new Set([
      ...(existingGoal.completedBookIds || []).map(String),
      ...(base.ratings || []).map((r) => String(r.bookId)),
      ...(base.purchases || []).map((p) => String(p.bookId))
    ])
  );
  return {
    ...base,
    readingGoal: {
      monthlyTarget: Number(existingGoal.monthlyTarget || 4),
      completedBookIds: existingGoal.completedBookIds !== undefined ? existingGoal.completedBookIds.map(String) : autoCompleted,
      updatedMonth: existingGoal.updatedMonth || currentMonth
    }
  };
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const activity = await UserActivity.findOne({ userId: req.user._id }).lean();
    res.json({ activity: ensureGoal(activity, req.user._id) });
  } catch (e) {
    next(e);
  }
});

router.put("/reading-goal", requireAuth, async (req, res, next) => {
  try {
    const body = validate(
      z.object({
        monthlyTarget: z.number().int().min(1).max(50).optional(),
        completedBookIds: z.array(z.string()).optional(),
        toggleBookId: z.string().optional()
      }),
      req.body || {}
    );

    const raw = await UserActivity.findOne({ userId: req.user._id }).lean();
    const current = ensureGoal(raw, req.user._id);
    let nextTarget = body.monthlyTarget ?? current.readingGoal.monthlyTarget;
    let nextCompleted = Array.isArray(body.completedBookIds)
      ? body.completedBookIds.map(String)
      : [...(current.readingGoal.completedBookIds || [])];

    if (body.toggleBookId) {
      const id = String(body.toggleBookId);
      if (nextCompleted.includes(id)) {
        nextCompleted = nextCompleted.filter((x) => x !== id);
      } else {
        nextCompleted.push(id);
      }
    }

    const updatedGoal = {
      monthlyTarget: nextTarget,
      completedBookIds: Array.from(new Set(nextCompleted)),
      updatedMonth: new Date().toISOString().slice(0, 7)
    };

    await UserActivity.updateOne(
      { userId: req.user._id },
      { $set: { readingGoal: updatedGoal } },
      { upsert: true }
    );

    const refreshed = await UserActivity.findOne({ userId: req.user._id }).lean();
    res.json({
      readingGoal: updatedGoal,
      activity: ensureGoal(refreshed, req.user._id)
    });
  } catch (e) {
    next(e);
  }
});

export default router;
