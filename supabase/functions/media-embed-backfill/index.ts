/**
 * media-embed-backfill — Multi-provider embeddings (Jina / OpenAI / Voyage) + per-profile cursor
 *
 * Purpose:
 * - Batch-embed media_items into public.media_embeddings
 * - Supports multiple providers independently by writing rows keyed by:
 *   (media_item_id, provider, model, dimensions, task)
 * - Uses public.media_job_state cursor, keyed per embedding profile to avoid collisions.
 *
 * Inputs (JSON):
 * {
 *   provider?: "jina" | "openai" | "voyage",
 *   model?: string,
 *   dimensions?: number,
 *   task?: string,
 *   batchSize?: number,
 *   afterId?: string,
 *   kind?: string,
 *   reembed?: boolean,
 *   useSavedCursor?: boolean,
 *   jobName?: string
 * }
 *
 * Notes:
 * - Cursor is only saved after:
 *   (a) successful UPSERT, or
 *   (b) "skip all existing" page (to avoid infinite loops).
 *   Cursor is NOT advanced on embedding call failures (prevents skipping).
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
  JINA_API_KEY,
  JINA_EMBEDDINGS_URL,
  JINA_MODEL,
  JINA_DIM,
  OPENAI_API_KEY,
  OPENAI_EMBEDDINGS_URL,
  OPENAI_MODEL,
  OPENAI_DIM,
  VOYAGE_EMBED_MODEL,
  VOYAGE_DIM,
} from "../_shared/config.ts";

import { postJson } from "../_shared/http.ts";
import { buildSwipeDocTSV } from "../_shared/jina_tsv_doc.ts";
import { voyageEmbed } from "../_shared/voyage.ts";

type Provider = "jina" | "openai" | "voyage";

type JinaEmbeddingResp = { data?: Array<{ embedding: number[] }> };
type OpenAIEmbeddingResp = { data?: Array<{ embedding: number[] }> };

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(n, b));

function respond(status: number, body: any) {
  if (status >= 400) console.error("MEDIA_EMBED_BACKFILL_ERROR", JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function makeJobName(profile: {
  provider: Provider;
  model: string;
  dimensions: number;
  task: string;
  kind: string | null;
}): string {
  const base =
    `media-embed-backfill|provider=${profile.provider}|model=${profile.model}|dim=${profile.dimensions}|task=${profile.task}|kind=${profile.kind ?? ""}`;
  if (base.length <= 180) return base;
  return `${base.slice(0, 160)}|h=${fnv1a32(base)}`;
}

async function callJina(docs: string[], model: string): Promise<number[][]> {
  const headers = JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {};
  const payload = { model, input: docs };

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = (await postJson(JINA_EMBEDDINGS_URL, payload, headers)) as JinaEmbeddingResp;
      return resp.data?.map((d) => d.embedding) ?? [];
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(attempt === 1 ? 250 : 600);
    }
  }
  throw lastErr ?? new Error("Unknown Jina error");
}

async function callOpenAI(docs: string[], model: string, dimensions: number): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const headers = { Authorization: `Bearer ${OPENAI_API_KEY}` };
  const payload: Record<string, unknown> = { model, input: docs };

  // OpenAI embedding models support optional `dimensions` (especially useful to force 1024)
  if (Number.isFinite(dimensions) && dimensions > 0) payload.dimensions = dimensions;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = (await postJson(OPENAI_EMBEDDINGS_URL, payload, headers)) as OpenAIEmbeddingResp;
      return resp.data?.map((d) => d.embedding) ?? [];
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(attempt === 1 ? 300 : 900);
    }
  }
  throw lastErr ?? new Error("Unknown OpenAI error");
}

async function callVoyage(docs: string[], model: string, dimensions: number): Promise<number[][]> {
  const { embeddings } = await voyageEmbed(docs, {
    model,
    inputType: "document",
    outputDimension: Number.isFinite(dimensions) && dimensions > 0 ? dimensions : null,
    truncation: true,
  });
  return embeddings;
}

async function getSavedCursor(supabase: any, jobName: string): Promise<string | null> {
  // Primary lookup: per-profile jobName
  const { data, error } = await supabase
    .from("media_job_state")
    .select("cursor")
    .eq("job_name", jobName)
    .maybeSingle();

  if (error) {
    console.warn("MEDIA_EMBED_BACKFILL_WARN cursor read failed:", error.message);
    return null;
  }

  if (data?.cursor) return String(data.cursor);

  // Back-compat: if the old single cursor exists, we can read it once,
  // but we will always save back into the per-profile jobName.
  if (jobName !== "media-embed-backfill") {
    const { data: legacy, error: legErr } = await supabase
      .from("media_job_state")
      .select("cursor")
      .eq("job_name", "media-embed-backfill")
      .maybeSingle();

    if (!legErr && legacy?.cursor) return String(legacy.cursor);
  }

  return null;
}

async function saveCursor(supabase: any, jobName: string, cursor: string | null): Promise<boolean> {
  const { error } = await supabase
    .from("media_job_state")
    .upsert(
      { job_name: jobName, cursor, updated_at: new Date().toISOString() },
      { onConflict: "job_name" },
    );

  if (error) {
    console.warn("MEDIA_EMBED_BACKFILL_WARN cursor save failed:", error.message);
    return false;
  }
  return true;
}

function normalizeProvider(x: unknown): Provider {
  const p = typeof x === "string" ? x.toLowerCase().trim() : "jina";
  if (p === "openai") return "openai";
  if (p === "voyage") return "voyage";
  return "jina";
}

function defaultModelFor(provider: Provider): string {
  if (provider === "openai") return OPENAI_MODEL;
  if (provider === "voyage") return VOYAGE_EMBED_MODEL;
  return JINA_MODEL;
}

function defaultDimFor(provider: Provider): number {
  if (provider === "openai") return Number.isFinite(OPENAI_DIM) && OPENAI_DIM > 0 ? OPENAI_DIM : 1024;
  if (provider === "voyage") return Number.isFinite(VOYAGE_DIM) && VOYAGE_DIM > 0 ? VOYAGE_DIM : 1024;
  return Number.isFinite(JINA_DIM) && JINA_DIM > 0 ? JINA_DIM : 1024;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const batchSize = clamp(Number(body.batchSize ?? 32), 1, 256);

    const provider = normalizeProvider(body.provider);
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : defaultModelFor(provider);
    const dimensions = clamp(Number(body.dimensions ?? defaultDimFor(provider)), 1, 4096);

    const task = typeof body.task === "string" && body.task.trim() ? body.task.trim() : "swipe";
    const reembed = Boolean(body.reembed ?? false);
    const kindFilter = typeof body.kind === "string" ? body.kind : null;

    const useSavedCursor = body.useSavedCursor === false ? false : true;
    const explicitAfterId = typeof body.afterId === "string" && body.afterId ? body.afterId : null;

    const derivedJobName = makeJobName({ provider, model, dimensions, task, kind: kindFilter });
    const jobName = typeof body.jobName === "string" && body.jobName.trim() ? body.jobName.trim() : derivedJobName;

    const savedCursor = useSavedCursor && !explicitAfterId ? await getSavedCursor(supabase, jobName) : null;
    const usedAfterId = explicitAfterId ?? savedCursor;

    console.log(
      "MEDIA_EMBED_BACKFILL_START",
      JSON.stringify({
        jobName,
        provider,
        model,
        dimensions,
        task,
        batchSize,
        afterId: usedAfterId,
        reembed,
        kindFilter,
        useSavedCursor,
      }),
    );

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

    if (usedAfterId) q = q.gt("id", usedAfterId);
    if (kindFilter) q = q.eq("kind", kindFilter);

    const { data: items, error: itemsErr } = await q;
    if (itemsErr) return respond(500, { ok: false, code: "FETCH_FAILED", message: itemsErr.message });

    if (!items?.length) {
      const cursorSaved = useSavedCursor ? await saveCursor(supabase, jobName, null) : false;
      return respond(200, {
        ok: true,
        scanned: 0,
        embedded: 0,
        skipped_existing: 0,
        next_after_id: null,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
        provider,
        model,
        dimensions,
        task,
        reembed,
      });
    }

    const nextAfterId = items.length === batchSize ? String(items[items.length - 1].id) : null;

    // Build docs
    const docs = items.map((mi: any) => buildSwipeDocTSV(mi));
    let todo = items.map((mi: any, i: number) => ({ ...mi, __doc: docs[i] }));

    // Skip existing rows for this *profile* unless reembed=true
    let skippedExisting = 0;
    if (!reembed) {
      const ids = todo.map((x: any) => x.id);
      const { data: existing, error: exErr } = await supabase
        .from("media_embeddings")
        .select("media_item_id")
        .eq("provider", provider)
        .eq("model", model)
        .eq("dimensions", dimensions)
        .eq("task", task)
        .in("media_item_id", ids);

      if (exErr) return respond(500, { ok: false, code: "EXISTING_CHECK_FAILED", message: exErr.message });

      const have = new Set((existing ?? []).map((r: any) => r.media_item_id));
      todo = todo.filter((x: any) => !have.has(x.id));
      skippedExisting = items.length - todo.length;
    }

    // If all existing, advance cursor to prevent infinite loops
    if (!todo.length) {
      const cursorSaved = useSavedCursor ? await saveCursor(supabase, jobName, nextAfterId) : false;
      console.log("MEDIA_EMBED_BACKFILL_SKIP_ALL_EXISTING", JSON.stringify({ scanned: items.length, nextAfterId, jobName }));
      return respond(200, {
        ok: true,
        scanned: items.length,
        embedded: 0,
        skipped_existing: skippedExisting,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
        provider,
        model,
        dimensions,
        task,
        reembed,
      });
    }

    // Call embeddings provider
    let vecs: number[][] = [];
    try {
      const todoDocs = todo.map((x: any) => x.__doc as string);

      if (provider === "openai") {
        vecs = await callOpenAI(todoDocs, model, dimensions);
      } else if (provider === "voyage") {
        vecs = await callVoyage(todoDocs, model, dimensions);
      } else {
        vecs = await callJina(todoDocs, model);
      }
    } catch (err) {
      const url =
        provider === "openai"
          ? OPENAI_EMBEDDINGS_URL
          : provider === "voyage"
          ? (Deno.env.get("VOYAGE_EMBEDDINGS_URL") ?? "https://api.voyageai.com/v1/embeddings")
          : JINA_EMBEDDINGS_URL;

      return respond(500, {
        ok: false,
        code: "EMBEDDINGS_CALL_FAILED",
        message: String((err as any)?.message ?? err),
        provider,
        model,
        url,
        batchSize,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    if (vecs.length !== todo.length) {
      return respond(500, {
        ok: false,
        code: "EMBEDDINGS_COUNT_MISMATCH",
        message: `got ${vecs.length} embeddings for ${todo.length} docs`,
        provider,
        model,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    const expectedDim = dimensions;
    const badDim = vecs.findIndex((v) => (Array.isArray(v) ? v.length : 0) !== expectedDim);
    if (badDim !== -1) {
      return respond(500, {
        ok: false,
        code: "EMBEDDING_DIM_MISMATCH",
        message: `embedding dim mismatch at index ${badDim}: got ${vecs[badDim]?.length}, expected ${expectedDim}`,
        provider,
        model,
        dimensions: expectedDim,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    // Upsert rows for this profile
    const now = new Date().toISOString();
    const rows = todo.map((mi: any, i: number) => ({
      media_item_id: mi.id,
      provider,
      model,
      dimensions: expectedDim,
      task,
      embedding: vecs[i],
      updated_at: now,
    }));

    const { error: upErr } = await supabase
      .from("media_embeddings")
      .upsert(rows, { onConflict: "media_item_id,provider,model,dimensions,task" });

    if (upErr) {
      return respond(500, {
        ok: false,
        code: "UPSERT_FAILED",
        message: upErr.message,
        provider,
        model,
        dimensions: expectedDim,
        task,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    const cursorSaved = useSavedCursor ? await saveCursor(supabase, jobName, nextAfterId) : false;

    console.log(
      "MEDIA_EMBED_BACKFILL_OK",
      JSON.stringify({ scanned: items.length, embedded: rows.length, skippedExisting, nextAfterId, jobName, provider, model, dimensions: expectedDim, task }),
    );

    return respond(200, {
      ok: true,
      scanned: items.length,
      embedded: rows.length,
      skipped_existing: skippedExisting,
      next_after_id: nextAfterId,
      used_after_id: usedAfterId,
      cursor_saved: cursorSaved,
      provider,
      model,
      dimensions: expectedDim,
      task,
      reembed,
    });
  } catch (err) {
    return respond(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
