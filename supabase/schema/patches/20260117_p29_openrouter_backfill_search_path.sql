-- P29: Pin search_path for OpenRouter backfill helper RPC
--
-- Fixes Supabase database linter warning: Function Search Path Mutable
-- by explicitly setting a stable search_path.
-- Safe to run multiple times.

begin;

alter function public.openrouter_generation_backfill_candidates_v1(
  timestamptz,
  int,
  timestamptz,
  uuid
) set search_path to 'pg_catalog', 'public';

commit;
