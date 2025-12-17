/**
 * media-embed-backfill — No-Filter + Pagination v1
 *
 * Goal: embed ALL rows in media_items (no "poster_path" / completeness gating),
 * while staying reliable (small batches) and debuggable.
 *
 * Default behavior:
 * - embeds ONLY missing items (media_embeddings row absent)
 * - scans ALL media_items (no completeness filter)
 * - batchSize defaults to 60 docs per call to avoid timeouts / payload limits
 *
 * Options:
 * {
 *   "batchSize": 60,          // 1..120
 *   "afterId": "uuid",        // resume cursor (exclusive)
 *   "reembed": false,         // if true, overwrite existing embeddings
 *   "kind": "movie"           // optional filter if you ever want it
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   scanned: number,
 *   embedded: number,
 *   skipped_existing: number,
 *   next_after_id: string | null
 * }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { JINA_API_KEY, JINA_EMBEDDINGS_URL, JINA_MODEL } from "../_shared/config.ts";
import { postJson } from "../_shared/http.ts";
import { buildSwipeDocTSV } from "../_shared/jina_tsv_doc.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type EmbeddingResp = {
  data?: Array<{ embedding: number[] }>;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(n, b));

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const batchSize = clamp(Number(body.batchSize ?? 60), 1, 120);
    const afterId = typeof body.afterId === "string" ? body.afterId : null;
    const reembed = Boolean(body.reembed ?? false);
    const kindFilter = typeof body.kind === "string" ? body.kind : null;

    // Scan by id for stable pagination.
    let q = supabase
      .from("media_items")
      .select(
        [
          "id",
          "kind",
          "tmdb_release_date",
          "tmdb_first_air_date",
          "tmdb_overview",
          "tmdb_original_language",
          "tmdb_raw",
          "omdb_year",
          "omdb_plot",
          "omdb_genre",
          "omdb_language",
          "omdb_country",
          "omdb_actors",
          "omdb_director",
          "omdb_writer",
          "omdb_rated",
          "completeness",
        ].join(","),
      )
      .order("id", { ascending: true })
      .limit(batchSize);

    if (afterId) q = q.gt("id", afterId);
    if (kindFilter) q = q.eq("kind", kindFilter);

    const { data: items, error: itemsErr } = await q;
    if (itemsErr) return json(500, { ok: false, code: "FETCH_FAILED", message: itemsErr.message });
    if (!items?.length) return json(200, { ok: true, scanned: 0, embedded: 0, skipped_existing: 0, next_after_id: null });

    let todo = items as any[];
    let skippedExisting = 0;

    if (!reembed) {
      const ids = todo.map((x) => x.id);
      const { data: existing, error: exErr } = await supabase
        .from("media_embeddings")
        .select("media_item_id")
        .in("media_item_id", ids);

      if (exErr) return json(500, { ok: false, code: "EXISTING_CHECK_FAILED", message: exErr.message });

      const have = new Set((existing ?? []).map((r: any) => r.media_item_id));
      todo = todo.filter((x) => !have.has(x.id));
      skippedExisting = (items.length - todo.length);
    }

    // next cursor based on scan, not on embedded subset
    const nextAfterId = (items.length === batchSize) ? String(items[items.length - 1].id) : null;

    if (!todo.length) {
      return json(200, {
        ok: true,
        scanned: items.length,
        embedded: 0,
        skipped_existing: skippedExisting,
        next_after_id: nextAfterId,
        reembed,
      });
    }

    const docs = todo.map((mi) => buildSwipeDocTSV(mi));

    const resp = (await postJson(
      JINA_EMBEDDINGS_URL,
      { model: JINA_MODEL, input: docs },
      JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {},
    )) as EmbeddingResp;

    const vecs = resp.data?.map((d) => d.embedding) ?? [];
    if (vecs.length !== todo.length) {
      return json(500, {
        ok: false,
        code: "JINA_MISMATCH",
        message: `got ${vecs.length} embeddings for ${todo.length} docs`,
      });
    }

    const rows = todo.map((mi, i) => ({
      media_item_id: mi.id,
      embedding: vecs[i],
      model: JINA_MODEL,
      task: "swipe",
      updated_at: new Date().toISOString(),
      doc: docs[i],
    }));

    const { error: upErr } = await supabase
      .from("media_embeddings")
      .upsert(rows, { onConflict: "media_item_id" });

    if (upErr) return json(500, { ok: false, code: "UPSERT_FAILED", message: upErr.message });

    return json(200, {
      ok: true,
      scanned: items.length,
      embedded: rows.length,
      skipped_existing: skippedExisting,
      next_after_id: nextAfterId,
      reembed,
    });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
