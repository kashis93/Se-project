import mongoose from "mongoose";
import { createInMemoryModel, isInMemory } from "../utils/db.js";

const ReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" }
  },
  { timestamps: true }
);

const BookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    author: { type: String, required: true, trim: true, index: true },
    genre: { type: [String], default: [], index: true },
    keywords: { type: [String], default: [] },
    coverImageUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    ratingsAvg: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    reviews: { type: [ReviewSchema], default: [] }
  },
  { timestamps: true }
);

BookSchema.index({ title: "text", author: "text", description: "text", keywords: "text" });

const MongooseBook = mongoose.model("Book", BookSchema);
const MemoryBook = createInMemoryModel("books", {
  genre: [],
  keywords: [],
  coverImageUrl: "",
  description: "",
  ratingsAvg: 0,
  ratingsCount: 0,
  reviews: []
});

export const Book = new Proxy(MongooseBook, {
  get(target, prop) {
    const active = isInMemory ? MemoryBook : target;
    const val = active[prop];
    return typeof val === "function" ? val.bind(active) : val;
  }
});

