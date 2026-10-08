import mongoose from "mongoose";

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

const UserActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true, index: true },
    searches: { type: [SearchEventSchema], default: [] },
    purchases: { type: [PurchaseEventSchema], default: [] },
    ratings: { type: [RatingEventSchema], default: [] },
    bookmarks: { type: [BookmarkEventSchema], default: [] }
  },
  { timestamps: true }
);

export const UserActivity = mongoose.model("UserActivity", UserActivitySchema);
