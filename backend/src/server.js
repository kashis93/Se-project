import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { connectDb, isInMemory } from "./utils/db.js";
import { notFound, errorHandler } from "./middleware/errors.js";

import authRoutes from "./routes/auth.routes.js";
import bookRoutes from "./routes/books.routes.js";
import recRoutes from "./routes/recommendations.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/recommendations", recRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/chat", chatRoutes);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);

await connectDb(process.env.MONGO_URI);

// Auto-seed when using in-memory MongoDB (data doesn't persist)
if (isInMemory) {
  console.log("In-memory DB detected — auto-seeding sample data...");
  const { readFile } = await import("node:fs/promises");
  const bcrypt = (await import("bcryptjs")).default;
  const { User } = await import("./models/User.js");
  const { Book } = await import("./models/Book.js");
  const { UserActivity } = await import("./models/UserActivity.js");

  const booksRaw = await readFile(new URL("./seed/books.sample.json", import.meta.url), "utf-8");
  const books = JSON.parse(booksRaw);

  const demoPasswordHash = await bcrypt.hash("Password123!", 10);
  const demo = await User.create({
    name: "Demo User",
    email: "demo@demo.com",
    passwordHash: demoPasswordHash,
    preferences: { genres: ["Fantasy", "Science Fiction"], keywords: ["journey", "adventure"] }
  });
  await UserActivity.create({ userId: demo._id });
  const inserted = await Book.insertMany(books);

  const dune = inserted.find((b) => b.title === "Dune");
  const hobbit = inserted.find((b) => b.title === "The Hobbit");
  await UserActivity.updateOne(
    { userId: demo._id },
    {
      $push: {
        searches: [{ query: "space politics desert", bookId: dune?._id }],
        purchases: [{ bookId: hobbit?._id, price: 12.99 }],
        ratings: [{ bookId: dune?._id, rating: 5 }]
      }
    }
  );
  console.log(`Auto-seeded: users=1 books=${inserted.length}`);
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://127.0.0.1:${port}`);
});

