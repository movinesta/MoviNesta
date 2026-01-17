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

export type TasteMatchSummarizeKnobs = {
  // Field score deltas applied when extracting taste from liked/disliked items.
  genre_like_delta: number;
  genre_dislike_delta: number;
  vibe_like_delta: number;
  vibe_dislike_delta: number;
  keyword_like_delta: number;
  keyword_dislike_delta: number;
  era_like_delta: number;
  era_dislike_delta: number;

  // Extraction/compaction knobs.
  keywords_per_item: number;
  score_min_abs: number;
  prefer_genres_take: number;
  prefer_vibes_take: number;
  avoid_value_lt: number;
  avoid_take: number;

  // Profile title caps.
  liked_titles_max: number;
  disliked_titles_max: number;
};

export type TasteMatchQueryCaps = {
  liked_titles_max: number;
  disliked_titles_max: number;
  prefer_genres_max: number;
  prefer_vibes_max: number;
  avoid_max: number;
};

export type TasteMatchDocCaps = {
  genres_max: number;
  vibe_max: number;
  languages_max: number;
  countries_max: number;
  people_max: number;
  keywords_max: number;
};

export type TasteMatchConfig = {
  summarize: TasteMatchSummarizeKnobs;
  query_caps: TasteMatchQueryCaps;
  doc_caps: TasteMatchDocCaps;
};

const DEFAULT_SUMMARIZE: TasteMatchSummarizeKnobs = {
  genre_like_delta: 2,
  genre_dislike_delta: -2,
  vibe_like_delta: 2,
  vibe_dislike_delta: -2,
  keyword_like_delta: 1,
  keyword_dislike_delta: -1,
  era_like_delta: 1,
  era_dislike_delta: -1,

  keywords_per_item: 8,
  score_min_abs: 1,
  prefer_genres_take: 8,
  prefer_vibes_take: 6,
  avoid_value_lt: -2,
  avoid_take: 10,

  liked_titles_max: 6,
  disliked_titles_max: 4,
};

const DEFAULT_QUERY_CAPS: TasteMatchQueryCaps = {
  liked_titles_max: 6,
  disliked_titles_max: 4,
  prefer_genres_max: 10,
  prefer_vibes_max: 8,
  avoid_max: 10,
};

const DEFAULT_DOC_CAPS: TasteMatchDocCaps = {
  genres_max: 8,
  vibe_max: 6,
  languages_max: 3,
  countries_max: 3,
  people_max: 6,
  keywords_max: 12,
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  const v = Math.trunc(x);
  return Math.max(min, Math.min(max, v));
}

function mergeSummarizeKnobs(knobs?: Partial<TasteMatchSummarizeKnobs>): TasteMatchSummarizeKnobs {
  const k = { ...DEFAULT_SUMMARIZE, ...(knobs ?? {}) };

  return {
    ...k,
    genre_like_delta: clampInt(k.genre_like_delta, -10, 10, DEFAULT_SUMMARIZE.genre_like_delta),
    genre_dislike_delta: clampInt(k.genre_dislike_delta, -10, 10, DEFAULT_SUMMARIZE.genre_dislike_delta),
    vibe_like_delta: clampInt(k.vibe_like_delta, -10, 10, DEFAULT_SUMMARIZE.vibe_like_delta),
    vibe_dislike_delta: clampInt(k.vibe_dislike_delta, -10, 10, DEFAULT_SUMMARIZE.vibe_dislike_delta),
    keyword_like_delta: clampInt(k.keyword_like_delta, -10, 10, DEFAULT_SUMMARIZE.keyword_like_delta),
    keyword_dislike_delta: clampInt(k.keyword_dislike_delta, -10, 10, DEFAULT_SUMMARIZE.keyword_dislike_delta),
    era_like_delta: clampInt(k.era_like_delta, -10, 10, DEFAULT_SUMMARIZE.era_like_delta),
    era_dislike_delta: clampInt(k.era_dislike_delta, -10, 10, DEFAULT_SUMMARIZE.era_dislike_delta),

    keywords_per_item: clampInt(k.keywords_per_item, 0, 40, DEFAULT_SUMMARIZE.keywords_per_item),
    score_min_abs: clampInt(k.score_min_abs, 0, 10, DEFAULT_SUMMARIZE.score_min_abs),
    prefer_genres_take: clampInt(k.prefer_genres_take, 0, 30, DEFAULT_SUMMARIZE.prefer_genres_take),
    prefer_vibes_take: clampInt(k.prefer_vibes_take, 0, 30, DEFAULT_SUMMARIZE.prefer_vibes_take),
    avoid_value_lt: Math.max(-100, Math.min(100, Number(k.avoid_value_lt))),
    avoid_take: clampInt(k.avoid_take, 0, 30, DEFAULT_SUMMARIZE.avoid_take),

    liked_titles_max: clampInt(k.liked_titles_max, 0, 20, DEFAULT_SUMMARIZE.liked_titles_max),
    disliked_titles_max: clampInt(k.disliked_titles_max, 0, 20, DEFAULT_SUMMARIZE.disliked_titles_max),
  };
}

function mergeQueryCaps(caps?: Partial<TasteMatchQueryCaps>): TasteMatchQueryCaps {
  const c = { ...DEFAULT_QUERY_CAPS, ...(caps ?? {}) };
  return {
    liked_titles_max: clampInt(c.liked_titles_max, 0, 20, DEFAULT_QUERY_CAPS.liked_titles_max),
    disliked_titles_max: clampInt(c.disliked_titles_max, 0, 20, DEFAULT_QUERY_CAPS.disliked_titles_max),
    prefer_genres_max: clampInt(c.prefer_genres_max, 0, 30, DEFAULT_QUERY_CAPS.prefer_genres_max),
    prefer_vibes_max: clampInt(c.prefer_vibes_max, 0, 30, DEFAULT_QUERY_CAPS.prefer_vibes_max),
    avoid_max: clampInt(c.avoid_max, 0, 30, DEFAULT_QUERY_CAPS.avoid_max),
  };
}

function mergeDocCaps(caps?: Partial<TasteMatchDocCaps>): TasteMatchDocCaps {
  const c = { ...DEFAULT_DOC_CAPS, ...(caps ?? {}) };
  return {
    genres_max: clampInt(c.genres_max, 0, 30, DEFAULT_DOC_CAPS.genres_max),
    vibe_max: clampInt(c.vibe_max, 0, 30, DEFAULT_DOC_CAPS.vibe_max),
    languages_max: clampInt(c.languages_max, 0, 10, DEFAULT_DOC_CAPS.languages_max),
    countries_max: clampInt(c.countries_max, 0, 10, DEFAULT_DOC_CAPS.countries_max),
    people_max: clampInt(c.people_max, 0, 20, DEFAULT_DOC_CAPS.people_max),
    keywords_max: clampInt(c.keywords_max, 0, 50, DEFAULT_DOC_CAPS.keywords_max),
  };
}

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

export function buildRerankDocument(
  mi: MediaItemRow,
  opts?: { titleFallback?: string; caps?: Partial<TasteMatchDocCaps> },
): string {
  const caps = mergeDocCaps(opts?.caps);
  const title = titleFrom(mi, opts?.titleFallback);
  const year = yearFrom(mi);
  const f = extractSwipeDocFields(mi);

  const lines: string[] = [];
  lines.push([title, year ? `(${year})` : "", f.kind ? `— ${f.kind}` : ""].filter(Boolean).join(" "));

  if (f.genres.length) lines.push(`Genres: ${f.genres.slice(0, caps.genres_max).join(", ")}`);
  if (f.macro.length) lines.push(`Vibe: ${f.macro.slice(0, caps.vibe_max).join(", ")}`);
  if (f.era) lines.push(`Era: ${f.era}`);
  if (f.rated) lines.push(`Rated: ${f.rated}`);
  if (f.languages.length) lines.push(`Language: ${f.languages.slice(0, caps.languages_max).join(", ")}`);
  if (f.countries.length) lines.push(`Country: ${f.countries.slice(0, caps.countries_max).join(", ")}`);
  if (f.people.length) lines.push(`People: ${f.people.slice(0, caps.people_max).join(", ")}`);
  if (f.keywords.length) lines.push(`Keywords: ${f.keywords.slice(0, caps.keywords_max).join(", ")}`);
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

function scoreTop(map: Map<string, number>, take: number, minAbs: number): string[] {
  return [...map.entries()]
    .filter(([, v]) => Math.abs(v) >= minAbs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([k]) => k);
}

export function buildTasteQuery(profile: TasteProfile, caps?: Partial<TasteMatchQueryCaps>): string {
  const c = mergeQueryCaps(caps);

  const lines: string[] = [];
  lines.push("User taste profile (for ranking movies/series by taste match):");

  if (profile.likedTitles.length) lines.push(`Liked: ${profile.likedTitles.slice(0, c.liked_titles_max).join(", ")}`);
  if (profile.dislikedTitles.length) lines.push(`Disliked: ${profile.dislikedTitles.slice(0, c.disliked_titles_max).join(", ")}`);
  if (profile.preferGenres.length) lines.push(`Prefer genres: ${profile.preferGenres.slice(0, c.prefer_genres_max).join(", ")}`);
  if (profile.preferVibes.length) lines.push(`Prefer vibe: ${profile.preferVibes.slice(0, c.prefer_vibes_max).join(", ")}`);
  if (profile.avoid.length) lines.push(`Avoid: ${profile.avoid.slice(0, c.avoid_max).join(", ")}`);
  if (profile.era) lines.push(`Prefer era: ${profile.era}`);

  lines.push("Instruction: Rank candidates by best match to the profile and penalize avoided traits.");
  return lines.join("\n");
}

export function summarizeTasteFromItems(
  args: { liked: MediaItemRow[]; disliked: MediaItemRow[] },
  knobs?: Partial<TasteMatchSummarizeKnobs>,
): TasteProfile {
  const k = mergeSummarizeKnobs(knobs);

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

    for (const g of f.genres) genreScore.set(g, (genreScore.get(g) ?? 0) + k.genre_like_delta);
    for (const m of f.macro) vibeScore.set(m, (vibeScore.get(m) ?? 0) + k.vibe_like_delta);
    for (const kw of f.keywords.slice(0, k.keywords_per_item)) {
      avoidScore.set(kw, (avoidScore.get(kw) ?? 0) + k.keyword_like_delta);
    }
    if (f.era) eraScore.set(f.era, (eraScore.get(f.era) ?? 0) + k.era_like_delta);
  }

  for (const mi of args.disliked) {
    const t = titleFrom(mi);
    if (t) dislikedTitles.push(t);
    const f = extractSwipeDocFields(mi);

    for (const g of f.genres) genreScore.set(g, (genreScore.get(g) ?? 0) + k.genre_dislike_delta);
    for (const m of f.macro) vibeScore.set(m, (vibeScore.get(m) ?? 0) + k.vibe_dislike_delta);
    for (const kw of f.keywords.slice(0, k.keywords_per_item)) {
      avoidScore.set(kw, (avoidScore.get(kw) ?? 0) + k.keyword_dislike_delta);
    }
    if (f.era) eraScore.set(f.era, (eraScore.get(f.era) ?? 0) + k.era_dislike_delta);
  }

  const preferGenres = scoreTop(genreScore, k.prefer_genres_take, k.score_min_abs).filter((g) => (genreScore.get(g) ?? 0) > 0);
  const preferVibes = scoreTop(vibeScore, k.prefer_vibes_take, k.score_min_abs).filter((g) => (vibeScore.get(g) ?? 0) > 0);

  // Avoid list: strong negatives from genres/vibes/keywords. Keep it compact.
  const avoid: string[] = [];
  for (const [token, v] of [...genreScore.entries(), ...vibeScore.entries(), ...avoidScore.entries()]) {
    if (v >= k.avoid_value_lt) continue;
    if (avoid.includes(token)) continue;
    avoid.push(token);
    if (avoid.length >= k.avoid_take) break;
  }

  const era = [...eraScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, v]) => v > 0)?.[0];

  return {
    likedTitles: likedTitles.slice(0, k.liked_titles_max),
    dislikedTitles: dislikedTitles.slice(0, k.disliked_titles_max),
    preferGenres,
    preferVibes,
    avoid,
    era,
  };
}
