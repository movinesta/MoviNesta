// supabase/functions/_shared/voyage.ts
//
// VoyageAI helpers (Embeddings + Rerank)
//
// HTTP API formats:
// - Embeddings endpoint returns: { object, data: [{ embedding, index }], model, usage: { total_tokens } }
// - Rerank endpoint returns: commonly { object, data/results: [{ index, relevance_score, document? }], model, usage/total_tokens }
//
// This file is dependency-free and safe for Supabase Edge (Deno).

import { postJson } from "./http.ts";

export const VOYAGE_EMBEDDINGS_URL =
  Deno.env.get("VOYAGE_EMBEDDINGS_URL") ?? "https://api.voyageai.com/v1/embeddings";

export const VOYAGE_RERANK_URL =
  Deno.env.get("VOYAGE_RERANK_URL") ?? "https://api.voyageai.com/v1/rerank";

export const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY") ?? "";

export type VoyageInputType = "query" | "document" | null;

type VoyageUsage = { total_tokens?: number };

type VoyageEmbeddingDatum = {
  embedding?: number[];
  index?: number;
};

type VoyageEmbeddingsHttpResponse = {
  object?: string;
  model?: string;
  // Voyage HTTP API uses `data`
  data?: VoyageEmbeddingDatum[];
  usage?: VoyageUsage;

  // Some SDKs / wrappers may expose `embeddings`
  embeddings?: number[][];
  total_tokens?: number;
};

export type VoyageRerankResult = {
  index: number;
  document?: string;
  relevance_score: number;
};

type VoyageRerankDatum = {
  index?: number;
  relevance_score?: number;
  document?: string;
  text?: string; // some wrappers may use `text`
};

type VoyageRerankHttpResponse = {
  object?: string;
  model?: string;
  // Some responses use `results`, others use `data`
  results?: VoyageRerankDatum[];
  data?: VoyageRerankDatum[];
  usage?: VoyageUsage;
  total_tokens?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Retry on transient failures (429/5xx). postJson throws on non-2xx.
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const msg = String((err as any)?.message ?? err);
      const retryable =
        msg.includes("(429)") ||
        msg.includes("(500)") ||
        msg.includes("(502)") ||
        msg.includes("(503)") ||
        msg.includes("(504)");

      if (!retryable || attempt === 3) break;

      const delay = attempt === 1 ? 300 : 900;
      console.warn(`VOYAGE_RETRY ${label} attempt=${attempt} delayMs=${delay} err=${msg}`);
      await sleep(delay);
    }
  }

  throw lastErr ?? new Error(`VOYAGE ${label} failed`);
}

function parseTotalTokens(resp: { usage?: VoyageUsage; total_tokens?: number }): number | null {
  const a = resp?.usage?.total_tokens;
  if (typeof a === "number" && Number.isFinite(a)) return a;

  const b = (resp as any)?.total_tokens;
  if (typeof b === "number" && Number.isFinite(b)) return b;

  return null;
}

function parseEmbeddings(resp: VoyageEmbeddingsHttpResponse): number[][] {
  // Prefer direct embeddings if present
  if (Array.isArray(resp.embeddings) && resp.embeddings.length) {
    return resp.embeddings.map((v) => v as number[]);
  }

  // Voyage HTTP API: data: [{ embedding, index }]
  const data = Array.isArray(resp.data) ? resp.data : [];
  if (!data.length) return [];

  // Ensure stable order by index if provided
  const withIdx = data
    .map((d, i) => ({
      i,
      idx: typeof d.index === "number" ? d.index : i,
      emb: Array.isArray(d.embedding) ? (d.embedding as number[]) : null,
    }))
    .filter((x) => Array.isArray(x.emb));

  withIdx.sort((a, b) => a.idx - b.idx);

  return withIdx.map((x) => x.emb as number[]);
}

export async function voyageEmbed(
  texts: string[],
  opts?: {
    model?: string;
    inputType?: VoyageInputType;
    outputDimension?: number | null;
    truncation?: boolean;
    outputDtype?: "float" | "int8" | "uint8" | "binary" | "ubinary";
  },
): Promise<{ embeddings: number[][]; totalTokens: number | null }> {
  if (!VOYAGE_API_KEY) throw new Error("Missing VOYAGE_API_KEY");

  const model = opts?.model ?? "voyage-3-large";
  const inputType = (opts?.inputType ?? "document") as VoyageInputType;
  const outputDimension = opts?.outputDimension ?? null;

  const headers = { Authorization: `Bearer ${VOYAGE_API_KEY}` };

  const payload: Record<string, unknown> = {
    input: texts,
    model,
  };

  if (inputType) payload.input_type = inputType;
  if (opts?.truncation !== undefined) payload.truncation = Boolean(opts.truncation);
  if (outputDimension !== null && outputDimension !== undefined) payload.output_dimension = outputDimension;
  if (opts?.outputDtype) payload.output_dtype = opts.outputDtype;

  const resp = await withRetry(
    () => postJson<VoyageEmbeddingsHttpResponse>(VOYAGE_EMBEDDINGS_URL, payload, headers),
    "embeddings",
  );

  const embeddings = parseEmbeddings(resp);
  const totalTokens = parseTotalTokens(resp);

  // If the API returned no embeddings, treat it as an error (prevents silent failures).
  if (!embeddings.length && texts.length) {
    throw new Error("Voyage embeddings response contained no embeddings (check model/key/limits)");
  }

  return { embeddings, totalTokens };
}

function parseRerankResults(resp: VoyageRerankHttpResponse): VoyageRerankResult[] {
  const arr = Array.isArray(resp.results)
    ? resp.results
    : Array.isArray(resp.data)
      ? resp.data
      : [];

  return arr
    .map((r, i) => {
      const index = typeof r.index === "number" ? r.index : i;
      const score = typeof r.relevance_score === "number" ? r.relevance_score : NaN;
      const doc = (r.document ?? (r as any).text) as string | undefined;
      return { index: Number(index), relevance_score: Number(score), document: doc };
    })
    .filter((x) => Number.isFinite(x.index) && Number.isFinite(x.relevance_score));
}

export async function voyageRerank(
  query: string,
  documents: string[],
  opts?: {
    model?: string; // default: rerank-2.5
    topK?: number | null;
    truncation?: boolean;
    returnDocuments?: boolean; // default false
  },
): Promise<{ results: VoyageRerankResult[]; totalTokens: number | null }> {
  if (!VOYAGE_API_KEY) throw new Error("Missing VOYAGE_API_KEY");

  const model = opts?.model ?? "rerank-2.5";

  const headers = { Authorization: `Bearer ${VOYAGE_API_KEY}` };

  const payload: Record<string, unknown> = {
    query,
    documents,
    model,
  };

  if (opts?.topK !== undefined && opts.topK !== null) payload.top_k = opts.topK;
  if (opts?.truncation !== undefined) payload.truncation = Boolean(opts.truncation);
  if (opts?.returnDocuments !== undefined) payload.return_documents = Boolean(opts.returnDocuments);

  const resp = await withRetry(
    () => postJson<VoyageRerankHttpResponse>(VOYAGE_RERANK_URL, payload, headers),
    "rerank",
  );

  const results = parseRerankResults(resp);
  const totalTokens = parseTotalTokens(resp);

  if (!results.length && documents.length) {
    throw new Error("Voyage rerank response contained no results");
  }

  return { results, totalTokens };
}
