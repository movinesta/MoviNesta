# Schema patches

This folder contains one-off SQL patches you can run in the Supabase SQL Editor.

## Patches

- `20260117_p22_openrouter_generation_backfill_cron.sql`
  - Schedules a cron job to run the generation-stats backfill Edge Function.

- `20260117_p23_openrouter_generation_backfill_perf.sql`
  - Adds indexes and an RPC to find backfill candidates efficiently.

- `20260117_p25_openrouter_generation_backfill_cron_credit_gate.sql`
  - Adds a credit gate so the backfill can auto-skip when OpenRouter credits are low.

- `20260117_p26_admin_cron_job_runs.sql`
  - Adds admin-only RPCs to view and prune pg_cron run history.

- `20260117_p27_admin_cron_security.sql`
  - Restricts EXECUTE on cron admin RPCs to service_role.

- `20260117_p28_storage_search_path.sql`
  - Pins search_path for Supabase Storage SECURITY DEFINER functions.

- `20260117_p29_openrouter_backfill_search_path.sql`
  - Pins search_path for the OpenRouter backfill candidate RPC.

- `20260117_p30_internal_table_hardening.sql`
  - Enables RLS on service_role-only internal tables and revokes anon/auth grants from internal cache tables.

- `20260117_p31_admin_diagnostics_rls.sql`
  - Adds admin-only (RLS) read access to internal diagnostics tables while keeping service_role full access.

- `20260117_p37_admin_cursor_indexes.sql`
  - Adds keyset pagination indexes to speed up admin cursor-based logs.

- `20260118_p38_schema_registry_assistant_chunk_outline.sql`
  - Seeds the schema registry with the assistant.chunk_outline response schema.

- `20260118_p39_schema_registry_assistant_agent.sql`
  - Seeds the schema registry with the assistant.agent response schema.

- `20260118_p40_assistant_health_ops_alerts_guard.sql`
  - Guards assistant_health_snapshot_v1 when ops_alerts is missing.

> Tip: Use Supabase Vault to store `project_url`, `publishable_key`, and `internal_job_token`, then reference them from cron commands.
