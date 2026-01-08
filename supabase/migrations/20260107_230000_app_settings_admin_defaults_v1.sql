-- Migration: 20260107_230000_app_settings_admin_defaults_v1
-- Description: Seed admin-scope defaults for Admin Dashboard endpoints.
--
-- Notes:
-- - These settings are non-secret.
-- - Scope 'admin' means only admins (via Edge Functions / service_role) can read/update.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  ('admin.users.page_limit', 'admin', to_jsonb(50), 'Admin Users: page size used by admin-users list endpoint (offset-based pagination).'),
  ('admin.users.ban_duration_days', 'admin', to_jsonb(18250), 'Admin Users: ban duration (days) applied when admin-users action=ban.'),
  ('admin.overview.recent_errors_limit', 'admin', to_jsonb(50), 'Admin Overview: number of recent error rows to return (last 24h).'),
  ('admin.overview.last_job_runs_limit', 'admin', to_jsonb(20), 'Admin Overview: number of last job runs to return.'),
  ('admin.audit.default_limit', 'admin', to_jsonb(50), 'Admin Audit: default limit when the request omits the limit query param.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
