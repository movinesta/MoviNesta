-- Migration: Consolidate Cache Tables
-- Description: Merges OpenRouter, TMDB, and OMDB cache tables into generic 'external_api_cache' and 'media_metadata_cache' tables.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Create new table: public.external_api_cache
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_api_cache (
    key text NOT NULL,
    provider text NOT NULL,
    category text NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT external_api_cache_pkey PRIMARY KEY (key)
);

-- Add index/comment
COMMENT ON TABLE public.external_api_cache IS 'Consolidated cache for external API responses (e.g. OpenRouter).';
CREATE INDEX IF NOT EXISTS idx_external_api_cache_provider_category ON public.external_api_cache(provider, category);


--------------------------------------------------------------------------------
-- 2. Create new table: public.media_metadata_cache
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_metadata_cache (
    provider text NOT NULL,     -- 'tmdb', 'omdb'
    external_id text NOT NULL,  -- 'tt1234567' or '12345'
    media_type text,            -- 'movie', 'series', 'person'
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT media_metadata_cache_pkey PRIMARY KEY (provider, external_id)
);

-- Add index/comment
COMMENT ON TABLE public.media_metadata_cache IS 'Consolidated cache for media metadata providers (TMDB, OMDB).';


--------------------------------------------------------------------------------
-- 3. Drop old tables (DATA WILL BE LOST per plan)
--------------------------------------------------------------------------------

-- OpenRouter tables
DROP TABLE IF EXISTS public.openrouter_credits_cache;
DROP TABLE IF EXISTS public.openrouter_endpoints_cache;
DROP TABLE IF EXISTS public.openrouter_key_cache;
DROP TABLE IF EXISTS public.openrouter_models_cache;
DROP TABLE IF EXISTS public.openrouter_usage_cache;
DROP TABLE IF EXISTS public.openrouter_parameters_cache;

-- Media tables
DROP TABLE IF EXISTS public.tmdb_cache;
DROP TABLE IF EXISTS public.omdb_cache;

COMMIT;
