-- Migration: 20260107_170001_assistant_settings_behavior_column
-- Description: Ensure assistant_settings has a behavior JSONB column for admin-controlled assistant behavior.

BEGIN;

ALTER TABLE IF EXISTS public.assistant_settings
  ADD COLUMN IF NOT EXISTS behavior jsonb;

COMMENT ON COLUMN public.assistant_settings.behavior IS
  'Admin-controlled assistant behavior settings (prompts, chunking, tool loop, rate limits, orchestrator knobs, OpenRouter attribution).';

COMMIT;
