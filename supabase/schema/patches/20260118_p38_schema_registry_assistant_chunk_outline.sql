-- Add schema registry entry for assistant.chunk_outline responses.
insert into public.schema_registry (key, version, name, schema, strict, description, is_active)
values (
  'assistant.chunk_outline',
  1,
  'assistant.chunk_outline',
  '{
    "type": "object",
    "properties": {
      "intro": { "type": "string" },
      "sections": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "bullets": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["title"],
          "additionalProperties": true
        }
      }
    },
    "required": ["sections"],
    "additionalProperties": true
  }'::jsonb,
  true,
  'Schema for assistant chunk outline responses.',
  true
)
on conflict (key, version) do update
set
  name = excluded.name,
  schema = excluded.schema,
  strict = excluded.strict,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();
