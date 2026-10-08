import express from "express";
import { z } from "zod";
import { validate } from "../utils/validate.js";
import { Book } from "../models/Book.js";

const router = express.Router();

router.post("/suggest", async (req, res, next) => {
  try {
    const body = validate(
      z.object({
        message: z.string().min(1).max(2000)
      }),
      req.body
    );

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      // Fallback: simple keyword search over the catalog
      const items = await Book.find({ $text: { $search: body.message } }).limit(5).lean();
      return res.json({
        mode: "fallback",
        reply: "Here are a few books that match what you described.",
        items
      });
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful book recommendation assistant. Suggest 5 book search queries (not titles) based on the user's message. Output JSON: {queries: string[]}."
          },
          { role: "user", content: body.message }
        ],
        temperature: 0.6
      })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      res.status(502);
      throw new Error(`OpenAI error: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let queries = [];
    try {
      const parsed = JSON.parse(content);
      queries = Array.isArray(parsed.queries) ? parsed.queries : [];
    } catch {
      queries = [];
    }

    const q = queries.slice(0, 3).join(" ");
    const items = q ? await Book.find({ $text: { $search: q } }).limit(8).lean() : [];

    res.json({
      mode: "openai",
      reply: "Here are some picks based on your description.",
      items
    });
  } catch (e) {
    next(e);
  }
});

export default router;

