import { GoogleGenAI, Type } from "@google/genai";

let geminiDisabledReason = null;

function getGeminiClient() {
  if (geminiDisabledReason) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}

function handleGeminiError(err) {
  const msg = String(err?.message || err || "");
  if (
    msg.includes("403") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("denied access") ||
    msg.includes("API_KEY_INVALID")
  ) {
    geminiDisabledReason = "API key lacks access or permission; using built-in Hybrid AI Affinity Engine.";
  }
}

export async function generateGeminiRecommendations({
  candidateBooks,
  activity,
  interest,
  mood,
  genre,
  seedBook
}) {
  const ai = getGeminiClient();
  if (!ai || !candidateBooks?.length) return null;

  const savedIds = new Set((activity?.bookmarks || []).map((b) => String(b.bookId)));
  const purchasedIds = new Set((activity?.purchases || []).map((b) => String(b.bookId)));
  const ratedMap = new Map((activity?.ratings || []).map((r) => [String(r.bookId), r.rating]));
  const recentSearches = (activity?.searches || [])
    .slice(-10)
    .map((s) => s.query)
    .filter(Boolean);

  const savedTitles = candidateBooks
    .filter((b) => savedIds.has(String(b.id)))
    .map((b) => `${b.title} by ${b.author}`);
  const purchasedTitles = candidateBooks
    .filter((b) => purchasedIds.has(String(b.id)))
    .map((b) => `${b.title} by ${b.author}`);
  const ratedTitles = candidateBooks
    .filter((b) => ratedMap.has(String(b.id)))
    .map((b) => `${b.title} (${ratedMap.get(String(b.id))}/5)`);

  const catalogDigest = candidateBooks.slice(0, 60).map((b) => ({
    id: String(b.id),
    title: b.title,
    author: b.author,
    genre: b.genre || [],
    keywords: b.keywords || [],
    description: (b.description || "").slice(0, 140),
    rating: b.ratingsAvg || 0
  }));

  const userProfilePrompt = [
    `Reader Signals:`,
    savedTitles.length ? `- Bookmarked / Saved Books: ${savedTitles.join("; ")}` : `- Bookmarked Books: None yet`,
    purchasedTitles.length ? `- Purchased Books: ${purchasedTitles.join("; ")}` : `- Purchased Books: None yet`,
    ratedTitles.length ? `- Rated Books: ${ratedTitles.join("; ")}` : `- Rated Books: None yet`,
    recentSearches.length ? `- Recent Searches: ${recentSearches.join(", ")}` : `- Recent Searches: None`,
    seedBook ? `- Starting Seed Book: ${seedBook.title} by ${seedBook.author} (${(seedBook.genre || []).join(", ")})` : "",
    interest ? `- Requested Reading Interest / Prompt: "${interest}"` : "",
    mood ? `- Selected Mood: "${mood}"` : "",
    genre ? `- Selected Genre Filter: "${genre}"` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are the lead literary curator and recommendation engine for BookRec.
Analyze the reader's signals and select the top 8 to 12 most fitting books from the provided catalog JSON.
Prioritize books that match the user's explicit mood, interest, seed book, or their bookmarked/rated/searched tastes.
If the user has purchased or rated a book already, prefer recommending fresh unseen titles unless the catalog is small.

${userProfilePrompt}

Available Catalog JSON:
${JSON.stringify(catalogDigest)}

Return a JSON object with:
1. "curatorNote": A brief, insightful 1-2 sentence literary curator summary explaining how this shelf was tailored to their signals.
2. "recommendations": An array of objects, each containing:
   - "bookId": exact "id" from the catalog
   - "matchScore": integer between 82 and 99 representing affinity percentage
   - "reason": a concise, specific 1-sentence explanation (max 110 chars) of why this book fits their taste, bookmarks, or mood.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        systemInstruction:
          "You are an expert literary curator and hybrid recommendation engine. Always return valid JSON matching the schema and only use bookId values present in the provided catalog.",
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            curatorNote: {
              type: Type.STRING,
              description: "1-2 sentence curator overview of the personalized shelf."
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bookId: { type: Type.STRING },
                  matchScore: { type: Type.INTEGER },
                  reason: { type: Type.STRING }
                },
                required: ["bookId", "matchScore", "reason"]
              }
            }
          },
          required: ["curatorNote", "recommendations"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text.trim());
    if (!parsed || !Array.isArray(parsed.recommendations) || !parsed.recommendations.length) {
      return null;
    }

    return parsed;
  } catch (err) {
    handleGeminiError(err);
    return null;
  }
}

export async function generateGeminiChatSuggestions({ message, catalogBooks }) {
  const ai = getGeminiClient();
  if (!ai || !catalogBooks?.length) return null;

  const catalogDigest = catalogBooks.slice(0, 50).map((b) => ({
    id: String(b._id),
    title: b.title,
    author: b.author,
    genre: b.genre || [],
    keywords: b.keywords || [],
    description: (b.description || "").slice(0, 140)
  }));

  const prompt = `Reader request: "${message}"

Available Book Catalog:
${JSON.stringify(catalogDigest)}

Select up to 4 books from the catalog that best answer the reader's request, and write a warm, literary concierge reply explaining your choices.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        systemInstruction:
          "You are BookRec's literary concierge. Recommend real books from the provided catalog JSON that match the reader's request.",
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Warm, helpful literary response to the user."
            },
            picks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bookId: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["bookId", "reason"]
              }
            }
          },
          required: ["reply", "picks"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text.trim());
  } catch (err) {
    handleGeminiError(err);
    return null;
  }
}
