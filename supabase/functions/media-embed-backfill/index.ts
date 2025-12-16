// supabase/functions/media-embed-backfill/index.ts
//
// Backfills public.media_embeddings from public.media_items using Jina Embeddings API.
// Safe to run repeatedly: it only processes rows missing embeddings, and upserts on media_item_id.
//
// Auth:
// - Keep "verify_jwt" enabled for this function and call it with a Supabase JWT (anon/service key).
//
// Required Edge secret:
// - JINA_API_KEY
//
// Optional Edge secrets:
// - JINA_EMBED_MODEL (default: jina-embeddings-v3)
// - JINA_EMBED_TASK  (default: retrieval.passage)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient } from "../_shared/supabase.ts";

type MediaItemRow = {
  id: string;
  kind: string | null;
  completeness: number | null;

  tmdb_title: string | null;
  tmdb_name: string | null;
  omdb_title: string | null;

  tmdb_overview: string | null;
  omdb_plot: string | null;

  omdb_genre: string | null;
  tmdb_genre_ids: string[] | null;

  omdb_actors: string | null;
  omdb_director: string | null;

  tmdb_release_date: string | null;
  tmdb_first_air_date: string | null;

  tmdb_original_language: string | null;
  omdb_language: string | null;

  omdb_country: string | null;

  // left-joined relation placeholder
  media_embeddings?: { media_item_id: string }[] | null;
};

const ReqSchema = z.object({
  limit: z.number().int().positive().max(2000).optional().default(120),
  batchSize: z.number().int().positive().max(256).optional().default(32),
  completenessMin: z.number().min(0).max(1).optional().default(0.7),

  model: z.string().optional().default(Deno.env.get("JINA_EMBED_MODEL") ?? "jina-embeddings-v3"),
  task: z.string().optional().default(Deno.env.get("JINA_EMBED_TASK") ?? "retrieval.passage"),
  dimensions: z.number().int().positive().optional().default(1024),

  normalized: z.boolean().optional().default(true),
  embeddingType: z.enum(["float", "binary", "ubinary", "base64"]).optional().default("float"),

  dryRun: z.boolean().optional().default(false),
});

function coalesceTitle(row: MediaItemRow): string | null {
  return row.tmdb_title ?? row.tmdb_name ?? row.omdb_title ?? null;
}

function coalesceOverview(row: MediaItemRow): string | null {
  return row.tmdb_overview ?? row.omdb_plot ?? null;
}

function buildEmbeddingText(row: MediaItemRow): string {
  const title = coalesceTitle(row) ?? "Unknown title";
  const overview = coalesceOverview(row) ?? "";

  const genre = row.omdb_genre ?? (row.tmdb_genre_ids ? row.tmdb_genre_ids.join(",") : null);
  const actors = row.omdb_actors;
  const director = row.omdb_director;

  const date = row.tmdb_release_date ?? row.tmdb_first_air_date ?? null;
  const lang = row.tmdb_original_language ?? row.omdb_language ?? null;
  const country = row.omdb_country ?? null;
  const kind = row.kind ?? null;

  const parts: string[] = [];
  parts.push(`Title: ${title}`);
  if (kind) parts.push(`Kind: ${kind}`);
  if (date) parts.push(`Release: ${date}`);
  if (genre) parts.push(`Genre: ${genre}`);
  if (lang) parts.push(`Language: ${lang}`);
  if (country) parts.push(`Country: ${country}`);
  if (director) parts.push(`Director: ${director}`);
  if (actors) parts.push(`Actors: ${actors}`);
  if (overview) parts.push(`Overview: ${overview}`);

  return parts.join("\n");
}

function vectorToSqlLiteral(vec: number[]): string {
  // pgvector accepts a bracketed list: [0.1,0.2,...]
  return `[${vec.join(",")}]`;
}

async function jinaEmbedMany(args: {
  apiKey: string;
  model: string;
  task: string;
  dimensions: number;
  normalized: boolean;
  embeddingType: "float" | "binary" | "ubinary" | "base64";
  input: string[];
}): Promise<number[][]> {
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      task: args.task,
      dimensions: args.dimensions,
      normalized: args.normalized,
      embedding_type: args.embeddingType,
      input: args.input,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Jina embeddings failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = JSON.parse(text);

  // OpenAI-compatible shape: { data: [{ embedding: number[], index: 0, object: "embedding" }], model, usage }
  const data = json?.data;
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected Jina response shape (missing data[]): ${text.slice(0, 500)}`);
  }

  const embeddings: number[][] = data.map((d: any) => d?.embedding).filter((e: any) => Array.isArray(e));
  if (embeddings.length !== args.input.length) {
    throw new Error(`Jina returned ${embeddings.length} embeddings for ${args.input.length} inputs`);
  }

  return embeddings;
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const parsed = await validateRequest(req, (body) => ReqSchema.parse(body), { logPrefix: "[media-embed-backfill]" });
  if (parsed.errorResponse) return parsed.errorResponse;
  const cfg = parsed.data;

  const apiKey = Deno.env.get("JINA_API_KEY");
  if (!apiKey) return jsonError("Missing Edge secret: JINA_API_KEY", 500, "MISSING_JINA_API_KEY");

  const admin = getAdminClient(req);

  const { data: rows, error } = await admin
    .from("media_items")
    .select(`
      id,
      kind,
      completeness,
      tmdb_title,
      tmdb_name,
      omdb_title,
      tmdb_overview,
      omdb_plot,
      omdb_genre,
      tmdb_genre_ids,
      omdb_actors,
      omdb_director,
      tmdb_release_date,
      tmdb_first_air_date,
      tmdb_original_language,
      omdb_language,
      omdb_country,
      media_embeddings!left(media_item_id)
    `)
    .gte("completeness", cfg.completenessMin)
    .is("media_embeddings.media_item_id", null)
    .order("completeness", { ascending: false })
    .limit(cfg.limit);

  if (error) {
    log.error("[media-embed-backfill] select error", error);
    return jsonError(`DB select failed: ${error.message}`, 500, "DB_SELECT_FAILED");
  }

  const items = (rows ?? []) as MediaItemRow[];
  if (items.length === 0) {
    return jsonResponse({ ok: true, message: "No items missing embeddings.", selected: 0, embedded: 0, skipped: 0 });
  }

  // Build texts, skipping rows with almost no useful content.
  const payload: { media_item_id: string; text: string }[] = [];
  let skipped = 0;

  for (const it of items) {
    const title = coalesceTitle(it);
    const overview = coalesceOverview(it);

    // Require at least a title, and at least some description (or rich metadata) to avoid garbage vectors.
    const hasSomeText =
      (overview && overview.trim().length >= 20) ||
      (it.omdb_genre && it.omdb_genre.trim().length > 0) ||
      (it.omdb_actors && it.omdb_actors.trim().length > 0);

    if (!title || !hasSomeText) {
      skipped += 1;
      continue;
    }

    payload.push({ media_item_id: it.id, text: buildEmbeddingText(it) });
  }

  if (payload.length === 0) {
    return jsonResponse({ ok: true, message: "Selected rows had insufficient metadata.", selected: items.length, embedded: 0, skipped });
  }

  const batches: Array<typeof payload> = [];
  for (let i = 0; i < payload.length; i += cfg.batchSize) {
    batches.push(payload.slice(i, i + cfg.batchSize));
  }

  let embedded = 0;
  const failures: Array<{ media_item_id: string; error: string }> = [];

  for (const batch of batches) {
    try {
      const embeddings = await jinaEmbedMany({
        apiKey,
        model: cfg.model,
        task: cfg.task,
        dimensions: cfg.dimensions,
        normalized: cfg.normalized,
        embeddingType: cfg.embeddingType,
        input: batch.map((b) => b.text),
      });

      // Validate dims before writing.
      for (const vec of embeddings) {
        if (!Array.isArray(vec) || vec.length !== cfg.dimensions) {
          throw new Error(`Embedding dimension mismatch: expected ${cfg.dimensions}, got ${Array.isArray(vec) ? vec.length : "non-array"}`);
        }
      }

      const upserts = batch.map((b, idx) => ({
        media_item_id: b.media_item_id,
        embedding: vectorToSqlLiteral(embeddings[idx]!),
        model: cfg.model,
        task: cfg.task,
        updated_at: new Date().toISOString(),
      }));

      if (!cfg.dryRun) {
        const { error: upErr } = await admin.from("media_embeddings").upsert(upserts, { onConflict: "media_item_id" });
        if (upErr) throw upErr;
      }

      embedded += upserts.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const b of batch) failures.push({ media_item_id: b.media_item_id, error: msg });
    }
  }

  const ok = failures.length === 0;

  return jsonResponse(
    {
      ok,
      selected: items.length,
      queued: payload.length,
      embedded,
      skipped,
      failures: failures.slice(0, 50),
      config: cfg,
    },
    ok ? 200 : 207,
  );
});
