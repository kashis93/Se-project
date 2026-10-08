import mongoose from "mongoose";
import { createInMemoryModel, isInMemory } from "../utils/db.js";

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

const MongooseUser = mongoose.model("User", UserSchema);
const MemoryUser = createInMemoryModel("users", {
  preferences: { genres: [], keywords: [] }
});

export const User = new Proxy(MongooseUser, {
  get(target, prop) {
    const active = isInMemory ? MemoryUser : target;
    const val = active[prop];
    return typeof val === "function" ? val.bind(active) : val;
  }
});

