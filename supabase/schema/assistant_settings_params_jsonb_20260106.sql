-- One-time migration: coerce assistant_settings.params from JSON strings to jsonb.

UPDATE public.assistant_settings
SET params = (params #>> '{}')::jsonb
WHERE jsonb_typeof(params) = 'string';
