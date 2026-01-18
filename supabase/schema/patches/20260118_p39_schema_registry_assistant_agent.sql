-- Add schema registry entry for assistant.agent responses.
insert into public.schema_registry (key, version, name, schema, strict, description, is_active)
values (
  'assistant.agent',
  1,
  'assistant.agent',
  '{
    "type": "object",
    "properties": {
      "type": { "type": "string", "enum": ["final", "tool"] },
      "text": { "type": "string" },
      "ui": { "type": ["object", "null"] },
      "actions": { "type": ["array", "null"], "items": { "type": "object" } },
      "calls": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "tool": { "type": "string" },
            "args": { "type": "object" }
          },
          "required": ["tool"]
        }
      }
    },
    "required": ["type"],
    "anyOf": [
      { "properties": { "type": { "const": "final" } }, "required": ["type", "text"] },
      { "properties": { "type": { "const": "tool" } }, "required": ["type", "calls"] }
    ],
    "additionalProperties": true
  }'::jsonb,
  true,
  'Schema for assistant agent responses.',
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
