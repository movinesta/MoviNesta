-- Phase 5: Convert profiles_public table to view
-- Eliminates 3 sync triggers and ensures consistency

BEGIN;

-----------------------------------------------------------------------
-- 1. Drop triggers that sync profiles_public
-----------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_profiles_public ON public.profiles;
DROP TRIGGER IF EXISTS trg_sync_profiles_public_delete ON public.profiles;
DROP TRIGGER IF EXISTS trg_sync_profiles_public_verification ON public.profile_verifications;

-----------------------------------------------------------------------
-- 2. Drop trigger functions
-----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_profiles_public() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profiles_public_delete() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profiles_public_from_verification() CASCADE;

-----------------------------------------------------------------------
-- 3. Drop the table (or view if re-running)
-----------------------------------------------------------------------
DROP VIEW IF EXISTS public.profiles_public CASCADE;
DROP TABLE IF EXISTS public.profiles_public CASCADE;

-----------------------------------------------------------------------
-- 4. Create view from profiles + profile_verifications
-----------------------------------------------------------------------
CREATE VIEW public.profiles_public WITH (security_invoker = true) AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  NULL::text AS avatar_path,  -- deprecated, kept for compatibility
  p.bio,
  p.last_seen_at,
  p.created_at,
  p.updated_at,
  COALESCE(pv.status = 'approved', false) AS is_verified,
  pv.badge_type AS verified_type,
  pv.public_label AS verified_label,
  pv.verified_at,
  pv.verifier_org AS verified_by_org
FROM public.profiles p
LEFT JOIN public.profile_verifications pv 
  ON pv.user_id = p.id 
  AND pv.status = 'approved';

-----------------------------------------------------------------------
-- 5. Grant permissions (view inherits from profiles via security_invoker)
-----------------------------------------------------------------------
GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO service_role;

COMMIT;
