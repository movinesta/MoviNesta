import type { TitleSearchFilters } from "./useSearchTitles";

// Search UI supports a combined "all" mode (titles + people).
export type SearchTabKey = "all" | "titles" | "people" | "news";

const validTypes: TitleSearchFilters["type"][] = ["all", "movie", "series", "anime"];

export const parseTabFromParams = (params: URLSearchParams): SearchTabKey => {
  const tabParam = params.get("tab");
  if (tabParam === "people") return "people";
  if (tabParam === "titles") return "titles";
  if (tabParam === "news") return "news";
  if (tabParam === "all") return "all";
  // Default to the new V2 "all" experience.
  return "all";
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

  const parseYear = (value: string | null) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const minYear = clampYear(parseYear(params.get("minYear")));
  const maxYear = clampYear(parseYear(params.get("maxYear")));
  const originalLanguage = params.get("lang") || undefined;

  if (minYear && maxYear && minYear > maxYear) {
    return { type, minYear: maxYear, maxYear: minYear, originalLanguage };
  }

  return { type, minYear, maxYear, originalLanguage };
};

export const areFiltersEqual = (a: TitleSearchFilters, b: TitleSearchFilters) =>
  a.type === b.type &&
  a.minYear === b.minYear &&
  a.maxYear === b.maxYear &&
  a.originalLanguage === b.originalLanguage;
