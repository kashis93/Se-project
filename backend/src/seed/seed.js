import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import { connectDb } from "../utils/db.js";
import { User } from "../models/User.js";
import { Book } from "../models/Book.js";
import { UserActivity } from "../models/UserActivity.js";

async function main() {
  await connectDb(process.env.MONGO_URI);

  const booksRaw = await readFile(new URL("./books.sample.json", import.meta.url), "utf-8");
  const books = JSON.parse(booksRaw);

  await Promise.all([User.deleteMany({}), Book.deleteMany({}), UserActivity.deleteMany({})]);

  const demoPasswordHash = await bcrypt.hash("Password123!", 10);
  const demo = await User.create({
    name: "Demo User",
    email: "demo@demo.com",
    passwordHash: demoPasswordHash,
    preferences: { genres: ["Fantasy", "Science Fiction"], keywords: ["journey", "adventure"] }
  });
  await UserActivity.create({ userId: demo._id });

  const inserted = await Book.insertMany(books);

  // create a little activity to make recommendations interesting
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

  // eslint-disable-next-line no-console
  console.log(`Seeded: users=1 books=${inserted.length}`);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

