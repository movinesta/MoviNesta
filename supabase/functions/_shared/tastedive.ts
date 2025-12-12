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

function normalizeTasteDiveResult(raw: any): TasteDiveResult | null {
  const Name =
    typeof raw?.Name === "string" ? raw.Name :
    typeof raw?.name === "string" ? raw.name :
    null;

  const Type =
    typeof raw?.Type === "string" ? raw.Type :
    typeof raw?.type === "string" ? raw.type :
    null;

  if (!Name || !Type) return null;

  const wTeaser =
    typeof raw?.wTeaser === "string" ? raw.wTeaser :
    typeof raw?.description === "string" ? raw.description : // newer lowercase payloads
    undefined;

  return {
    Name,
    Type,
    wTeaser,
    wUrl: typeof raw?.wUrl === "string" ? raw.wUrl : undefined,
    yUrl: typeof raw?.yUrl === "string" ? raw.yUrl : undefined,
    yID: typeof raw?.yID === "string" ? raw.yID : undefined,
  };
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
    info: String(info ? 1 : 0),
    slimit: String(slimit),
  }).toString();

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return [];

    const json = await res.json().catch(() => null);

    // Support both legacy ("Similar"/"Results") and current ("similar"/"results") payloads
    const rawResults =
      json?.Similar?.Results ??
      json?.Similar?.results ??
      json?.similar?.Results ??
      json?.similar?.results;

    if (!Array.isArray(rawResults)) return [];

    return rawResults
      .map(normalizeTasteDiveResult)
      .filter((r): r is TasteDiveResult => Boolean(r));
  } catch {
    return [];
  }
}

export function buildSortTitle(title: string | null): string | null {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  const stripped = normalized.replace(/^(the |a |an )/i, "").trim();
  return stripped || normalized;
}
