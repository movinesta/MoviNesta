-- Migration: 20260107_235500_app_settings_public_defaults_v3
-- Description: Seed additional public UX settings (assistant detection + presence labels + message search).

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  -- Assistant UX
  ('ux.assistant.username', 'public', 'movinesta'::jsonb, 'Username used by the client to identify the built-in assistant thread when no cached conversation id exists.'),

  -- Presence copy
  ('ux.presence.label_online', 'public', '"Online"'::jsonb, 'Presence: label shown when a user is online.'),
  ('ux.presence.label_active_recently', 'public', '"Active recently"'::jsonb, 'Presence: label shown when a user is away / recently active.'),
  ('ux.presence.label_active_prefix', 'public', '"Active"'::jsonb, 'Presence: prefix used for last-active strings (e.g., "Active 2 minutes ago").'),

  -- Conversation message search
  ('ux.messages.search.min_query_chars', 'public', '2'::jsonb, 'Minimum query length to enable in-conversation message search.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
