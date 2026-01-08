-- Migration: 20260108_000100_admin_user_prefs
-- Description: Store per-admin UI preferences (e.g., settings favorites) server-side.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_favorites text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_user_prefs ENABLE ROW LEVEL SECURITY;

-- We only access this table via admin Edge Functions using service_role.
-- Keeping it service_role-only prevents any accidental client reads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_user_prefs'
      AND policyname = 'service_role full access admin_user_prefs'
  ) THEN
    CREATE POLICY "service_role full access admin_user_prefs"
      ON public.admin_user_prefs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_user_prefs_updated_at
  ON public.admin_user_prefs (updated_at DESC);

COMMIT;
