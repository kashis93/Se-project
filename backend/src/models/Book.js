import mongoose from "mongoose";

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

export const Book = mongoose.model("Book", BookSchema);

