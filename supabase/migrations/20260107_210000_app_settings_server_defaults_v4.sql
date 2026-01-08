-- Migration: 20260107_210000_app_settings_server_defaults_v4
-- Description: Seed server_only defaults for per-action rate limits and assistant tool-result truncation.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'ops.rate_limits',
    'server_only',
    '{
      "actions": {
        "catalog-sync": 60
      }
    }'::jsonb,
    'Server-only per-action rate limits. Keys match rate-limit action names (e.g. catalog-sync).'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.tool_result_truncation',
    'server_only',
    '{
      "defaults": { "maxString": 1200, "maxArray": 40, "maxObjectKeys": 60 },
      "caps": { "maxString": 4000, "maxArray": 200, "maxObjectKeys": 200 },
      "maxDepth": 4
    }'::jsonb,
    'Server-only defaults + caps for assistant-tool-result payload truncation.'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
