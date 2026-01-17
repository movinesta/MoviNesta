# Edge Function auth guards

This repo uses `supabase/config.toml` with `verify_jwt = false` for most Edge Functions.

That setting disables Supabase's automatic JWT verification for the function invocation.
To keep security explicit and auditable, each Edge Function **must** enforce one of these guards:

- **Admin-only**: `requireAdmin(req)` (checks user JWT + `public.app_admins` via service_role)
- **User-only**: `requireUserFromRequest(req, userClient)` (validates user JWT)
- **Internal/cron-only**: `requireInternalJob(req)` (validates internal job token)
- **Api key sanity**: `requireApiKeyHeader(req)` (ensures callers send the expected anon/service key)

## CI safety net

CI runs `node scripts/check-edge-auth-guards.mjs` to fail builds when a function is missing an explicit guard.

If you intentionally add a public function that does not need any guard, add its name to `allowNoGuard` in the script and document why.
