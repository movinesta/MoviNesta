\
/**
 * Jina Similarity Upgrade — SwipeDoc TSV v3
 *
 * Implements improvements 1..6:
 * 1) Genre normalization + macro tags
 * 2) People as first-class with top-billed ordering (a1/a2/a3)
 * 3) Keyword compression (kw=) extracted from overview/plot
 * 4) Shorter overview (o<=650 chars) + kw to reduce noise
 * 5) Add rated + era tokens
 * 6) Canonical language format (ISO-ish)
 *
 * TSV Columns:
 *   k  era  g  macro  lg  ct  p  rated  kw  o
 *
 * Notes:
 * - Keeps token budget low by capping list sizes and overview length.
 * - Still uses ONLY media_items fields.
 */

export type MediaItemRow = Record<string, any>;

function clean(s: string): string {
  return String(s ?? "")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lowerClean(s: string): string {
  return clean(s).toLowerCase();
}

function uniqLimit(list: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = lowerClean(raw);
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function splitCsv(s?: string | null): string[] {
  if (!s) return [];
  return String(s)
    .split(/[,|]/g)
    .map((x) => clean(x))
    .filter(Boolean);
}

function yearFromDate(d?: string | null): number | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function eraFromYear(y?: number | null): string {
  if (!y || !Number.isFinite(y)) return "";
  const decade = Math.floor(y / 10) * 10;
  return `${decade}s`;
}

const GENRE_MAP: Record<string, string> = {
  "sci-fi": "science fiction",
  "sci fi": "science fiction",
  "science-fiction": "science fiction",
  "rom-com": "romantic comedy",
  "rom com": "romantic comedy",
  "tv movie": "tv",
  "talk-show": "talk show",
};

function normGenre(g: string): string {
  const v = lowerClean(g);
  return GENRE_MAP[v] ?? v;
}

function genresFrom(mi: MediaItemRow): string[] {
  try {
    const raw = mi.tmdb_raw;
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    const arr = obj?.details?.genres;
    if (Array.isArray(arr)) {
      const names = arr.map((x: any) => String(x?.name ?? "")).filter(Boolean);
      if (names.length) return names;
    }
  } catch {
    // ignore
  }
  return splitCsv(mi.omdb_genre);
}

function macroTags(genres: string[], overview: string): string[] {
  const g = new Set(genres.map(normGenre));
  const o = lowerClean(overview);

  const tags: string[] = [];

  const has = (needle: string) => o.includes(needle);

  // very small curated mapping (token-cheap but helpful)
  if (g.has("horror") || has("haunted") || has("demon") || has("killer")) tags.push("dark");
  if (g.has("thriller") || g.has("crime") || has("murder") || has("detective")) tags.push("tense");
  if (g.has("family") || g.has("animation")) tags.push("family");
  if (g.has("comedy")) tags.push("comedy");
  if (g.has("romance") || g.has("romantic comedy")) tags.push("romance");
  if (g.has("action") || has("explosion") || has("assassin")) tags.push("action");
  if (g.has("drama")) tags.push("drama");
  if (g.has("science fiction") || g.has("fantasy")) tags.push("speculative");

  // tone hints
  if (has("coming-of-age") || has("teen")) tags.push("youth");
  if (has("war") || g.has("war")) tags.push("war");
  if (has("based on true")) tags.push("true-story");
  if (has("superhero") || has("gotham") || has("dc") || has("marvel")) tags.push("comic");

  return uniqLimit(tags, 4);
}

function languagesISO(mi: MediaItemRow): string[] {
  const out: string[] = [];
  if (mi.tmdb_original_language) out.push(String(mi.tmdb_original_language));

  // omdb_language contains names; map a few common ones cheaply, otherwise drop.
  const omdb = splitCsv(mi.omdb_language);
  for (const lang of omdb) {
    const v = lowerClean(lang);
    if (v === "english") out.push("en");
    else if (v === "german") out.push("de");
    else if (v === "french") out.push("fr");
    else if (v === "spanish") out.push("es");
    else if (v === "japanese") out.push("ja");
    else if (v === "korean") out.push("ko");
    else if (v === "arabic") out.push("ar");
    // else ignore to keep it canonical + cheap
  }
  return out;
}

function countries(mi: MediaItemRow): string[] {
  const out: string[] = [];
  try {
    const raw = mi.tmdb_raw;
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    const arr = obj?.details?.origin_country;
    if (Array.isArray(arr)) out.push(...arr.map((x: any) => String(x)));
  } catch {
    // ignore
  }
  // OMDB uses full names; keep only 2-letter-ish tokens if present, else take first word initials is noisy -> skip
  // So we keep just the tmdb country codes plus a few hard-mapped countries.
  const omdb = splitCsv(mi.omdb_country);
  for (const c of omdb) {
    const v = lowerClean(c);
    if (v === "united states" || v === "united states of america") out.push("us");
    else if (v === "united kingdom") out.push("uk");
    else if (v === "japan") out.push("jp");
    else if (v === "south korea") out.push("kr");
    else if (v === "canada") out.push("ca");
    else if (v === "france") out.push("fr");
    else if (v === "germany") out.push("de");
    else if (v === "australia") out.push("au");
  }
  return out;
}

function peopleTokens(mi: MediaItemRow): string[] {
  const toks: string[] = [];
  const actors = splitCsv(mi.omdb_actors).slice(0, 10);
  actors.forEach((a, idx) => {
    const tag = idx === 0 ? "a1" : idx === 1 ? "a2" : idx === 2 ? "a3" : "a";
    toks.push(`${tag}:${a}`);
  });

  splitCsv(mi.omdb_director).slice(0, 1).forEach((d) => toks.push(`d:${d}`));
  splitCsv(mi.omdb_writer).slice(0, 3).forEach((w) => toks.push(`w:${w}`));

  return uniqLimit(toks, 12);
}

const STOP = new Set([
  "the","and","a","an","to","of","in","on","at","for","from","with","by","is","it","this","that","as","into","their",
  "his","her","its","they","them","he","she","we","you","i","was","were","are","be","been","being","over","under","after",
  "before","during","while","when","where","who","whom","which","what","why","how","but","or","nor","so","than","then",
  "about","through","across","between","within","without","against","up","down","out","off","again","once","also",
]);

function keywordExtract(text: string, max: number): string[] {
  const t = lowerClean(text);
  if (!t) return [];
  const words = t
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/g)
    .filter(Boolean)
    .filter((w) => w.length >= 4 && w.length <= 18)
    .filter((w) => !STOP.has(w));

  if (!words.length) return [];

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  // favor multiword-ish tokens (hyphenated) slightly
  const scored = Array.from(freq.entries()).map(([w, c]) => ({
    w,
    s: c + (w.includes("-") ? 0.5 : 0),
  }));

  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, max).map((x) => x.w);
}

export function buildSwipeDocTSV(mi: MediaItemRow): string {
  const k = clean(String(mi.kind ?? "unknown"));

  const y =
    yearFromDate(mi.tmdb_release_date) ??
    yearFromDate(mi.tmdb_first_air_date) ??
    (mi.omdb_year ? Number(String(mi.omdb_year).slice(0, 4)) : null);

  const era = eraFromYear(y);

  const rawOverview = clean(String(mi.tmdb_overview ?? "")) || clean(String(mi.omdb_plot ?? ""));
  const o = rawOverview.slice(0, 650);

  const g = uniqLimit(genresFrom(mi).map(normGenre), 6).join("|");

  const macro = macroTags(genresFrom(mi), rawOverview).join("|");

  const lg = uniqLimit(languagesISO(mi), 4).join("|");

  const ct = uniqLimit(countries(mi), 4).join("|");

  const p = peopleTokens(mi).join(";");

  const rated = mi.omdb_rated ? lowerClean(mi.omdb_rated) : "";

  const kw = uniqLimit(keywordExtract(rawOverview, 12), 12).join("|");

  return [
    "k\tera\tg\tmacro\tlg\tct\tp\trated\tkw\to",
    `${k}\t${era}\t${g}\t${macro}\t${lg}\t${ct}\t${p}\t${rated}\t${kw}\t${clean(o)}`,
  ].join("\n");
}
