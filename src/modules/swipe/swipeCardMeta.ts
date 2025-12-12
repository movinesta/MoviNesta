import type { SwipeCardData, SwipeDeckKind } from "./useSwipeDeck";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Treat "N/A", empty and null as non-existent to save space */
export const cleanText = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === "N/A") return null;
  return trimmed;
};

export const formatRuntime = (minutes?: number | null): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const abbreviateCountry = (value?: string | null): string | null => {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  if (lower === "united states" || lower === "united states of america") return "US";
  if (lower === "united kingdom" || lower === "great britain") return "UK";
  if (lower === "canada") return "CA";
  if (lower === "australia") return "AU";
  if (lower === "germany") return "DE";
  if (lower === "france") return "FR";
  if (lower === "spain") return "ES";
  if (lower === "italy") return "IT";
  if (lower === "japan") return "JP";
  if (lower === "south korea" || lower === "republic of korea") return "KR";
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return cleaned;
};

export const safeNumber = (value?: number | string | null): number | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return null;
    return value;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

export const formatInt = (value?: number | string | null): string | null => {
  const num = safeNumber(value);
  if (num == null) return null;
  return Math.round(num).toLocaleString();
};

export const getSourceLabel = (source?: SwipeDeckKind) => {
  switch (source) {
    case "from-friends":
      return "Friends’ picks";
    case "trending":
      return "Trending now";
    default:
      return "Matched for you";
  }
};

export const buildSwipeCardLabel = (card?: SwipeCardData) => {
  if (!card) return undefined;

  const pieces: string[] = [];
  if (card.year) pieces.push(String(card.year));

  const ratingBits: string[] = [];
  if (typeof card.imdbRating === "number" && !Number.isNaN(card.imdbRating)) {
    ratingBits.push(`IMDb ${card.imdbRating.toFixed(1)}`);
  }
  if (typeof card.rtTomatoMeter === "number" && !Number.isNaN(card.rtTomatoMeter)) {
    ratingBits.push(`${card.rtTomatoMeter}% Rotten Tomatoes`);
  }

  const descriptor = [...pieces, ...ratingBits].filter(Boolean).join(" · ");
  return descriptor ? `${card.title} (${descriptor})` : card.title;
};
