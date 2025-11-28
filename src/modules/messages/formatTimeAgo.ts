/**
 * Lightweight "time ago" formatter used across messaging surfaces.
 *
 * - Returns null for missing/invalid inputs so callers can fallback gracefully.
 * - Future timestamps are clamped to "Just now" to avoid confusing labels.
 */
export const formatTimeAgo = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs <= 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks} wk${diffWeeks === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} mo${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} yr${diffYears === 1 ? "" : "s"} ago`;
};
