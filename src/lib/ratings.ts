export const rating0_10ToStars = (rating: number | null | undefined): number | null => {
  if (rating == null) return null;
  const n = typeof rating === "number" ? rating : Number(rating);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, n / 2));
};

export const starsToRating0_10 = (stars: number | null | undefined): number | null => {
  if (stars == null) return null;
  const n = typeof stars === "number" ? stars : Number(stars);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, n * 2));
};
