import express from "express";
import { z } from "zod";
import { validate } from "../utils/validate.js";
import { Book } from "../models/Book.js";
import { generateGeminiChatSuggestions } from "../utils/gemini.js";

const router = express.Router();

router.post("/suggest", async (req, res, next) => {
  try {
    const body = validate(
      z.object({
        message: z.string().min(1).max(2000)
      }),
      req.body
    );

    const allBooks = await Book.find({}).limit(100).lean();

    const geminiChat = await generateGeminiChatSuggestions({
      message: body.message,
      catalogBooks: allBooks
    });
    if (geminiChat && Array.isArray(geminiChat.picks) && geminiChat.picks.length > 0) {
      const byId = new Map(allBooks.map((b) => [String(b._id), b]));
      const items = geminiChat.picks
        .map((p) => {
          const book = byId.get(String(p.bookId));
          return book ? { ...book, matchReason: p.reason } : null;
        })
        .filter(Boolean);
      if (items.length > 0) {
        return res.json({
          mode: "gemini",
          reply: geminiChat.reply,
          items
        });
      }
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      // Smart multi-term search over the catalog
      const textMatches = await Book.find({ $text: { $search: body.message } }).limit(5).lean();
      const items = textMatches.length ? textMatches : allBooks.slice(0, 4);
      return res.json({
        mode: "curated",
        reply: textMatches.length
          ? "Here are the closest matches from our catalog based on the themes and mood you described."
          : "Here are standout titles from our shelf to spark your next read.",
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

