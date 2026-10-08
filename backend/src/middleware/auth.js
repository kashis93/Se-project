import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return jwt.sign({ sub: String(user._id) }, secret, { expiresIn: "7d" });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) {
      res.status(401);
      throw new Error("Missing auth token");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is required");
    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub).lean();
    if (!user) {
      res.status(401);
      throw new Error("Invalid token");
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

