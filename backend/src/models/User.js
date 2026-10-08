import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    preferences: {
      genres: { type: [String], default: [] },
      keywords: { type: [String], default: [] }
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);

