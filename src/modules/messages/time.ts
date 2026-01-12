/**
 * Safe timestamp parsing helper.
 *
 * Returns `fallback` (default 0) when the input is null/undefined/invalid.
 *
 * This prevents sort comparators from returning NaN, which can cause unstable ordering.
 */
export const safeTime = (iso: string | null | undefined, fallback = 0): number => {
  const t = new Date(iso ?? "").getTime();
  return Number.isNaN(t) ? fallback : t;
};
