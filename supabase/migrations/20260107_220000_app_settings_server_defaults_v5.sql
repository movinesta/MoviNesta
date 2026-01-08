-- Migration: 20260107_220000_app_settings_server_defaults_v5
-- Description: Seed server_only defaults for assistant reply-runner knobs.

BEGIN;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.claim_limit_default',
    'server_only',
    '20'::jsonb,
    'Default number of reply jobs to claim per runner invocation when request omits limit.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.max_attempts_default',
    'server_only',
    '5'::jsonb,
    'Default maxAttempts for runner processing when request omits maxAttempts.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.stuck_minutes',
    'server_only',
    '10'::jsonb,
    'Minutes after which a job is considered stuck and eligible to be reclaimed.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.max_context_messages',
    'server_only',
    '12'::jsonb,
    'maxContextMessages passed to assistant-chat-reply from the runner (background execution).'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, scope, value, description)
VALUES
  (
    'assistant.reply_runner.backoff',
    'server_only',
    '{
      "base_seconds": 10,
      "max_exp": 10,
      "max_seconds": 3600,
      "jitter_seconds": 5
    }'::jsonb,
    'Backoff strategy for rescheduling jobs after rate limiting or transient errors.'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
