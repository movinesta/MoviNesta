-- Migration: 20260107_140500_app_settings_public_defaults_v2
-- Description: Seed additional public app settings used by the frontend (composer, attachments, search, timeouts).

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  -- Messages composer
  ('ux.messages.max_message_chars', 'public', '2000'::jsonb, 'Max characters allowed in the message composer.'),
  ('ux.messages.composer_max_height_px', 'public', '140'::jsonb, 'Max auto-resize height for the message composer textarea (px).'),

  -- Attachments
  ('ux.attachments.max_image_bytes', 'public', '10485760'::jsonb, 'Max allowed size for an uploaded chat image (bytes). Non-secret; used for client-side validation only.'),

  -- Search
  ('ux.search.page_size', 'public', '20'::jsonb, 'Search results page size used by the client and fallback DB query.'),
  ('ux.search.batch_sync_limit', 'public', '5'::jsonb, 'Max external TMDb results to attempt syncing into the catalog per page.'),
  ('ux.search.min_query_chars', 'public', '2'::jsonb, 'Minimum query length to enable search.'),
  ('ux.search.stale_time_ms', 'public', '1800000'::jsonb, 'React Query: staleTime for title search (ms). Set to 0 to always refetch.'),
  ('ux.search.gc_time_ms', 'public', '3600000'::jsonb, 'React Query: gcTime for title search cache (ms).'),

  -- Ops (frontend)
  ('ops.frontend.function_timeout_ms', 'public', '20000'::jsonb, 'Default timeout for calling Supabase Edge Functions (ms).'),
  ('ops.search.timeout_ms', 'public', '20000'::jsonb, 'Timeout for search-related Edge Function calls (ms).')
ON CONFLICT (key) DO NOTHING;

COMMIT;
