// src/modules/search/recentSearches.ts

const STORAGE_KEY = "movinesta.search.recent";

export type RecentSearchEntry = {
  term: string;
  ts: number; // last used
};

const safeParse = (raw: string | null): RecentSearchEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it) => ({
        term: typeof it?.term === "string" ? it.term : "",
        ts: typeof it?.ts === "number" ? it.ts : 0,
      }))
      .filter((it) => it.term.trim().length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
};

const safeWrite = (items: RecentSearchEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

export const getRecentSearches = (): RecentSearchEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
};

export const addRecentSearch = (term: string, max = 10) => {
  if (typeof window === "undefined") return;
  const cleaned = term.trim();
  if (cleaned.length < 2) return;

  const now = Date.now();
  const existing = getRecentSearches();
  const next: RecentSearchEntry[] = [
    { term: cleaned, ts: now },
    ...existing.filter((e) => e.term.toLowerCase() !== cleaned.toLowerCase()),
  ].slice(0, max);

  safeWrite(next);
  window.dispatchEvent(new CustomEvent("movinesta:recent-searches"));
};

export const removeRecentSearch = (term: string) => {
  if (typeof window === "undefined") return;
  const cleaned = term.trim();
  const existing = getRecentSearches();
  const next = existing.filter((e) => e.term.toLowerCase() !== cleaned.toLowerCase());
  safeWrite(next);
  window.dispatchEvent(new CustomEvent("movinesta:recent-searches"));
};

export const clearRecentSearches = () => {
  if (typeof window === "undefined") return;
  safeWrite([]);
  window.dispatchEvent(new CustomEvent("movinesta:recent-searches"));
};
