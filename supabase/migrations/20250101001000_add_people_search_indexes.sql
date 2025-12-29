-- Improve people search performance for ILIKE queries.
-- Uses pg_trgm (already enabled in this project) for fast partial matches.

CREATE INDEX IF NOT EXISTS profiles_public_username_trgm_idx
  ON public.profiles_public
  USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_public_display_name_trgm_idx
  ON public.profiles_public
  USING gin (display_name gin_trgm_ops);
