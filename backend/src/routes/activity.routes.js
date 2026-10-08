import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { UserActivity } from "../models/UserActivity.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const activity = await UserActivity.findOne({ userId: req.user._id }).lean();
    res.json({ activity: activity || { userId: String(req.user._id), searches: [], purchases: [], ratings: [], bookmarks: [] } });
  } catch (e) {
    next(e);
  }
});

export default router;
