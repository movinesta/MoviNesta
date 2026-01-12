import Ajv from "npm:ajv@8.17.1";
import type { OpenRouterResponseFormat } from "./openrouter.ts";

const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = new Map<string, ReturnType<typeof ajv.compile>>();

export type SchemaRegistryEntry = {
  id: number;
  key: string;
  version: number;
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
  description?: string | null;
  is_active?: boolean;
};

const normalizeSchema = (schema: unknown): Record<string, unknown> => {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    return schema as Record<string, unknown>;
  }

  if (typeof schema === "string") {
    try {
      const parsed = JSON.parse(schema);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }

  return {};
};

const schemaCacheKey = (entry: SchemaRegistryEntry) => `${entry.key}@${entry.version}`;

export function buildResponseFormatFromSchema(entry: SchemaRegistryEntry): OpenRouterResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: entry.name || entry.key,
      strict: entry.strict ?? true,
      schema: normalizeSchema(entry.schema),
    },
  };
}

export async function loadSchemaRegistryEntry(
  client: { from: (table: string) => any },
  key: string,
): Promise<SchemaRegistryEntry> {
  const { data, error } = await client
    .from("schema_registry")
    .select("id,key,version,name,schema,strict,description,is_active")
    .eq("key", key)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load schema registry entry: ${error.message ?? error}`);
  }

  if (!data) {
    throw new Error(`Schema registry entry not found for key: ${key}`);
  }

  return {
    id: Number(data.id),
    key: String(data.key),
    version: Number(data.version),
    name: String(data.name ?? data.key ?? key),
    schema: normalizeSchema(data.schema),
    strict: Boolean(data.strict),
    description: data.description ?? null,
    is_active: data.is_active ?? true,
  };
}

export function validateSchemaPayload(entry: SchemaRegistryEntry, payload: unknown) {
  const cacheKey = schemaCacheKey(entry);
  let validate = schemaCache.get(cacheKey);

  if (!validate) {
    validate = ajv.compile(normalizeSchema(entry.schema));
    schemaCache.set(cacheKey, validate);
  }

  const valid = validate(payload);

  return {
    valid,
    errors: validate.errors ?? [],
  };
}

export function registerSchema(schemaId: string, schema: object) {
  const validate = ajv.compile(schema);
  schemaCache.set(schemaId, validate);
}
