// src/modules/search/titleSorting.ts
import type { TitleSearchResult } from "./search.service";

export type TitleSortKey = "relevance" | "newest" | "rating";

export const parseSortKey = (value: string | null | undefined): TitleSortKey | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "relevance" || v === "newest" || v === "rating") return v;
  return null;
};

export const defaultSortForQuery = (query: string): TitleSortKey =>
  query.trim().length > 0 ? "relevance" : "newest";

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractYearFromQuery = (query: string): number | null => {
  const m = query.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
};

export const computeRelevanceScore = (
  query: string,
  item: Pick<TitleSearchResult, "title" | "source" | "year">,
): number => {
  const q = normalizeText(query);
  if (!q) return 0;

  const t = normalizeText(item.title ?? "");
  if (!t) return 0;

  let score = 0;

  // Exact/prefix/contains weighting.
  if (t === q) score += 1000;
  else if (t.startsWith(q)) score += 850;
  else if (t.includes(` ${q} `))
    score += 780; // whole-word-ish
  else if (t.includes(q)) score += 650;

  // Token overlap boosts.
  const qTokens = q.split(" ").filter((tok) => tok.length >= 2);
  if (qTokens.length) {
    const tTokens = new Set(t.split(" "));
    let matched = 0;
    for (const tok of qTokens) {
      if (tTokens.has(tok)) matched += 1;
      else {
        // Prefix match against any title token.
        for (const tTok of tTokens) {
          if (tTok.startsWith(tok)) {
            matched += 1;
            break;
          }
        }
      }
    }
    score += matched * 35;
  }

  // Year intent (e.g. "dune 2021")
  const yearInQuery = extractYearFromQuery(query);
  if (yearInQuery && item.year) {
    const diff = Math.abs(item.year - yearInQuery);
    if (diff === 0) score += 90;
    else if (diff <= 1) score += 40;
  }

  // Prefer in-library content slightly.
  if (item.source === "library") score += 60;
  else if (item.source === "external-synced") score += 25;

  return score;
};

const ratingValue = (
  item: Pick<TitleSearchResult, "imdbRating" | "rtTomatoMeter">,
): number | null => {
  if (typeof item.imdbRating === "number" && Number.isFinite(item.imdbRating))
    return item.imdbRating;
  if (typeof item.rtTomatoMeter === "number" && Number.isFinite(item.rtTomatoMeter))
    return item.rtTomatoMeter / 10;
  return null;
};

export const sortTitles = (params: {
  items: TitleSearchResult[];
  query: string;
  sortKey: TitleSortKey;
}): TitleSearchResult[] => {
  const { items, query, sortKey } = params;

  // Stable copy.
  const copy = [...items];

  if (sortKey === "newest") {
    copy.sort((a, b) => {
      const ay = a.year ?? -1;
      const by = b.year ?? -1;
      if (by !== ay) return by - ay;
      return a.title.localeCompare(b.title);
    });
    return copy;
  }

  if (sortKey === "rating") {
    copy.sort((a, b) => {
      const ar = ratingValue(a) ?? -1;
      const br = ratingValue(b) ?? -1;
      if (br !== ar) return br - ar;
      const ay = a.year ?? -1;
      const by = b.year ?? -1;
      if (by !== ay) return by - ay;
      return a.title.localeCompare(b.title);
    });
    return copy;
  }

  // Relevance.
  copy.sort((a, b) => {
    const as = computeRelevanceScore(query, a);
    const bs = computeRelevanceScore(query, b);
    if (bs !== as) return bs - as;

    // Tie breakers: rating -> newest -> title
    const ar = ratingValue(a) ?? -1;
    const br = ratingValue(b) ?? -1;
    if (br !== ar) return br - ar;
    const ay = a.year ?? -1;
    const by = b.year ?? -1;
    if (by !== ay) return by - ay;
    return a.title.localeCompare(b.title);
  });
  return copy;
};
