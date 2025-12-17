/**
 * media-embed-backfill — Log Error Body v1
 *
 * Problem:
 * - pg_net / cron logs only show "POST | 500" and not the response JSON body.
 *
 * Fix:
 * - Every non-2xx response body is ALSO printed to function logs as:
 *     MEDIA_EMBED_BACKFILL_ERROR {json...}
 * - This makes the real cause visible in Supabase Function Logs.
 *
 * Keeps:
 * - pagination (afterId)
 * - batchSize (default 30)
 * - retries + dim check
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { JINA_API_KEY, JINA_EMBEDDINGS_URL, JINA_MODEL, JINA_DIM } from "../_shared/config.ts";
import { postJson } from "../_shared/http.ts";
import { buildSwipeDocTSV } from "../_shared/jina_tsv_doc.ts";

type EmbeddingResp = {
  data?: Array<{ embedding: number[] }>;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(n, b));

function respond(status: number, body: any) {
  if (status >= 400) {
    // Make sure errors are visible even when caller doesn't capture response body (pg_net).
    console.error("MEDIA_EMBED_BACKFILL_ERROR", JSON.stringify(body));
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function callJina(docs: string[]): Promise<number[][]> {
  const headers = JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {};
  const payload = { model: JINA_MODEL, input: docs };

  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = (await postJson(JINA_EMBEDDINGS_URL, payload, headers)) as EmbeddingResp;
      return resp.data?.map((d) => d.embedding) ?? [];
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(attempt === 1 ? 250 : 600);
    }
  }

  throw lastErr ?? new Error("Unknown Jina error");
}

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const batchSize = clamp(Number(body.batchSize ?? 30), 1, 120);
    const afterId = typeof body.afterId === "string" ? body.afterId : null;
    const reembed = Boolean(body.reembed ?? false);
    const kindFilter = typeof body.kind === "string" ? body.kind : null;

    console.log("MEDIA_EMBED_BACKFILL_START", JSON.stringify({ batchSize, afterId, reembed, kindFilter }));

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
    if (itemsErr) return respond(500, { ok: false, code: "FETCH_FAILED", message: itemsErr.message });
    if (!items?.length) {
      return respond(200, { ok: true, scanned: 0, embedded: 0, skipped_existing: 0, next_after_id: null });
    }

    let todo = items as any[];
    let skippedExisting = 0;

    if (!reembed) {
      const ids = todo.map((x) => x.id);
      const { data: existing, error: exErr } = await supabase
        .from("media_embeddings")
        .select("media_item_id")
        .in("media_item_id", ids);

      if (exErr) return respond(500, { ok: false, code: "EXISTING_CHECK_FAILED", message: exErr.message });

      const have = new Set((existing ?? []).map((r: any) => r.media_item_id));
      todo = todo.filter((x) => !have.has(x.id));
      skippedExisting = items.length - todo.length;
    }

    const nextAfterId = items.length === batchSize ? String(items[items.length - 1].id) : null;

    if (!todo.length) {
      console.log("MEDIA_EMBED_BACKFILL_SKIP_ALL_EXISTING", JSON.stringify({ scanned: items.length, nextAfterId }));
      return respond(200, {
        ok: true,
        scanned: items.length,
        embedded: 0,
        skipped_existing: skippedExisting,
        next_after_id: nextAfterId,
        reembed,
      });
    }

    const docs = todo.map((mi) => buildSwipeDocTSV(mi));

    let vecs: number[][];
    try {
      vecs = await callJina(docs);
    } catch (err) {
      return respond(500, {
        ok: false,
        code: "JINA_CALL_FAILED",
        message: String((err as any)?.message ?? err),
        model: JINA_MODEL,
        url: JINA_EMBEDDINGS_URL,
        batchSize: docs.length,
        next_after_id: nextAfterId,
      });
    }

    if (vecs.length !== todo.length) {
      return respond(500, {
        ok: false,
        code: "JINA_MISMATCH",
        message: `got ${vecs.length} embeddings for ${todo.length} docs`,
        model: JINA_MODEL,
        next_after_id: nextAfterId,
      });
    }

    const expectedDim = Number.isFinite(JINA_DIM) && JINA_DIM > 0 ? JINA_DIM : 1024;
    const badDim = vecs.findIndex((v) => (Array.isArray(v) ? v.length : 0) !== expectedDim);
    if (badDim !== -1) {
      return respond(500, {
        ok: false,
        code: "EMBEDDING_DIM_MISMATCH",
        message: `embedding dim mismatch at index ${badDim}: got ${vecs[badDim]?.length}, expected ${expectedDim}`,
        model: JINA_MODEL,
        next_after_id: nextAfterId,
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

    if (upErr) {
      return respond(500, {
        ok: false,
        code: "UPSERT_FAILED",
        message: upErr.message,
        hint: "Check that media_embeddings has UNIQUE(media_item_id).",
        next_after_id: nextAfterId,
      });
    }

    console.log("MEDIA_EMBED_BACKFILL_OK", JSON.stringify({ scanned: items.length, embedded: rows.length, nextAfterId }));

    return respond(200, {
      ok: true,
      scanned: items.length,
      embedded: rows.length,
      skipped_existing: skippedExisting,
      next_after_id: nextAfterId,
      reembed,
    });
  } catch (err) {
    return respond(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
