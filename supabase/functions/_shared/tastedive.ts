// supabase/functions/_shared/tastedive.ts
// Lightweight TasteDive client helpers shared by swipe functions.

export type TasteDiveType = "movie" | "show";

export interface TasteDiveResult {
  Name: string;
  Type: string;
  wTeaser?: string;
  wUrl?: string;
  yUrl?: string;
  yID?: string;
}

interface TasteDiveQueryOptions {
  q: string;
  type: TasteDiveType;
  limit?: number;
  info?: number;
  slimit?: number;
}

export async function fetchTasteDiveSimilar({
  q,
  type,
  limit = 20,
  info = 0,
  slimit = 1,
}: TasteDiveQueryOptions): Promise<TasteDiveResult[]> {
  const apiKey = Deno.env.get("TASTEDIVE_API_KEY");
  if (!apiKey) return [];

  const url = new URL("https://tastedive.com/api/similar");
  url.search = new URLSearchParams({
    q,
    type,
    k: apiKey,
    limit: String(limit),
    info: String(info),
    slimit: String(slimit),
  }).toString();

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const results = json?.Similar?.Results;
    if (Array.isArray(results)) {
      return results as TasteDiveResult[];
    }
  } catch (_err) {
    return [];
  }
  return [];
}

export function buildSortTitle(title: string | null): string | null {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  const stripped = normalized.replace(/^(the |a |an )/i, "").trim();
  return stripped || normalized;
}
