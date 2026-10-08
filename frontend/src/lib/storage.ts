const TOKEN_KEY = "bookrec_token";
const THEME_KEY = "bookrec_theme";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  const t = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "dark";
  return t === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
}

