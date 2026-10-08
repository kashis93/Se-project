import dotenv from "dotenv";
dotenv.config();

import path from "node:path";
import { fileURLToPath } from "node:url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
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

const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use((err, req, res, next) => {
  if (
    err.name === "MongooseError" ||
    err.name === "MongoNetworkError" ||
    (err.message && err.message.includes("buffering timed out"))
  ) {
    console.warn("[AI Studio] Database offline — returning mock empty response");
    if (req.method === "GET") {
      return res.json(req.path.endsWith("s") || req.path.endsWith("s/") ? [] : {});
    }
    return res.status(503).json({ error: "Service temporarily unavailable (database offline)" });
  }
  next(err);
});

app.use(notFound);
app.use(errorHandler);

const port = 3000;

await connectDb(process.env.MONGO_URI);

// Auto-seed when using in-memory MongoDB or sync missing books into remote DB
const { Book } = await import("./models/Book.js");
const { readFile } = await import("node:fs/promises");
const booksRaw = await readFile(new URL("./seed/books.sample.json", import.meta.url), "utf-8");
const sampleBooks = JSON.parse(booksRaw);
const bookCount = await Book.countDocuments().catch(() => 0);

if (isInMemory || bookCount < sampleBooks.length) {
  console.log("Syncing catalog & sample data...");
  const bcrypt = (await import("bcryptjs")).default;
  const { User } = await import("./models/User.js");
  const { UserActivity } = await import("./models/UserActivity.js");

  let demo = await User.findOne({ email: "demo@demo.com" });
  if (!demo) {
    const demoPasswordHash = await bcrypt.hash("Password123!", 10);
    demo = await User.create({
      name: "Demo User",
      email: "demo@demo.com",
      passwordHash: demoPasswordHash,
      preferences: { genres: ["Fantasy", "Science Fiction"], keywords: ["journey", "adventure"] }
    });
    await UserActivity.create({ userId: demo._id });
  }

  const existingBooks = await Book.find({}).lean().catch(() => []);
  const existingTitles = new Set(existingBooks.map((b) => b.title.toLowerCase()));
  const missingBooks = sampleBooks.filter((b) => !existingTitles.has(b.title.toLowerCase()));
  const inserted = missingBooks.length ? await Book.insertMany(missingBooks) : existingBooks;

  if (bookCount === 0 && demo) {
    const allNow = await Book.find({}).lean();
    const dune = allNow.find((b) => b.title === "Dune");
    const hobbit = allNow.find((b) => b.title === "The Hobbit");
    const hailMary = allNow.find((b) => b.title === "Project Hail Mary");
    await UserActivity.updateOne(
      { userId: demo._id },
      {
        $push: {
          searches: [{ query: "space politics desert", bookId: dune?._id }],
          purchases: [{ bookId: hobbit?._id, price: 12.99 }],
          ratings: [{ bookId: dune?._id, rating: 5 }],
          bookmarks: hailMary ? [{ bookId: hailMary._id }] : []
        },
        $set: {
          readingGoal: {
            monthlyTarget: 4,
            completedBookIds: [dune?._id, hobbit?._id].filter(Boolean).map(String),
            updatedMonth: new Date().toISOString().slice(0, 7)
          }
        }
      }
    );
  }
  console.log(`Catalog ready: added=${missingBooks.length} total=${existingBooks.length + missingBooks.length}`);
}

app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://0.0.0.0:${port}`);
});

