export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString?.() || "http://127.0.0.1:5000/api";

export const CHAT_ENABLED =
  String((import.meta as any).env?.VITE_CHAT_ENABLED ?? "true").toLowerCase() === "true";

