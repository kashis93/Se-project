import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { UserActivity } from "../models/UserActivity.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { validate } from "../utils/validate.js";

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const body = validate(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        preferences: z
          .object({
            genres: z.array(z.string()).optional(),
            keywords: z.array(z.string()).optional()
          })
          .optional()
      }),
      req.body
    );

    const existing = await User.findOne({ email: body.email }).lean();
    if (existing) {
      res.status(409);
      throw new Error("Email already registered");
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      preferences: body.preferences || { genres: [], keywords: [] }
    });
    await UserActivity.create({ userId: user._id });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: String(user._id), name: user.name, email: user.email, preferences: user.preferences }
    });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = validate(
      z.object({
        email: z.string().email(),
        password: z.string().min(1)
      }),
      req.body
    );

    const user = await User.findOne({ email: body.email });
    if (!user) {
      res.status(401);
      throw new Error("Invalid credentials");
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      res.status(401);
      throw new Error("Invalid credentials");
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: String(user._id), name: user.name, email: user.email, preferences: user.preferences }
    });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const u = req.user;
  res.json({ user: { id: String(u._id), name: u.name, email: u.email, preferences: u.preferences } });
});

export default router;

