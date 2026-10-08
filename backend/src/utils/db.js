import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod = null;
export let isInMemory = false;

export async function connectDb(uri) {
  try {
    if (uri) {
      mongoose.set("strictQuery", true);
      await mongoose.connect(uri);
      console.log("Connected to MongoDB (remote)");
      return;
    }
  } catch (err) {
    console.warn(`Failed to connect to ${uri}: ${err.message}`);
    console.log("Falling back to in-memory MongoDB...");
  }

  // Fallback: start an in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const memUri = mongod.getUri();
  mongoose.set("strictQuery", true);
  await mongoose.connect(memUri);
  isInMemory = true;
  console.log(`Connected to in-memory MongoDB at ${memUri}`);
}
