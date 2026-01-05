-- Migration: 20260104022000_rls_initplan_library_entries
-- Purpose:
--   Normalize library_entries RLS policies to use SELECT auth.uid() pattern,
--   which prevents re-evaluating auth.uid() per-row and addresses Supabase linter
--   warning: auth_rls_initplan.
--
-- Notes:
--   - Idempotent: DROP POLICY IF EXISTS + recreate.
--   - Semantics are unchanged.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.library_entries') IS NULL THEN
    RAISE NOTICE 'Skipping library_entries policy normalization: table public.library_entries does not exist.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY';

  -- Recreate policies with the initplan-friendly pattern
  EXECUTE 'DROP POLICY IF EXISTS library_entries_select_self ON public.library_entries';
  EXECUTE 'DROP POLICY IF EXISTS library_entries_insert_self ON public.library_entries';
  EXECUTE 'DROP POLICY IF EXISTS library_entries_update_self ON public.library_entries';
  EXECUTE 'DROP POLICY IF EXISTS library_entries_delete_self ON public.library_entries';

  EXECUTE $$
    CREATE POLICY library_entries_select_self
      ON public.library_entries
      FOR SELECT
      TO authenticated
      USING (user_id = (SELECT auth.uid()))
  $$;

  EXECUTE $$
    CREATE POLICY library_entries_insert_self
      ON public.library_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()))
  $$;

  EXECUTE $$
    CREATE POLICY library_entries_update_self
      ON public.library_entries
      FOR UPDATE
      TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()))
  $$;

  EXECUTE $$
    CREATE POLICY library_entries_delete_self
      ON public.library_entries
      FOR DELETE
      TO authenticated
      USING (user_id = (SELECT auth.uid()))
  $$;
END
$$;

COMMIT;
