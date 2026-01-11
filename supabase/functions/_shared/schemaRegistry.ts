// supabase/functions/_shared/schemaRegistry.ts
//
// Schema registry + validation helpers for structured AI outputs.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validate } from "https://deno.land/x/jsonschema@v1.4.1/mod.ts";

export type SchemaRegistryKey =
  | "assistant.agent"
  | "assistant.chunk_outline"
  | "assistant.chunk_section";

export type SchemaRegistryEntry = {
  key: SchemaRegistryKey;
  version: number;
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
  description?: string | null;
};

const DEFAULT_SCHEMA_REGISTRY: Record<SchemaRegistryKey, SchemaRegistryEntry> = {
  "assistant.agent": {
    key: "assistant.agent",
    version: 1,
    name: "MoviNestaAssistantAgent",
    strict: true,
    description: "Structured output schema for assistant agent tool loop.",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["tool", "final"] },
        calls: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              tool: { type: "string" },
              args: { type: "object", additionalProperties: true },
            },
            required: ["tool"],
          },
        },
        text: { type: "string" },
        ui: { type: "object", additionalProperties: true },
        actions: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      required: ["type"],
      oneOf: [
        {
          properties: { type: { const: "tool" }, calls: { type: "array" } },
          required: ["type", "calls"],
        },
        {
          properties: { type: { const: "final" }, text: { type: "string" } },
          required: ["type", "text"],
        },
      ],
    },
  },
  "assistant.chunk_outline": {
    key: "assistant.chunk_outline",
    version: 1,
    name: "MoviNestaChunkOutline",
    strict: true,
    description: "Structured output schema for chunked assistant outline generation.",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        intro: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              bullets: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["title", "bullets"],
          },
        },
      },
      required: ["sections"],
    },
  },
  "assistant.chunk_section": {
    key: "assistant.chunk_section",
    version: 1,
    name: "MoviNestaChunkSection",
    strict: true,
    description: "Structured output schema for chunked assistant section generation.",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
};

function isMissingRelationError(err: any, relation: string): boolean {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  if (code === "42P01") return true; // undefined_table
  const m = msg.toLowerCase();
  return m.includes("does not exist") && m.includes(relation.toLowerCase());
}

function coerceSchemaRegistryEntry(
  key: SchemaRegistryKey,
  row: any,
  fallback: SchemaRegistryEntry,
): SchemaRegistryEntry {
  const schemaCandidate = row?.schema;
  const schema = schemaCandidate && typeof schemaCandidate === "object" ? schemaCandidate : fallback.schema;
  const versionRaw = row?.version;
  const version = Number.isFinite(versionRaw) ? Number(versionRaw) : Number(versionRaw ?? fallback.version) || fallback.version;
  return {
    key,
    version,
    name: String(row?.name ?? fallback.name),
    schema: schema as Record<string, unknown>,
    strict: row?.strict ?? fallback.strict,
    description: row?.description ?? fallback.description ?? null,
  };
}

export function getDefaultSchemaRegistryEntry(key: SchemaRegistryKey): SchemaRegistryEntry {
  const entry = DEFAULT_SCHEMA_REGISTRY[key];
  return { ...entry, schema: { ...(entry.schema as Record<string, unknown>) } };
}

export async function loadSchemaRegistryEntry(
  client: SupabaseClient,
  key: SchemaRegistryKey,
): Promise<SchemaRegistryEntry> {
  const fallback = getDefaultSchemaRegistryEntry(key);

  try {
    const { data, error } = await client
      .from("schema_registry")
      .select("key, version, name, schema, strict, description, is_active")
      .eq("key", key)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error, "schema_registry")) return fallback;
      throw new Error(error.message);
    }

    if (!data) return fallback;
    return coerceSchemaRegistryEntry(key, data, fallback);
  } catch {
    return fallback;
  }
}

export function buildResponseFormatFromSchema(entry: SchemaRegistryEntry) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: entry.name,
      strict: entry.strict,
      schema: entry.schema,
    },
  };
}

export function validateSchemaPayload(entry: SchemaRegistryEntry, payload: unknown): { valid: boolean; errors: string[] } {
  const result = validate(payload, entry.schema ?? {});
  const errors = (result.errors ?? []).map((err) => err.stack ?? String(err));
  return { valid: Boolean(result.valid), errors };
}
