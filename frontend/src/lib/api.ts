import { API_BASE_URL } from "./config";
import { getToken } from "./storage";

export type ApiError = { message: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers ? (init.headers as Record<string, string>) : {})
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const resp = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await resp.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Unexpected server response" };
  }
  if (!resp.ok) {
    const msg = data?.error?.message || data?.message || `Request failed: ${resp.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export type User = { id: string; name: string; email: string; preferences?: { genres: string[]; keywords: string[] } };
export type Review = { userId: string; userName: string; rating: number; comment: string; createdAt?: string };
export type Book = {
  _id: string;
  title: string;
  author: string;
  genre: string[];
  keywords: string[];
  coverImageUrl: string;
  description: string;
  ratingsAvg: number;
  ratingsCount: number;
  reviews: Review[];
};
export type RecommendationDebug = {
  source?: "ml" | "fallback";
  reason?: string;
  profile_chars?: number;
  ratings_events?: number;
  purchase_events?: number;
  search_events?: number;
  bookmark_events?: number;
  books_in_catalog?: number;
  excluded?: number;
  top_n?: number;
  weights?: { content: number; popularity: number; search: number };
  personalized?: boolean;
  generatedAt?: string;
};

export const api = {
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<{ user: User }>("/auth/me"),
  listBooks: (params: { q?: string; genre?: string; mood?: string; mode?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.genre && params.genre !== "All shelves") sp.set("genre", params.genre);
    if (params.mood) sp.set("mood", params.mood);
    if (params.mode) sp.set("mode", params.mode);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return request<{ items: Book[]; page: number; limit: number; total: number }>(`/books?${sp.toString()}`);
  },
  autocomplete: (q: string) =>
    request<{ items: Pick<Book, "_id" | "title" | "author" | "coverImageUrl" | "ratingsAvg">[] }>(
      `/books/autocomplete?q=${encodeURIComponent(q)}`
    ),
  trending: () => request<{ items: Book[] }>("/books/trending"),
  savedBooks: () => request<{ items: Book[]; total: number }>("/books/saved"),
  getBook: (id: string) => request<{ book: Book }>(`/books/${id}`),
  trackSearch: (payload: { query: string; bookId?: string }) =>
    request<{ ok: true }>("/books/track-search", { method: "POST", body: JSON.stringify(payload) }),
  purchase: (bookId: string) => request<{ ok: true }>(`/books/${bookId}/purchase`, { method: "POST", body: "{}" }),
  bookmark: (bookId: string) => request<{ saved: boolean }>(`/books/${bookId}/bookmark`, { method: "POST", body: "{}" }),
  review: (bookId: string, payload: { rating: number; comment?: string }) =>
    request<{ book: Book }>(`/books/${bookId}/review`, { method: "POST", body: JSON.stringify(payload) }),
  activity: () => request<{ activity: any }>("/activity/me"),
  recommendations: (params?: { seedBookId?: string; interest?: string; mood?: string; genre?: string }) => {
    const sp = new URLSearchParams();
    if (params?.seedBookId) sp.set("seedBookId", params.seedBookId);
    if (params?.interest) sp.set("interest", params.interest);
    if (params?.mood) sp.set("mood", params.mood);
    if (params?.genre) sp.set("genre", params.genre);
    const query = sp.toString();
    return request<{ items: Book[]; debug?: RecommendationDebug }>(
      `/recommendations/me${query ? `?${query}` : ""}`
    );
  },
  chatSuggest: (message: string) =>
    request<{ mode: string; reply: string; items: Book[] }>("/chat/suggest", {
      method: "POST",
      body: JSON.stringify({ message })
    })
};
