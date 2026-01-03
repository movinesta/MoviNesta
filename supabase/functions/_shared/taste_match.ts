import { buildSwipeDocTSV, type MediaItemRow } from "./media_doc_tsv.ts";

export type SwipeDocFields = {
  kind: string;
  era: string;
  genres: string[];
  macro: string[];
  languages: string[];
  countries: string[];
  people: string[];
  rated: string;
  keywords: string[];
  overview: string;
};

function splitPipe(s: string | undefined | null): string[] {
  if (!s) return [];
  return String(s)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitSemi(s: string | undefined | null): string[] {
  if (!s) return [];
  return String(s)
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function extractSwipeDocFields(mi: MediaItemRow): SwipeDocFields {
  const tsv = buildSwipeDocTSV(mi);
  const line = tsv.split("\n")[1] ?? "";
  const [k, era, g, macro, lg, ct, p, rated, kw, o] = line.split("\t");

  return {
    kind: (k ?? "").trim(),
    era: (era ?? "").trim(),
    genres: splitPipe(g),
    macro: splitPipe(macro),
    languages: splitPipe(lg),
    countries: splitPipe(ct),
    people: splitSemi(p),
    rated: (rated ?? "").trim(),
    keywords: splitPipe(kw),
    overview: (o ?? "").trim(),
  };
}

function yearFrom(mi: MediaItemRow): string {
  const d = mi.tmdb_release_date ?? mi.tmdb_first_air_date ?? null;
  if (d) return String(d).slice(0, 4);
  if (mi.omdb_year) return String(mi.omdb_year).slice(0, 4);
  return "";
}

function titleFrom(mi: MediaItemRow, fallback?: string): string {
  const t =
    mi.tmdb_title ??
    mi.tmdb_name ??
    mi.omdb_title ??
    fallback ??
    "";
  return String(t).trim();
}

export function buildRerankDocument(mi: MediaItemRow, opts?: { titleFallback?: string }): string {
  const title = titleFrom(mi, opts?.titleFallback);
  const year = yearFrom(mi);
  const f = extractSwipeDocFields(mi);

  const lines: string[] = [];
  lines.push([title, year ? `(${year})` : "", f.kind ? `— ${f.kind}` : ""].filter(Boolean).join(" "));

  if (f.genres.length) lines.push(`Genres: ${f.genres.slice(0, 8).join(", ")}`);
  if (f.macro.length) lines.push(`Vibe: ${f.macro.slice(0, 6).join(", ")}`);
  if (f.era) lines.push(`Era: ${f.era}`);
  if (f.rated) lines.push(`Rated: ${f.rated}`);
  if (f.languages.length) lines.push(`Language: ${f.languages.slice(0, 3).join(", ")}`);
  if (f.countries.length) lines.push(`Country: ${f.countries.slice(0, 3).join(", ")}`);
  if (f.people.length) lines.push(`People: ${f.people.slice(0, 6).join(", ")}`);
  if (f.keywords.length) lines.push(`Keywords: ${f.keywords.slice(0, 12).join(", ")}`);
  if (f.overview) lines.push(`Overview: ${f.overview}`);

  return lines.join("\n");
}

export type TasteProfile = {
  likedTitles: string[];
  dislikedTitles: string[];
  preferGenres: string[];
  preferVibes: string[];
  avoid: string[];
  era?: string;
};

function scoreTop(map: Map<string, number>, take: number, minAbs = 1): string[] {
  return [...map.entries()]
    .filter(([, v]) => Math.abs(v) >= minAbs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([k]) => k);
}

export function buildTasteQuery(profile: TasteProfile): string {
  const lines: string[] = [];
  lines.push("User taste profile (for ranking movies/series by taste match):");

  if (profile.likedTitles.length) lines.push(`Liked: ${profile.likedTitles.slice(0, 6).join(", ")}`);
  if (profile.dislikedTitles.length) lines.push(`Disliked: ${profile.dislikedTitles.slice(0, 4).join(", ")}`);
  if (profile.preferGenres.length) lines.push(`Prefer genres: ${profile.preferGenres.slice(0, 10).join(", ")}`);
  if (profile.preferVibes.length) lines.push(`Prefer vibe: ${profile.preferVibes.slice(0, 8).join(", ")}`);
  if (profile.avoid.length) lines.push(`Avoid: ${profile.avoid.slice(0, 10).join(", ")}`);
  if (profile.era) lines.push(`Prefer era: ${profile.era}`);

  lines.push("Instruction: Rank candidates by best match to the profile and penalize avoided traits.");
  return lines.join("\n");
}

export function summarizeTasteFromItems(args: {
  liked: MediaItemRow[];
  disliked: MediaItemRow[];
}): TasteProfile {
  const likedTitles: string[] = [];
  const dislikedTitles: string[] = [];

  const genreScore = new Map<string, number>();
  const vibeScore = new Map<string, number>();
  const avoidScore = new Map<string, number>();
  const eraScore = new Map<string, number>();

  for (const mi of args.liked) {
    const t = titleFrom(mi);
    if (t) likedTitles.push(t);
    const f = extractSwipeDocFields(mi);

    for (const g of f.genres) genreScore.set(g, (genreScore.get(g) ?? 0) + 2);
    for (const m of f.macro) vibeScore.set(m, (vibeScore.get(m) ?? 0) + 2);
    for (const k of f.keywords.slice(0, 8)) avoidScore.set(k, (avoidScore.get(k) ?? 0) + 1);
    if (f.era) eraScore.set(f.era, (eraScore.get(f.era) ?? 0) + 1);
  }

  for (const mi of args.disliked) {
    const t = titleFrom(mi);
    if (t) dislikedTitles.push(t);
    const f = extractSwipeDocFields(mi);

    for (const g of f.genres) genreScore.set(g, (genreScore.get(g) ?? 0) - 2);
    for (const m of f.macro) vibeScore.set(m, (vibeScore.get(m) ?? 0) - 2);
    for (const k of f.keywords.slice(0, 8)) avoidScore.set(k, (avoidScore.get(k) ?? 0) - 1);
    if (f.era) eraScore.set(f.era, (eraScore.get(f.era) ?? 0) - 1);
  }

  const preferGenres = scoreTop(genreScore, 8, 1).filter((g) => (genreScore.get(g) ?? 0) > 0);
  const preferVibes = scoreTop(vibeScore, 6, 1).filter((g) => (vibeScore.get(g) ?? 0) > 0);

  // Avoid list: strong negatives from genres/vibes/keywords. Keep it compact.
  const avoid: string[] = [];
  for (const [k, v] of [...genreScore.entries(), ...vibeScore.entries(), ...avoidScore.entries()]) {
    if (v >= -2) continue;
    if (avoid.includes(k)) continue;
    avoid.push(k);
    if (avoid.length >= 10) break;
  }

  const era = [...eraScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, v]) => v > 0)?.[0];

  return {
    likedTitles: likedTitles.slice(0, 6),
    dislikedTitles: dislikedTitles.slice(0, 4),
    preferGenres,
    preferVibes,
    avoid,
    era,
  };
}
