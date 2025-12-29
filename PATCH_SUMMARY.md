# MoviNesta Patch Summary (2025-12-29)

This bundle includes fixes found during the schema + frontend/backend mismatch review.

## Auth & environment
- **Unified Supabase anon key env var**: the app accepts either `VITE_SUPABASE_ANON_KEY` or the legacy `VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY`.
- Updated the env template (`supabase/schema/*.env.template`) to use `VITE_SUPABASE_ANON_KEY`.
- Admin dashboard now **fails fast** if Supabase env vars are missing (instead of creating a broken client).

## URL / routing robustness (GitHub Pages BASE_URL)
- Added `buildAppUrl()` helper that respects Vite `BASE_URL`.
- Fixed all in-app **share links** (profile + title share) to include `BASE_URL`.
- Fixed password reset `redirectTo` to include `BASE_URL`.

## Storage safety (Safari private mode / blocked storage)
- Added safe wrappers for localStorage/sessionStorage access.
- Replaced unsafe storage access in swipe pages + swipe event queue + lazy chunk retry.
- Fixed message draft persistence so drafts:
  - load correctly when switching conversations
  - clear correctly when switching to a conversation without a saved draft

## React Query cache correctness
- Conversations list query key is now **user-scoped** to prevent cross-account cache bleed.
- Trending discover query key is now **user-scoped** (because the request depends on a session id).
- Sign-out now clears the query cache to prevent stale data after switching accounts.

## Backend / schema alignment
- Edge function rate limiting JWT parsing now correctly handles **base64url padding**.
- Added Supabase migration to create missing `title_id -> media_items(id)` foreign keys
  (needed for PostgREST embedded selects like `list_items(title:media_items(*))`).

## Already included from the previous mismatch-fix bundle
- Fixed review reactions insertion by including the required `content_type`.
- Fixed edge function to call the correct RPC name (`refresh_user_centroid`).

## Cleanup (public-ready)
- Removed **SwipePageClassic** and the `/swipe/classic` route (Swipe now uses a single implementation).
- Removed unused legacy title page (**TitleDetailPage.tsx**) and its now-unused helper (**ExternalRatingsChips.tsx**).
- Removed unused / debug Supabase Edge Functions: `catalog-search`, `debug-env`, `debug-tastedive`, plus stray `load-env.test.ts`.
- Updated `supabase/config.toml` to remove deleted function config blocks.
