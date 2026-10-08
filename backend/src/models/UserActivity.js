import mongoose from "mongoose";
import { createInMemoryModel, isInMemory } from "../utils/db.js";

const RatingEventSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true }
  },
  { timestamps: true }
);

const PurchaseEventSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    price: { type: Number, default: 9.99 }
  },
  { timestamps: true }
);

const SearchEventSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, trim: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" }
  },
  { timestamps: true }
);

const BookmarkEventSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true }
  },
  { timestamps: true }
);

const ReadingGoalSchema = new mongoose.Schema(
  {
    monthlyTarget: { type: Number, min: 1, max: 50, default: 4 },
    completedBookIds: { type: [String], default: [] },
    updatedMonth: { type: String, default: () => new Date().toISOString().slice(0, 7) }
  },
  { _id: false }
);

const UserActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true, index: true },
    searches: { type: [SearchEventSchema], default: [] },
    purchases: { type: [PurchaseEventSchema], default: [] },
    ratings: { type: [RatingEventSchema], default: [] },
    bookmarks: { type: [BookmarkEventSchema], default: [] },
    readingGoal: {
      type: ReadingGoalSchema,
      default: () => ({
        monthlyTarget: 4,
        completedBookIds: [],
        updatedMonth: new Date().toISOString().slice(0, 7)
      })
    }
  },
  { timestamps: true }
);

const MongooseUserActivity = mongoose.model("UserActivity", UserActivitySchema);
const MemoryUserActivity = createInMemoryModel("useractivities", {
  searches: [],
  purchases: [],
  ratings: [],
  bookmarks: [],
  readingGoal: {
    monthlyTarget: 4,
    completedBookIds: [],
    updatedMonth: new Date().toISOString().slice(0, 7)
  }
});

export const UserActivity = new Proxy(MongooseUserActivity, {
  get(target, prop) {
    const active = isInMemory ? MemoryUserActivity : target;
    const val = active[prop];
    return typeof val === "function" ? val.bind(active) : val;
  }
});
