export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString?.() || "/api";

export const CHAT_ENABLED =
  String((import.meta as any).env?.VITE_CHAT_ENABLED ?? "true").toLowerCase() === "true";

