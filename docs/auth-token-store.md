# Auth token store (client)

MoviNesta keeps an **in-memory cache** of the current Supabase Auth access token (JWT).

Why:
- Avoids frequent `supabase.auth.getSession()` calls just to fetch a token.
- Reduces the chance of a “stale token race” where a request is fired while a refresh is in-flight.
- Allows a safe “refresh-on-401” retry for Edge Function calls.

Implementation:
- `src/lib/authTokenStore.ts` subscribes to `supabase.auth.onAuthStateChange(...)` and updates the cached token.
- `src/lib/callSupabaseFunction.ts` uses the cached token for `supabase.functions.invoke(...)`.
- `src/lib/edgeFetch.ts` uses the cached token for **raw `fetch()`** calls (needed for SSE streaming).

Notes:
- The cache is **best-effort**. If it can’t initialize for any reason, function calls fall back to the normal Supabase client behavior.
- Write/sensitive Edge Functions still validate the session server-side.
