import type { TitleSearchFilters } from "./search.service";
import { defaultSortForQuery, parseSortKey, type TitleSortKey } from "./titleSorting";

// Search UI supports a combined "all" mode (titles + people).
// The top chip bar only exposes: All, Movies, Series, People.
export type SearchTabKey = "all" | "titles" | "people";

// UI only allows filtering by movies/series (plus the implicit "all" in combined mode).
const validTypes: TitleSearchFilters["type"][] = ["all", "movie", "series"];

export const parseTabFromParams = (params: URLSearchParams): SearchTabKey => {
  const tabParam = params.get("tab");
  if (tabParam === "people") return "people";
  if (tabParam === "titles") return "titles";
  if (tabParam === "all") return "all";
  // Default to the new V2 "all" experience.
  return "all";
};

export const parseSortFromParams = (
  params: URLSearchParams,
  queryForDefault: string = "",
): TitleSortKey => {
  const explicit = parseSortKey(params.get("sort"));
  return explicit ?? defaultSortForQuery(queryForDefault);
};

export const clampYear = (value: number | undefined) => {
  if (typeof value !== "number") return undefined;
  const currentYear = new Date().getFullYear();
  const lowerBound = 1900;
  return Math.min(Math.max(value, lowerBound), currentYear);
};

export const parseTitleFiltersFromParams = (params: URLSearchParams): TitleSearchFilters => {
  const typeParam = params.get("type");
  const type = validTypes.includes(typeParam as TitleSearchFilters["type"])
    ? (typeParam as TitleSearchFilters["type"])
    : "all";

  const parseGenreIds = (): number[] | undefined => {
    // Support both `genre=28` and `genres=28,18` (and repeated genres params).
    const rawPieces: string[] = [];
    const single = params.get("genre");
    if (single) rawPieces.push(single);
    const plural = params.getAll("genres");
    if (plural?.length) rawPieces.push(...plural);

    const ids = rawPieces
      .flatMap((value) => value.split(","))
      .map((value) => Number(value.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.floor(n));

    if (!ids.length) return undefined;

    // Deduplicate while preserving order.
    const seen = new Set<number>();
    const unique: number[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }
    return unique;
  };

  const parseYear = (value: string | null) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const minYear = clampYear(parseYear(params.get("minYear")));
  const maxYear = clampYear(parseYear(params.get("maxYear")));
  const originalLanguage = params.get("lang") || undefined;
  const genreIds = parseGenreIds();

  if (minYear && maxYear && minYear > maxYear) {
    return { type, minYear: maxYear, maxYear: minYear, originalLanguage, genreIds };
  }

  return { type, minYear, maxYear, originalLanguage, genreIds };
};

export const areFiltersEqual = (a: TitleSearchFilters, b: TitleSearchFilters) =>
  a.type === b.type &&
  a.minYear === b.minYear &&
  a.maxYear === b.maxYear &&
  a.originalLanguage === b.originalLanguage &&
  (a.genreIds?.length ?? 0) === (b.genreIds?.length ?? 0) &&
  (a.genreIds ?? []).every((id) => (b.genreIds ?? []).includes(id));

export const hasActiveTitleFilters = (filters: TitleSearchFilters | null | undefined) => {
  if (!filters) return false;
  if (filters.type && filters.type !== "all") return true;
  if (typeof filters.minYear === "number") return true;
  if (typeof filters.maxYear === "number") return true;
  if (filters.originalLanguage) return true;
  if (filters.genreIds?.length) return true;
  return false;
};
