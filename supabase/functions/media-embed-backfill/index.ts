/**
 * media-embed-backfill — Coverage v1
 *
 * Fix: some media_items never get embedded because we previously required tmdb_poster_path IS NOT NULL.
 *
 * New selection:
 * - completeness >= minCompleteness (default 0.60)
 * - kind optional filter
 * - no poster requirement
 *
 * New behavior:
 * - By default, skips items that already have an embedding (same as before)
 * - If reembed=true, it will overwrite existing embeddings (UPSERT all selected rows)
 *
 * Request body (JSON):
 * {
 *   "limit": 200,
 *   "kind": "movie" | "tv" | ... (optional),
 *   "minCompleteness": 0.6 (optional),
 *   "reembed": false (optional)
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

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 500));
    const kindFilter = typeof body.kind === "string" ? body.kind : null;
    const minCompleteness = Math.max(0, Math.min(Number(body.minCompleteness ?? 0.60), 1));
    const reembed = Boolean(body.reembed ?? false);

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
      .gte("completeness", minCompleteness)
      .order("completeness", { ascending: false })
      .limit(limit);

    if (kindFilter) q = q.eq("kind", kindFilter);

    const { data: items, error: itemsErr } = await q;
    if (itemsErr) return json(500, { ok: false, code: "FETCH_FAILED", message: itemsErr.message });
    if (!items?.length) return json(200, { ok: true, embedded: 0, skipped_existing: 0 });

    let todo = items;

    let skippedExisting = 0;
    if (!reembed) {
      const ids = items.map((x: any) => x.id);
      const { data: existing, error: exErr } = await supabase
        .from("media_embeddings")
        .select("media_item_id")
        .in("media_item_id", ids);

      if (exErr) return json(500, { ok: false, code: "EXISTING_CHECK_FAILED", message: exErr.message });

      const have = new Set((existing ?? []).map((r: any) => r.media_item_id));
      todo = items.filter((x: any) => !have.has(x.id));
      skippedExisting = items.length - todo.length;
    }

    if (!todo.length) return json(200, { ok: true, embedded: 0, skipped_existing: skippedExisting });

    const docs = todo.map((mi: any) => buildSwipeDocTSV(mi));

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

    const rows = todo.map((mi: any, i: number) => ({
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
      embedded: rows.length,
      skipped_existing: skippedExisting,
      minCompleteness,
      reembed,
    });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
