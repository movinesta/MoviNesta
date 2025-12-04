# MoviNesta – AI Coding Agent TODO Checklist

_For each task or subtask below:_

- Change `- [ ]` to `- [✔️]` when the work is fully completed (or `[✖️]` if intentionally skipped).
- Immediately under the completed line, append:

  `DONE – YYYY-MM-DD HH:MM – one-line summary of what changed (mention key files + impact)`

  Example:

  `DONE – 2025-12-03 14:32 – Refactored useConversations to use get_conversation_summaries RPC; reduced 5 queries to 1.`

---

## 1. Repo & infra hygiene

- [✔️] Ensure Supabase `Database` types file exists and is wired
  DONE – 2025-12-03 19:29 – Supabase Database typings confirmed generated via script, canonical import path enforced, and file tracked in source control.
  - [✔️] Confirm `src/types/supabase.ts` is generated and checked into the repo.
    DONE – 2025-12-03 15:27 – Verified the generated Supabase types live at `src/types/supabase.ts` and remain tracked in Git.
  - [✔️] Add or verify a script (e.g. `npm run generate:supabase-types`) that runs `supabase gen types typescript --schema public` and writes to `src/types/supabase.ts`.
    DONE – 2025-12-03 15:27 – Confirmed `npm run generate:supabase-types` (scripts/generate-supabase-types.js) outputs `src/types/supabase.ts`.
  - [✔️] Replace any ad-hoc `import type { Database } from "...";` with a single canonical import path (e.g. `@/types/supabase`).
    DONE – 2025-12-03 15:27 – Ensured Supabase client code imports `Database` solely from `@/types/supabase`.
- [✔️] Update hooks like `useProfile`, `useConversations`, `useBlockStatus`, diary and swipe hooks to use typed row types instead of `any` (and remove casts like `(profileError as any)`).
  DONE – 2025-12-03 17:54 – Standardized diary, swipe, messaging, and profile hooks to Supabase row typings and removed remaining `any` casts for safer queries across modules.

- [✔️] Clean up build outputs
  DONE – 2025-12-03 19:29 – Verified docs-only build target, removed dist artifacts, and ensured helpers/gitignore align with GitHub Pages deployment.
  - [✔️] Confirm Vite builds to `docs/` (for GitHub Pages) via `vite.config.ts`.
    DONE – 2025-12-03 15:06 – Verified `vite.config.ts` already targets `docs/` for builds, aligning with GitHub Pages output.
  - [✔️] Remove any committed `dist/` directory from version control if present.
    DONE – 2025-12-03 15:06 – Removed tracked `dist/` artifacts now that builds publish to `docs/` only.
  - [✔️] Ensure `.gitignore` includes `dist/` so only `docs/` is used as the static output.
    DONE – 2025-12-03 15:06 – Confirmed `.gitignore` excludes `dist/` to prevent reintroducing build outputs.
  - [✔️] Verify any build helper scripts (e.g. `scripts/copy404.mjs`) still make sense for the `docs/` deployment target.
    DONE – 2025-12-03 15:06 – Confirmed `scripts/copy404.mjs` copies `docs/index.html` to `docs/404.html` for SPA fallback.

- [✔️] GitHub Actions workflows
  DONE – 2025-12-03 19:30 – All CI/deploy workflows verified with lint/tests on CI and build-only deploy pipeline confirmed.
  - [✔️] Keep deploy workflow focused on build & deploy only (no tests in the deploy pipeline).
    DONE – 2025-12-03 15:37 – Confirmed deploy workflow only builds and publishes without bundling test steps.
  - [✔️] Ensure a dedicated CI workflow (e.g. `ci.yml` or `test.yml`) runs on `push` and `pull_request` to `main`:
    - [✔️] `npm ci`
      DONE – 2025-12-03 15:06 – Added CI job step to install dependencies via `npm ci` on pushes/PRs to `main`.
    - [✔️] `npm run lint`
      DONE – 2025-12-03 15:06 – CI now runs `npm run lint` to enforce linting during automated checks.
    - [✔️] `npm test`
      DONE – 2025-12-03 15:06 – CI executes `npm test` with Vitest as part of the workflow.
  - [✔️] Fail the workflow when lint or tests fail so broken changes can’t be merged.
  DONE – 2025-12-03 15:06 – CI workflow stops on lint/test failures, preventing merges of broken builds.

- [✔️] GitHub Actions workflows
  DONE – 2025-12-03 19:29 – CI and deploy workflows separated: CI runs install/lint/tests on push/PR while deploy focuses solely on build/publish steps.

---

## 2. Supabase clients, type-safety, security & RLS

- [✔️] Split user vs admin Supabase clients for Edge Functions
  DONE – 2025-12-03 16:34 – Added shared Supabase client helpers for user/admin contexts and refactored edge functions to consume them.
  - [✔️] Create `supabase/functions/_shared/supabase.ts` with:
    - [✔️] `getUserClient()` that uses `SUPABASE_URL` + `SUPABASE_ANON_KEY` and respects RLS.
    - [✔️] `getAdminClient()` that uses `SUPABASE_SERVICE_ROLE_KEY` for cross-user or aggregation workflows that truly need it.
  - [✔️] Refactor existing Edge Functions (`swipe-*`, `catalog-*`, `create-direct-conversation`, etc.) to use these helpers instead of re-creating clients inline.
  - [✔️] Make sure `getAdminClient()` is only used when strictly necessary.
  DONE – 2025-05-16 00:50 – Switched catalog search Edge Function to use the anon user client instead of the service-role admin client for read-only queries.

- [✔️] Frontend Supabase client hygiene
  DONE – 2025-12-03 19:29 – Consolidated to a single guarded browser Supabase client, validated env vars, and removed unused client/server stubs.
  - [✔️] Consolidate to a single browser Supabase client in `src/lib/supabase.ts`.
    DONE – 2025-12-03 15:27 – Removed unused `src/lib/client.ts` and `src/lib/server.ts`, keeping `src/lib/supabase.ts` as the sole browser client.
  - [✔️] Validate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at startup and throw a clear error if they’re missing.
    DONE – 2025-12-03 15:27 – Confirmed `src/lib/supabase.ts` guards startup with explicit errors when Supabase env vars are absent.
  - [✔️] Only attach `window.supabase = supabase` in **development** (`import.meta.env.DEV === true`).
    DONE – 2025-12-03 15:27 – Added a development-only guard before exposing the Supabase client on `window` in `src/lib/supabase.ts`.
  - [✔️] Remove or move `src/lib/client.ts` / `src/lib/server.ts` if they are unused in this Vite SPA, or relocate them into a clearly separated `server/` folder if kept for SSR/back-end use.
    DONE – 2025-12-03 15:27 – Deleted unused SSR/browser client stubs in `src/lib/client.ts` and `src/lib/server.ts` to avoid duplication.

  - [✔️] Type-safety for Supabase queries
    DONE – 2025-12-03 17:54 – Completed Supabase query typing across conversation, diary, swipe, profile, and feed hooks using generated Database row definitions.
    - [✔️] Update `useConversations` to use `Database` row types instead of `any` for conversations, participants, messages, and read receipts.
      DONE – 2025-12-03 15:55 – Added Supabase row typing across conversations, participants, messages, and read receipt joins in `src/modules/messages/useConversations.ts` to remove `any` casts.
  - [✔️] Update `useProfile` (and related profile hooks) to:
    DONE – 2025-12-03 16:10 – useProfile now relies on Supabase row types, narrows Postgrest errors, and removes `any` casting.
    - [✔️] Use typed `profiles` + `follows` rows.
      DONE – 2025-12-03 16:10 – Profile queries now use generated Supabase row shapes for IDs, usernames, and stats without manual casting.
    - [✔️] Replace casts like `(profileError as any)` with proper error typing or narrowing.
      DONE – 2025-12-03 16:10 – Added `isNotFoundError` helper to check Postgrest error codes instead of relying on `any` casts.
    - [✔️] Ensure other key hooks (`useDiaryTimeline`, `useDiaryLibrary`, `useDiaryStats`, `useHomeFeed`, `useSwipeDeck`, `useBlockStatus`) are using typed Supabase responses and avoid `any`.
      DONE – 2025-12-03 16:47 – Home feed now uses Supabase row types and payload guards in `src/modules/home/HomeFeedTab.tsx`, aligning feed data with generated typings alongside the previously typed diary/swipe/block hooks.
    - [✔️] useDiaryTimeline now relies on Supabase row typing and runtime payload narrowing.
      DONE – 2025-12-03 16:01 – Typed activity event/title lookups in `src/modules/diary/useDiaryTimeline.ts` and validated payloads without `any` casts.
    - [✔️] useDiaryLibrary now uses generated Supabase row types for library entries, titles, and ratings.
      DONE – 2025-12-03 16:01 – Applied typed queries and removed casts in `src/modules/diary/useDiaryLibrary.ts` for safer diary library data.
    - [✔️] useDiaryStats now queries Supabase with generated row types and typed errors.
      DONE – 2025-12-03 16:15 – Swapped custom interfaces for Supabase rows in `src/modules/diary/useDiaryStats.ts` and removed casts.
    - [✔️] useSwipeDeck guards Supabase Edge Function responses with runtime validation instead of `any` casts.
      DONE – 2025-12-03 16:21 – Added card type guards in `src/modules/swipe/useSwipeDeck.ts` to parse Edge Function payloads without `any` while preserving source tagging.

- [✔️] RLS policies and indexes
  DONE – 2025-12-04 05:21 – Added auth.uid()-scoped RLS policies and chat membership checks plus user-focused indexes in `supabase/schema.sql`; swipes/notification_preferences not present in schema and remain pending when introduced.
  - [✔️] Audit and add Row Level Security (RLS) policies for all user-data tables, including:
    DONE – 2025-12-04 05:21 – Enabled RLS for user-owned and messaging tables with ownership/membership policies in `supabase/schema.sql`.
    - [✔️] `profiles`
      DONE – 2025-12-04 05:21 – Restricted profile reads/writes to the authenticated user.
    - [✔️] `ratings`, `reviews`, `review_reactions`
      DONE – 2025-12-04 05:21 – Locked ratings/reviews/reactions to their owning user via RLS.
    - [✔️] `library_entries`, `episode_progress`
      DONE – 2025-12-04 05:21 – Guarded library entries and episode progress rows to auth.uid().
    - [✔️] `activity_events`
      DONE – 2025-12-04 05:21 – Limited activity_events visibility and mutation to the event owner.
    - [✔️] `follows`, `blocked_users`
      DONE – 2025-12-04 05:21 – Added participant-scoped visibility and blocker-managed writes for social graph tables.
    - [✔️] `conversations`, `conversation_participants`
      DONE – 2025-12-04 05:21 – Enforced conversation membership checks for conversation metadata and participant rows.
    - [✔️] `messages`, `message_read_receipts`, `message_delivery_receipts`, `message_reactions`
      DONE – 2025-12-04 05:21 – Added member-only read/write policies across message content and receipt/reaction tables.
    - [✖️] `swipes`
      DONE – 2025-12-04 05:21 – No swipes table present in schema; RLS will be added alongside table introduction.
    - [✔️] `notifications` and (future) `notification_preferences`
      DONE – 2025-12-04 05:21 – Applied owner-only policies to notifications; notification_preferences to follow once created.
    - [✔️] `reports` (for moderation)
      DONE – 2025-12-04 05:21 – Constrained report access to the reporting user.
  - [✔️] Ensure policies restrict access to `auth.uid()` and/or conversation membership, as appropriate.
    DONE – 2025-12-04 05:21 – Ownership checks rely on auth.uid() while messaging tables verify conversation participation before permitting reads/writes.
  - [✔️] Add or verify indexes for frequent access patterns:
    DONE – 2025-12-04 05:21 – Added user-centric and conversation indexes in `supabase/schema.sql` to align with common queries.
    - [✔️] `ratings(user_id)`
    - [✔️] `library_entries(user_id)`
    - [✔️] `activity_events(user_id, created_at)`
    - [✔️] `follows(follower_id)`, `follows(followed_id)`
    - [✔️] `blocked_users(blocker_id)`, `blocked_users(blocked_id)`
    - [✔️] `conversation_participants(user_id)`, `conversation_participants(conversation_id)`
    - [✔️] `messages(conversation_id, created_at desc)`
    - [✔️] `message_read_receipts(user_id, conversation_id)`
    - [✖️] `swipes(user_id, created_at)`
      DONE – 2025-12-04 05:21 – Index pending table creation; no swipes relation currently defined in schema.
    - [✔️] Any other indices referenced in RPCs or heavy queries.

- [✔️] Direct conversation uniqueness
  DONE – 2025-12-04 04:06 – Added a normalized participant pair column + unique index in `supabase/schema.sql` and updated `create-direct-conversation` Edge Function to reuse existing DMs via the constraint.
  - [✔️] Add a unique index to prevent duplicate 1-to-1 conversations when `is_group = false` (e.g. a normalized pair of user IDs).
  - [✔️] Update `create-direct-conversation` Edge Function to:
    - [✔️] Use this unique constraint and handle “conversation already exists” gracefully.
    - [✔️] Return the existing conversation instead of creating a duplicate.

---

## 3. Shared Edge utilities & HTTP layer

- [✔️] Add shared Edge HTTP helpers
  DONE – 2025-12-03 21:43 – Added `_shared/http.ts` with unified CORS/JSON helpers and refactored catalog, swipe, debug, and conversation edge functions to reuse them.
  - [✔️] Create `supabase/functions/_shared/http.ts` with:
    - [✔️] `jsonResponse(data, status = 200)` – consistent JSON + CORS response.
    - [✔️] `jsonError(message, status, code)` – standardized error shape `{ ok: false, error, code }`.
    - [✔️] Shared `corsHeaders` and OPTIONS handler for CORS preflight.
  - [✔️] Refactor Edge Functions (`catalog-*`, `swipe-*`, `debug-env`, etc.) to use these helpers instead of duplicating `jsonOk/jsonError/corsHeaders`.

- [✔️] Request validation helpers
  DONE – 2025-12-03 22:06 – Added shared `validateRequest` helper in `_shared/http.ts` to safely parse/validate JSON bodies and applied it across catalog sync/backfill, swipe-event, and create-direct-conversation edge functions for consistent 400 handling.
  - [✔️] Introduce a `validateRequest<T>()` helper that:
    - [✔️] Parses `req.json()` safely.
    - [✔️] Validates required fields and basic types (manually or via a small schema).
    - [✔️] Returns typed payload or responds with HTTP 400 via `jsonError`.
  - [✔️] Use this helper in functions like `swipe-event`, `swipe-for-you`, `catalog-sync`, and any other write-heavy endpoints.

- [✔️] `debug-env` hardening
  DONE – 2025-12-03 21:58 – Guarded debug-env behind `DEBUG_ENV_ENABLED` flag and restricted output to non-sensitive env presence booleans and runtime metadata in `supabase/functions/debug-env/index.ts`.
  - [✔️] Ensure `debug-env` returns only non-sensitive meta (e.g. booleans, build ID, feature flags), never secrets or raw env values.
  - [✔️] Optionally gate or disable `debug-env` in production behind an environment flag.

---

## 4. Supabase + TMDB integration

- [✔️] Reusable Edge Function caller in frontend
  DONE – 2025-12-03 21:37 – Added `callSupabaseFunction` helper with default timeout/error handling and refactored search, title conversations, and swipe flows to reuse it.
  - [✔️] Add `src/lib/callSupabaseFunction.ts` with:
    - [✔️] `callSupabaseFunction<T>(name: string, body: unknown, opts?: { timeoutMs?: number }): Promise<T>`.
    - [✔️] An `AbortController` + default timeout (e.g. 25s).
    - [✔️] Clear error throwing when `error` exists or `data` is missing.
  - [✔️] Refactor all `supabase.functions.invoke` usages (search, catalog sync, swipe, etc.) to use this helper.

- [✔️] TMDB proxy Edge Function
  DONE – 2025-12-04 04:25 – Added `tmdb-proxy` Edge Function that proxies approved TMDB endpoints with server-side token injection and guarded params.
  - [✔️] Implement a `tmdb-proxy` Edge Function that:
    DONE – 2025-12-04 04:25 – Created server-side TMDB proxy with limited paths and enforced auth token usage.
    - [✔️] Accepts a constrained set of TMDB paths and query parameters.
      DONE – 2025-12-04 04:25 – Normalized proxy payload to `/search/multi` and `/trending/all/week` with whitelisted params and defaults.
    - [✔️] Injects the TMDB read token on the server side.
      DONE – 2025-12-04 04:25 – Edge Function attaches the read token in request headers so the browser no longer needs it.
    - [✔️] Validates input so the proxy can’t be abused as a generic TMDB explorer.
      DONE – 2025-12-04 04:25 – Added path checks, query/page validation, and strict param filtering before forwarding to TMDB.
  - [✔️] Update frontend TMDB calls to go through `callSupabaseFunction("tmdb-proxy", ...)` instead of calling TMDB directly.
    DONE – 2025-12-04 04:25 – Refactored TMDB helper to invoke the proxy Edge Function with language defaults.
  - [✔️] Remove any direct TMDB read token usage from frontend code.
    DONE – 2025-12-04 04:25 – Dropped client-side TMDB token access and documented server-only TMDB credential usage.

- [✔️] TMDB image helper & performance
  DONE – 2025-12-03 22:01 – Unified TMDB image handling with size-aware helper usage, lazy loading, and swipe poster prefetching.
  - [✔️] Add a central helper (e.g. `tmdbImageUrl(path, size)`).
    DONE – 2025-12-03 22:01 – Expanded `tmdbImageUrl` to a typed size enum for consistent TMDB asset URLs.
  - [✔️] Replace inline `https://image.tmdb.org/t/p/...` usages (e.g. in title detail, swipe cards, search results) with this helper.
    DONE – 2025-12-03 22:01 – Swapped TitleDetail hero assets to the helper for posters and backdrops.
  - [✔️] Use appropriate sizes depending on context (`w342` / `w500` / etc.).
    DONE – 2025-12-03 22:01 – Poster/backdrop requests now request w500 and w1280 sizes based on context.
  - [✔️] Add `loading="lazy"` for non-critical images (lists, avatars).
    DONE – 2025-12-03 22:01 – Added lazy loading to search title thumbnails and people avatars to defer offscreen work.
  - [✔️] Prefetch images for the next few swipe cards to improve perceived performance.
    DONE – 2025-12-03 22:01 – Prefetches upcoming swipe posters during idle time to smooth transitions.

---

## 5. Messaging & conversations

- [✔️] Type-safe `useConversations` hook
  DONE – 2025-12-04 04:01 – Tightened `useConversations` typing for conversations, participants, messages, and read receipts while guarding null conversation IDs.
  - [✔️] Import typed rows from `Database` for conversations, participants, messages, and read receipts.
    DONE – 2025-12-04 04:01 – Added explicit Supabase row picks including read receipts to keep queries fully typed.
  - [✔️] Replace any `any` or manual casting with proper typing.
    DONE – 2025-12-04 04:01 – Removed implicit `any` usage by casting Supabase responses to typed rows for receipts and participant-derived IDs.
  - [✔️] Confirm mapping logic filters out null IDs safely and correctly derives conversation IDs.
    DONE – 2025-12-04 04:01 – Filters participant conversation IDs before querying to avoid null lookups and ensure stable mapping.

- [✔️] `get_conversation_summaries` RPC
  DONE – 2025-12-04 04:44 – Added SQL RPC with participants, last message, and read receipt summaries plus supporting messaging indexes.
  - [✔️] Create Postgres function `get_conversation_summaries(p_user_id uuid)` that returns:
    - [✔️] `conversation_id`, `is_group`, `title`, `created_at`, `updated_at`.
    - [✔️] `last_message_id`, `last_message_body`, `last_message_created_at`, plus sender summary.
    - [✔️] Participants as JSON array (id, displayName, username, avatarUrl, isSelf).
    - [✔️] Read receipt summary per conversation (e.g. last read message/timestamp for the current user).
  - [✔️] Use efficient SQL patterns (`DISTINCT ON`, window functions, indexes) to avoid N+1 queries.
  - [✔️] Add or verify supporting indexes as needed.
  
- [✔️] Refactor `useConversations` to use the RPC
  DONE – 2025-12-04 04:44 – `useConversations` now consumes the `get_conversation_summaries` RPC and maps participants, read receipts, and previews without multi-query waterfalls.
  - [✔️] Replace the multi-query waterfall with a single call to `.rpc("get_conversation_summaries", { p_user_id: user.id })`.
  - [✔️] Map RPC rows to the existing `ConversationListItem` UI model:
    - [✔️] Compute `lastMessageAt` from last message or conversation timestamps.
    - [✔️] Generate a message preview from `body` or JSON payload.
    - [✔️] Use read receipts to derive `hasUnread`.

- [ ] Split `ConversationPage.tsx` into focused components
  - [ ] Create:
    - [ ] `ConversationPage` – route container + data orchestration.
    - [ ] `ConversationHeader` – title, participants, back button, overflow menu.
    - [ ] `MessageList` – grouped messages, date separators, scroll handling.
    - [ ] `MessageBubble` – bubble layout, alignment, reactions, timestamps.
    - [ ] `MessageComposer` – input, emoji picker, attachments, send button.
    - [ ] `messageModel.ts` – DB rows → `UiMessage` mapping logic.
    - [ ] `useConversationMessages` – fetch + realtime subscription.
  - [ ] Move non-UI logic (data transforms, mapping from DB rows) into `messageModel.ts` and/or service layer.

- [ ] Realtime messages with optimistic updates
  - [ ] Implement `useConversationMessages` to:
    - [ ] Fetch initial messages with ordered `created_at`.
    - [ ] Subscribe to realtime `INSERT` events for the current conversation.
    - [ ] Maintain a deduplicated list of `UiMessage`s.
  - [ ] In `MessageComposer`:
    - [ ] Add an optimistic `UiMessage` with `status: "sending"` and a temp ID.
    - [ ] Insert the message via Supabase / Edge Function.
    - [ ] Reconcile the server message (from realtime) with the temp one and mark as `sent`.
    - [ ] On failure, change `status` to `"error"` and display a retry affordance.

- [ ] Delivery & read receipts UI
  - [ ] Ensure queries for `message_read_receipts` and `message_delivery_receipts` use appropriate indexes.
  - [ ] Decide how to represent “delivered” vs “seen” in the UI (subtle tick marks, text, etc.).
  - [ ] Integrate read/delivery state with `UiMessage` so the UI can render consistent indicators.

- [ ] Reactions
  - [ ] Confirm `message_reactions` is fully wired:
    - [ ] Typings in `Database` and frontend.
    - [ ] RLS (only participants can react, user can remove own reaction).
    - [ ] Indexes on `message_reactions(conversation_id, message_id)` or similar.
  - [ ] Extract reaction logic from `ConversationPage` into a smaller hook or utility to simplify the main component.

  - [ ] Blocked users enforcement
  - [ ] Confirm `blocked_users` is used consistently:
    - [ ] Integrate checks into conversation creation and message send logic (no messaging when blocked).
    - [✔️] Ensure `useBlockStatus` remains type-safe and uses a single Supabase client.
      DONE – 2025-12-03 16:10 – Typed the blocked user lookup in `src/modules/messages/useBlockStatus.ts` against Supabase rows so the hook avoids `any` casts while continuing to use the shared client.
    - [ ] Add tests for the “blocked” behavior at least at the hook/service level.

- [✔️] Global realtime chat (experimental)
  DONE – 2025-12-04 05:08 – Archived the realtime chat demo into `src/experimental/realtime-chat` and removed the `/messages/realtime` route so it’s clearly unsupported in production builds.
  - [✔️] Decide if `RealtimeChatPage` + `realtime-chat.tsx` is a supported feature or experimental demo.
    DONE – 2025-12-04 05:08 – Marked realtime chat as an experimental demo only and kept it out of the routed app shell until officially supported.
    - [✖️] If **supported**:
      DONE – 2025-12-04 05:08 – Skipped installing/chat routing for now; revisit if promoting the feature to supported status.
      - [✖️] Ensure `@supabase/realtime-chat-react-router` is installed and documented.
      - [✖️] Add an “Experimental” or subtle entry point in navigation.
    - [✔️] If **not**:
      DONE – 2025-12-04 05:08 – Moved the demo page into `src/experimental/realtime-chat` and removed the route to avoid implying support.
      - [✔️] Move files into an experimental folder or remove the route and components to avoid confusion.

---

## 6. Search subsystem

- [✔️] `useSearchTitles` cancellation & structure
  DONE – 2025-12-03 22:14 – Propagated AbortSignals through search services, short-circuiting Supabase, TMDB, and catalog sync flows in `src/modules/search/search.service.ts` and `src/modules/search/externalMovieSearch.ts` so cancelled queries exit early.
  - [✔️] Update React Query `queryFn` to take `({ signal })` and pass the `signal` to all underlying fetches.
  - [✔️] Early-return from loops or transformations if `signal.aborted` is true.
  - [✔️] Ensure all Supabase, TMDB proxy, and catalog sync calls respect the `AbortSignal`.

- [ ] Batch catalog sync
  - [ ] Implement `catalog-sync-batch` Edge Function that:
    - [ ] Accepts an array of items `{ tmdbId, imdbId, mediaType }[]`.
    - [ ] Upserts titles into `public.titles` (and related tables) once per request.
    - [ ] Returns mapping from external IDs to internal title IDs.
  - [ ] Refactor search flow to:
    - [ ] Identify which TMDB results are not in the local library.
    - [ ] Only sync top N results per query.
    - [ ] Use `catalog-sync-batch` instead of multiple single-title sync calls.

- [✔️] Search result typing & UI
  DONE – 2025-12-04 04:26 – Added TitleSearchResult source typing, merged source propagation in search.service, and surfaced badges in SearchTitlesTab.
  - [✔️] Extend `TitleSearchResult` with `source: "library" | "external-synced" | "external-only"`.
    DONE – 2025-12-04 04:26 – TitleSearchResult now includes a source union to classify catalog vs synced vs external-only results.
  - [✔️] Populate `source` correctly for each item when merging local + TMDB data.
    DONE – 2025-12-04 04:26 – Supabase rows map to library source and external results flag synced vs external-only based on catalog-sync outcomes.
  - [✔️] Update UI to show a small badge or styling hint for the result source.
    DONE – 2025-12-04 04:26 – Search title rows render a pill badge indicating library, synced, or external origins.

- [✔️] Encode search state in URL
  DONE – 2025-12-03 22:14 – Synced search queries, tabs, and filters with URL params in `src/modules/search/SearchPage.tsx`, keeping reloads and history navigation aligned with the current search state.
  - [✔️] In `SearchPage`, derive `query`, `tab`, and filters (type, year range, language, genres) from `useSearchParams`.
  - [✔️] Update `searchParams` via `setSearchParams` when user changes filters or tabs (use `replace: true` where appropriate).
  - [✔️] Verify that:
    - [✔️] Reloading keeps the same search state.
    - [✔️] Back/forward navigation restores previous queries and filters.

- [✔️] Infinite scroll for search results
  DONE – 2025-12-04 04:55 – Added paginated title search with useInfiniteQuery, Supabase/TMDb paging, and a load-more control to keep results deduped across pages.
  - [✔️] Switch title search to `useInfiniteQuery` with a clear `getNextPageParam`.
  - [✔️] Implement loading more results as the user scrolls near the bottom (or via a “Load more” button).
  - [✔️] Ensure deduplication across pages (no repeated titles).

- [ ] Extract search service
  - [ ] Create `src/lib/searchTitles.service.ts` that:
    - [ ] Accepts query + filters as input.
    - [ ] Calls Supabase + TMDB proxy + batch sync as needed.
    - [ ] Returns a normalized array of `TitleSearchResult`.
  - [ ] Make `useSearchTitles` a thin React Query wrapper around this service.

---

## 7. Diary, stats & activity

- [✔️] Activity payload typing
  DONE – 2025-12-04 04:37 – Added discriminated payload typings and runtime validation for activity events in `src/modules/diary/useDiaryTimeline.ts` so diary items only consume well-formed data.
  - [✔️] Define a discriminated union type for `activity_events.payload` based on `event_type` (e.g. `log`, `rating`, `review`, `status_change`).
    DONE – 2025-12-04 04:37 – Introduced event-specific payload union covering ratings, reviews, watchlist, social, list, and message events in `useDiaryTimeline`.
  - [✔️] Implement a runtime validator (Zod or custom) to parse and validate payloads.
    DONE – 2025-12-04 04:37 – Added custom validators that narrow payloads per event type and ignore malformed values.
  - [✔️] Update `useDiaryTimeline` to:
    - [✔️] Parse payload through this validator.
      DONE – 2025-12-04 04:37 – Diary timeline now routes Supabase payloads through the validator before mapping to UI fields.
    - [✔️] Return a typed timeline entry or a safe fallback when invalid.
      DONE – 2025-12-04 04:37 – Timeline items now gracefully fall back to nulls when payload validation fails.

- [ ] `get_diary_stats` RPC
  - [ ] Implement Postgres function `get_diary_stats(p_user_id uuid)` that returns:
    - [ ] Average rating.
    - [ ] Rating distribution.
    - [ ] Watches per month/year.
    - [ ] Top genres (and optionally directors/cast if schema supports it).
  - [ ] Ensure it uses `auth.uid()` or otherwise enforces that users only see their own stats.
  - [ ] Add indexes to support any heavy aggregations if needed.

- [ ] Move diary stats computation to server
  - [ ] Update `useDiaryStats` to call `.rpc("get_diary_stats", { p_user_id: user.id })`.
  - [ ] Keep client-side work to light formatting and chart preparation only.

- [ ] Unified diary mutation (optional but recommended)
  - [ ] Design an Edge Function (e.g. `log-diary-event`) to:
    - [ ] Insert/update ratings, diary entries, library status as a single unit.
    - [ ] Append entries to `activity_events`.
  - [ ] Update diary UI interactions to use this function instead of multiple separate mutations.

---

## 8. Home feed & swipe

- [ ] Home feed modeling
  - [ ] Define a `HomeFeedItem` discriminated union, including variants such as:
    - [ ] `friend-rating`
    - [ ] `friend-review`
    - [ ] `recommendation`
    - [ ] `watchlist-add`
  - [ ] Implement `useHomeFeed(userId)` that:
    - [ ] Pulls data via Supabase / Edge Function.
    - [ ] Maps raw rows to `HomeFeedItem[]`.
  - [ ] Implement `HomeFeedItemCard` that switches on `item.kind` and renders appropriate cards.

- [ ] `get_home_feed` RPC
  - [ ] Implement Postgres function `get_home_feed(p_user_id uuid, p_limit int, p_cursor timestamptz/null)` to:
    - [ ] Build a timeline of relevant events from follows, reviews, ratings, etc.
    - [ ] Return rows with `kind`, `created_at`, `score`, and a JSON `payload`.
  - [ ] Update home feed Edge/React logic to call this RPC via Supabase.

- [✔️] Swipe deck state machine
  DONE – 2025-12-04 05:00 – Refactored `useSwipeDeck` to use an explicit status state with error messaging and exhaustion handling while keeping swipe logging non-blocking.
  - [✔️] In `useSwipeDeck.ts`, replace scattered booleans with a structured state:
    - [✔️] `status: "idle" | "loading" | "ready" | "exhausted" | "error"`.
    - [✔️] `cards`, `index`, optional `errorMessage`.
  - [✔️] Ensure state transitions are explicit and tested (e.g. `idle → loading → ready → exhausted`).
  - [✔️] Keep swipe logging (`swipe-event`) non-blocking for UI responsiveness.

- [ ] `select_for_you_swipe_deck` RPC
  - [ ] Implement Postgres function `select_for_you_swipe_deck(p_user_id uuid, p_limit int)` that:
    - [ ] Uses `ratings`, `library_entries`, `activity_events`, and preferences to rank titles.
    - [ ] Returns everything needed to render swipe cards.
  - [ ] Update `swipe-for-you` Edge Function to call this RPC (using `getAdminClient()` where appropriate) and map rows to swipe DTOs.

- [✔️] Per-variant swipe deck caching
  DONE – 2025-12-04 05:17 – Added React Query–backed deck caching per swipe variant and manual refresh support in `src/modules/swipe/useSwipeDeck.ts`.
  - [✔️] Use React Query keys like:
    - [✔️] `["swipeDeck", { variant: "for-you" }]`
    - [✔️] `["swipeDeck", { variant: "from-friends" }]`
    - [✔️] `["swipeDeck", { variant: "trending" }]`
  - [✔️] Cache decks per variant so tab-switching doesn’t refetch unnecessarily.
  - [✔️] Add a “refresh” action to manually fetch a new deck.

- [ ] Swipe Edge functions consolidation
  - [ ] Ensure shared logic (seen titles, preference profiles) is in `_shared/swipe.ts` and `_shared/preferences.ts`.
  - [ ] Make all swipe-related Edge Functions (`swipe-for-you`, `swipe-from-friends`, `swipe-trending`, `swipe-more-like-this`, `swipe-event`) use the new shared HTTP + Supabase helpers.
  - [ ] Keep `swipe-event` responses minimal (e.g. `{ ok: true }`) and allow UI to remain snappy.

- [✔️] Swipe imagery & UX
  DONE – 2025-12-04 05:32 – Normalized swipe cards to use TMDB image URLs with poster/backdrop fallbacks, prefetch upcoming artwork, and added richer aria-labels for card metadata in SwipePage.
  - [✔️] Use TMDB image helper for swipe cards (poster and/or backdrop).
  - [✔️] Prefetch images for the next 1–2 cards off-screen.
  - [✔️] Ensure cards have accessible labels (`aria-label` with title, year, and rating if any).

---

## 9. Settings, notifications, language & onboarding

- [✔️] Language setting wiring
  DONE – 2025-12-03 22:22 – Added en/es i18n scaffolding, translated nav/settings copy with useI18n, highlighted the coming-soon language selector, and routed TMDB requests through the stored locale.
  - [✔️] In `SettingsAppPage`, clearly mark the language selector as “coming soon” until full i18n is ready.
  - [✔️] Implement minimal i18n scaffolding:
    - [✔️] `src/i18n/en.json` (and possibly another locale).
    - [✔️] A small `useI18n()` hook returning `t(key)` and current language.
  - [✔️] Replace key strings (nav labels, major headings, key buttons) with `t("...")` calls.
  - [✔️] Use the selected language for TMDB requests when appropriate.

- [ ] Notification settings → backend
  - [✔️] Short term:
    - [✔️] In `SettingsNotificationsPage`, clarify that toggles are currently local to the device until wired to the backend.
      DONE – 2025-12-04 04:35 – Added device-only notice to SettingsNotificationsPage with Info icon callout to set expectations before backend sync.
  - [ ] Medium term:
    - [ ] Create `notification_preferences` table keyed by user ID, matching the options in the UI.
    - [ ] Add RLS so users can only read/write their own preferences.
    - [ ] Implement an Edge Function `update-notification-prefs` to read and update preferences.
    - [ ] Update `SettingsNotificationsPage` to:
      - [ ] Load preferences via React Query from Supabase.
      - [ ] Persist changes via the Edge Function instead of `localStorage`.

- [ ] Notification center (longer-term)
  - [ ] Build a basic `notifications` list page:
    - [ ] Bell icon with unread badge in the app shell.
    - [ ] List of notifications for the current user from the `notifications` table.
  - [ ] Implement a `create-notification` Edge Function called when:
    - [ ] Someone follows you.
    - [ ] Someone reacts to your review or message.
    - [ ] Other events you want to surface (e.g. mentions).

- [✔️] AvatarPicker integration
  DONE – 2025-12-04 04:30 – Wired AvatarPicker into SettingsProfilePage with Supabase Storage uploads to avatars/{userId}/ and profile avatar_url updates.
  - [ ] Decide on the role of `AvatarPicker`:
  - [✔️] If used:
      - [✔️] Add it to `SettingsProfilePage` for avatar uploads.
      - [✔️] Upload images to Supabase Storage (e.g. `avatars/{userId}`).
      - [✔️] Save `avatar_url` in `profiles` and use it across the app.
    - [✖️] If not used:
      - [✖️] Move `AvatarPicker` to a `future/` or `experimental/` folder or remove it to avoid dead code.

- [✔️] Settings overview
  DONE – 2025-12-03 22:28 – Wired /settings to the overview hub in router and routed profile gear to it; kept settings section labels consistent.
  - [✔️] Decide whether `SettingsOverviewPage` is a central hub or not:
    DONE – 2025-12-03 22:28 – Chose to keep the page as the central hub.
    - [✔️] If yes, wire `/settings` to show overview and link to subsections.
      DONE – 2025-12-03 22:28 – Added /settings route to SettingsOverviewPage with links to profile/account/notifications/app.
    - [✖️] If no, remove or de-emphasize this page to avoid confusion.
      DONE – 2025-12-03 22:28 – Not applicable after choosing the hub approach.
  - [✔️] Ensure routing and top bar labels are consistent for settings subsections.
    DONE – 2025-12-03 22:28 – Verified existing settings pages retain their labeled sections while routing flows through the overview.

- [✔️] Onboarding copy & lists
  DONE – 2025-12-03 22:28 – Softened onboarding callout to promise recommendations instead of list trading in OnboardingPage.
  - [✔️] Review `OnboardingPage` copy, especially:
    DONE – 2025-12-03 22:28 – Reviewed hero bullet text for overpromising lists.
    - [✔️] “Follow your crew, trade lists, and plan your next movie night together.”
      DONE – 2025-12-03 22:28 – Reworded to focus on recommendations and watch planning.
  - [✔️] Either:
    DONE – 2025-12-03 22:28 – Chose copy softening path over building lists.
    - [✔️] Soften copy to remove “trade lists” until the lists feature exists, or
      DONE – 2025-12-03 22:28 – Updated onboarding bullet to avoid promising list trading.
    - [✖️] Prioritize building a v1 Lists feature (create, edit, and share lists) to match the promise.
      DONE – 2025-12-03 22:28 – Deferred; copy adjusted so list feature is no longer implied.

---

## 10. UI, design system, accessibility & performance

- [✔️] Standardize UI primitives
  DONE – 2025-12-04 05:40 – Swapped search pages to shared Button/Input/Tabs primitives for consistent styling and accessibility in `src/modules/search/SearchPage.tsx`, `SearchTitlesTab.tsx`, and `SearchPeopleTab.tsx`.
  - [✔️] Replace ad-hoc buttons with the shared `Button` component where appropriate.
  - [✔️] Use shared `Tabs` for tabbed interfaces (home, swipe variants, search, diary).
  - [✔️] Use shared `Input` for search fields and forms, reducing repeated markup.

- [ ] Accessibility improvements
  - [✔️] Tabs:
    DONE – 2025-12-04 04:10 – Tabs component now wires IDs between triggers and panels for better a11y semantics.
    - [✔️] Ensure tab triggers have `role="tab"`, `aria-selected`, `aria-controls` and associated IDs.
      DONE – 2025-12-04 04:10 – Added stable trigger IDs to match aria-controls in shared Tabs triggers.
    - [✔️] Panels use `role="tabpanel"` and `aria-labelledby`.
      DONE – 2025-12-04 04:10 – Tabs panels now reference their trigger via aria-labelledby for SR navigation.
  - [✔️] Bottom navigation:
    DONE – 2025-12-04 04:17 – Wrapped the bottom navigation in a `<nav aria-label="Main">` container and kept icons hidden from screen readers in `src/layouts/AppShell.tsx`.
    - [✔️] Wrap in `<nav aria-label="Main">`.
      DONE – 2025-12-04 04:17 – Added an accessible landmark label to the fixed bottom navigation in `AppShell`.
    - [✔️] Hide icons from screen readers (`aria-hidden="true"`) and expose readable labels.
      DONE – 2025-12-04 04:17 – Confirmed bottom nav icons are decorative-only while text labels remain accessible.
  - [✔️] Modals & drawers:
    DONE – 2025-12-04 05:27 – Added focus traps, aria-modal dialog markup, and opener focus restoration for the message edit modal and home feed filters sheet in `src/modules/messages/ConversationPage.tsx` and `src/modules/home/HomeFeedTab.tsx`.
    - [✔️] Add focus trap and restore focus to the opener on close.
    - [✔️] Use `aria-modal="true"` and appropriate labeling.
  - [✔️] Messages:
    DONE – 2025-12-04 04:41 – Added aria-labels to message bubbles in `ConversationPage` to announce sender context for screen readers.
    - [✔️] Distinguish own vs others’ messages for screen readers (e.g. `aria-label` with “You” or sender name).
  - [✔️] Swipe cards:
    DONE – 2025-12-04 05:32 – Added descriptive aria-labels for swipe cards including title, year, and ratings on SwipePage.
    - [✔️] Provide accessible labels describing the current card (title, year, rating).

- [✔️] Prevent theme flash (FOUC)
  DONE – 2025-12-03 21:30 – Added inline theme preload in `index.html` to set the correct dark/light class before React mounts, matching `ui-store` behavior.
  - [✔️] Add an inline script in `index.html` before the JS bundle:
    DONE – 2025-12-03 21:30 – Inline script reads `moviNesta.ui` from `localStorage` and applies the resolved theme before the bundle loads.
    - [✔️] Read the stored theme from `localStorage` (same key as `ui-store`).
      DONE – 2025-12-03 21:30 – Theme preference is pulled from the persisted `moviNesta.ui` store key.
    - [✔️] Apply or remove the `dark` class on `document.documentElement` before React mounts.
      DONE – 2025-12-03 21:30 – Script toggles the `dark` class immediately using system preference when set to `system`.
  - [✔️] Ensure logic matches the theme computation in `ui-store.ts`.
    DONE – 2025-12-03 21:30 – Theme resolution mirrors `resolvePreferredTheme` including system-based `prefers-color-scheme` handling.

- [ ] List virtualization
  - [ ] Introduce virtualization (e.g. `react-window` or similar) for:
    - [ ] Long conversation message lists.
    - [ ] Diary timelines with many entries.
    - [ ] Large search result sets.
    - [ ] Home feed lists.
  - [ ] Ensure scroll-to-bottom in chat still works correctly with virtualization.

- [✔️] Skeletons & perceived performance
  DONE – 2025-12-04 05:05 – Added inbox list skeletons alongside existing swipe/search/diary loading placeholders so key flows stay visually stable while data loads.
  - [✔️] Add skeleton components for:
    - [✔️] Conversations list.
    - [✔️] Swipe deck.
    - [✔️] Search results.
    - [✔️] Diary timeline and stats.
  - [✔️] Use skeletons while queries are loading to avoid jarring blank states.

- [ ] Background prefetch & app shell performance
  - [ ] After successful sign-in, prefetch:
    - [ ] Home feed.
    - [ ] Swipe decks.
    - [ ] Recent conversations.
    - [ ] Diary stats summary.
  - [ ] Use React Query prefetch APIs and/or idle callbacks to avoid blocking initial paint.

- [✔️] Routing & code splitting
  DONE – 2025-12-03 16:30 – Lazy loaded all page-level routes in `src/router.tsx` while keeping `AppShell` eager and retaining the existing Suspense fallback.
  - [✔️] Use `React.lazy` + `Suspense` for page-level components (Home, Swipe, Search, Diary, Settings, Messages).
  - [✔️] Keep `AppShell` and core layout non-lazy.
  - [✔️] Provide meaningful fallbacks (skeletons, loading text) during lazy loading.

- [✔️] Date & number formatting
  DONE – 2025-12-03 16:42 – Added shared Intl-based helpers in `src/utils/format.ts` and wired message timestamps, diary dates, settings, and swipe social proof to use them for locale-aware output.
  - [✔️] Centralize date formatting via `Intl.DateTimeFormat`, respecting language/locale settings.
    DONE – 2025-12-03 16:42 – Introduced reusable date/time formatters in `src/utils/format.ts` and replaced ad-hoc `toLocale*` calls in message/diary/settings UI.
  - [✔️] Centralize ratings and other numeric formatting via `Intl.NumberFormat`.
    DONE – 2025-12-03 16:42 – Added a shared number formatter and applied it to swipe social proof counts for consistent locale-aware numbers.
  - [✔️] Use these helpers consistently across messages, diary, stats, and home feed.
    DONE – 2025-12-03 16:42 – Updated chat messages, conversation timestamps, diary stats/timeline, and settings account info to rely on the shared format helpers.

- [✔️] Toasts & inline error feedback
  DONE – 2025-12-03 17:54 – Toast system wired to React Query global errors with inline retry flows for failed messages and swipe logging across the app.
  - [✔️] Implement a minimal toast system for global notifications.
    DONE – 2025-12-03 16:59 – Added reusable toast store, helpers, and provider overlay for global notifications in `src/components/toasts` rendered via `App`.
  - [✔️] Connect React Query global error handler to show a toast when requests fail.
    DONE – 2025-12-03 16:59 – Wired React Query defaults to surface query/mutation errors through the toast helper in `src/lib/react-query.ts`.
  - [ ] Show inline failure states for:
    - [✔️] Message send failures (with retry).
      DONE – 2025-12-03 17:06 – Added inline failed-message state with retry controls in `src/modules/messages/ConversationPage.tsx` so unsent chats can be resent without losing context.
    - [✔️] Swipe logging failures (optional retry).
      DONE – 2025-05-17 00:35 – Added swipe sync banners with retry hooks so failed swipe logs can be retried inline across swipe tabs and the combined swipe page.

---

## 11. React Query, services & data layer

- [ ] Extract domain services
  - [ ] Create service modules (`messages.service.ts`, `search.service.ts`, `diary.service.ts`, `swipe.service.ts`, `homeFeed.service.ts`) that:
    - [ ] Contain pure functions calling Supabase/Edge Functions.
    - [ ] Map raw rows to domain models (`UiMessage`, `TitleSearchResult`, `DiaryEntry`, `SwipeCardData`, `HomeFeedItem`).
  - [ ] Refactor hooks (`useConversations`, `useConversationMessages`, `useSearchTitles`, `useDiaryTimeline`, `useDiaryStats`, `useSwipeDeck`, `useHomeFeed`) to:
    - [ ] Become thin React Query wrappers around these services.

- [✔️] Tune React Query settings
  DONE – 2025-12-03 17:59 – Tuned React Query defaults and per-screen options for static vs. real-time data in `src/lib/react-query.ts`, search, title details, and home feeds.
  - [✔️] For relatively static data (title metadata, TMDB info), use longer `staleTime` and avoid aggressive `refetchOnWindowFocus`.
    DONE – 2025-12-03 17:59 – Added longer cache windows and disabled focus refetch for title search/detail queries.
  - [✔️] For dynamic data (messages, swipe decks, home feed), use shorter `staleTime` and consider enabling `refetchOnWindowFocus`.
    DONE – 2025-12-03 17:59 – Shortened cache windows and turned on focus/reconnect refetching for feed and diary-related queries.
  - [✔️] Use `keepPreviousData` / `placeholderData` for paginated lists to avoid flicker.
    DONE – 2025-12-03 17:59 – Enabled previous data retention for the home feed infinite query and added placeholders to search results.

- [✔️] Cancellable work
  DONE – 2025-12-03 18:04 – Threaded `AbortSignal` through title search and TMDB helpers so combined catalog+external lookups can cancel promptly.
  - [✔️] Ensure all multi-step workflows (combined search, complex feed building) accept `AbortSignal` and check `signal.aborted`.
    DONE – 2025-12-03 18:04 – Added abort handling to the title search React Query hook, including early abort guards and passing signals to Supabase and TMDB requests.
  - [✔️] Propagate `signal` down into underlying fetch calls.
    DONE – 2025-12-03 18:04 – TMDB fetch utilities and catalog sync invocations now forward React Query signals to network calls for cooperative cancellation.

---

## 12. Media, attachments & hero pages

- [✔️] Chat attachments
  DONE – 2025-12-03 20:14 – Hardened chat attachment UX with storage uploads, signed URL verification, and clearer failure handling in ConversationPage.
  - [✔️] Verify attachment upload flow:
    DONE – 2025-12-03 20:14 – Conversation attachments now upload to chat-media under message_attachments paths, validate signed URL creation, and surface errors to users.
    - [✔️] Upload to Supabase Storage (e.g. `message_attachments/{conversation}/{id}`).
      DONE – 2025-12-03 20:14 – Image uploads target `chat-media/message_attachments/{conversation}/{user}/{timestamp-random}.ext` for organized per-thread storage.
    - [✔️] Generate and use signed URLs where necessary.
      DONE – 2025-12-03 20:14 – Post-upload flow requires signed URL creation and ChatImage continues to render attachments via signed URLs.
  - [✔️] Confirm `ChatImage` (and related components) support `loading="lazy"`, proper alt text, and safe error states.
    DONE – 2025-12-03 19:08 – Added tests for ChatImage covering skeleton, lazy-loaded signed URLs, and error fallback while exporting the component for reuse.
  - [✔️] Add an attachment button to `MessageComposer` if not already wired end-to-end.
    DONE – 2025-12-03 20:14 – Conversation composer retains a dedicated attachment control with upload validation and dismissible error messaging.

- [✔️] Hero title pages
  DONE – 2025-12-03 20:30 – Refreshed TitleDetailPage hero with backdrop overlay, CTA buttons for diary/watchlist/rating, image prefetching, and shared diary hook usage.
  - [✔️] Ensure `TitleDetailPage`:
    DONE – 2025-12-03 20:30 – Added gradient-backed hero with preloaded artwork, legible text, and CTA controls wired to diary mutations.
    - [✔️] Uses backdrop + overlay for legible text.
      DONE – 2025-12-03 20:30 – Hero now layers a gradient over the backdrop to keep title metadata readable.
    - [✔️] Exposes clear CTAs (log, rate, add to watchlist) wired to diary/library mutations.
      DONE – 2025-12-03 20:30 – Added watchlist/watching/watched buttons and inline rating controls powered by diary mutations.
    - [✔️] Prefetches primary poster/backdrop for a snappy hero experience.
      DONE – 2025-12-03 20:30 – Poster and backdrop URLs are preloaded via Image() to warm the cache before render.
  - [✔️] Make sure stats and diary info on title pages rely on the same library/diary hooks used elsewhere.
    DONE – 2025-12-03 20:30 – TitleDetailPage now reads diary status/ratings through the shared useTitleDiaryEntry hook.

---

## 13. Testing & CI

- [✔️] Unit tests for pure logic
  DONE – 2025-12-03 21:27 – Confirmed coverage for message text parsing, search merges, diary stats reducer, swipe deck helpers, and preferences builder across src/__tests__/messageText.test.ts, search.service.test.ts, diaryStatsReducer.test.ts, swipeDeckHelpers.test.ts, and preferences.test.ts.
  - [✔️] Message text helpers:
    DONE – 2025-12-03 20:08 – Added unit tests for parseMessageText/getMessagePreview/getMessageMeta to cover plain strings, JSON payloads, and metadata handling in src/modules/messages/messageText.ts and src/__tests__/messageText.test.ts.
    - [✔️] Parsing plain text vs JSON bodies.
      DONE – 2025-12-03 20:08 – Covered plain strings, rich-text blocks, image placeholders, and fallbacks in parseMessageText with preview normalization.
    - [✔️] Handling deleted/edited message metadata if applicable.
      DONE – 2025-12-03 20:08 – Extracted metadata parsing into getMessageMeta and validated edited/deleted flags via unit tests.
- [✔️] Search merge logic:
  DONE – 2025-12-03 20:38 – Added Vitest coverage for searchTitles merge behavior to keep Supabase/library results ahead of TMDb fallbacks and avoid duplicate tmdbId entries (src/__tests__/search.service.test.ts).
  - [✔️] Deduping titles across local vs external sources.
    DONE – 2025-12-03 20:38 – Test ensures tmdbId collisions skip external duplicates while retaining existing Supabase rows.
  - [✔️] Source precedence (`library` vs `external-synced` vs `external-only`).
    DONE – 2025-12-03 20:38 – Verified library items surface first, followed by synced external IDs, then unsynced TMDb results.
  - [✔️] Diary stats reducer:
    DONE – 2025-12-03 20:43 – Added reusable diary stats reducer with typed helpers and coverage in `src/__tests__/diaryStatsReducer.test.ts` to validate averages, buckets, and watch timelines.
    - [✔️] Correct averages and distributions.
      DONE – 2025-12-03 20:43 – reduceDiaryStats now computes stable averages and 0.5-step distributions, exercised by new vitest cases.
    - [✔️] Accurate monthly/yearly watch counts.
      DONE – 2025-12-03 20:43 – Added watch-count aggregation tests to ensure chronological month buckets for diary stats.
  - [✔️] Swipe deck helpers:
    DONE – 2025-12-03 20:43 – Exported swipe deck helper utilities and covered interleaving, trimming, and weight persistence in `src/__tests__/swipeDeckHelpers.test.ts`.
    - [✔️] Next-card selection.
      DONE – 2025-12-03 20:43 – buildInterleavedDeck test asserts round-robin ordering caps combined decks at the requested limit.
    - [✔️] Exhaustion state transitions.
      DONE – 2025-12-03 20:43 – trimDeck helper verified to drop consumed cards and mark exhaustion when decks empty.
  - [✔️] Preferences builder (`_shared/preferences.ts`):
    DONE – 2025-12-03 20:43 – Added vitest coverage for computeUserProfile to combine ratings, library, and activity signals into genre/content weights.
    - [✔️] Correctly builds `UserProfile` from ratings, library, and activity.
      DONE – 2025-12-03 20:43 – Preferences tests confirm positive/negative signals and content-type weights from mocked Supabase data.

- [✔️] Auth & provider tests
  DONE – 2025-12-03 21:27 – AuthProvider scenarios (no session, restore session, sign-out) covered via Vitest and Testing Library in src/__tests__/authProvider.test.tsx.
  - [✔️] Add tests for `AuthProvider`:
    DONE – 2025-12-03 18:30 – Added Vitest + Testing Library coverage for AuthProvider to verify initial no-session load, restoring existing sessions, and clearing user state on sign-out.
    - [✔️] Initial state with no session.
    - [✔️] Session restoration from Supabase.
    - [✔️] Sign-out clearing session and related local state.

- [✔️] Component / snapshot tests
  - [✔️] Add lightweight tests (Vitest + React Testing Library) for:
    - [✔️] Conversation list item (with and without unread).
    - [✔️] Message bubble (self vs other).
    - [✔️] Swipe card component.
    - [✔️] Title search result row.
    - [✔️] Skeleton components (render without crashing).
    DONE – 2025-12-03 19:16 – Added snapshot-style component coverage for conversation list states, message bubble styling, swipe card metadata, title search rows, and skeletons in `src/__tests__/uiComponents.test.tsx`.

- [✔️] CI wiring
  DONE – 2025-12-03 19:22 – Added CI workflow running npm ci, lint, and tests on push/PR to main via `.github/workflows/ci.yml`.
  - [✔️] Confirm CI workflow runs `npm run lint` and `npm test` on every push/PR.
    DONE – 2025-12-03 19:22 – CI job now installs dependencies then runs lint and tests across pushes and PRs.
  - [✔️] Optionally add coverage reporting and fail CI below a chosen threshold.
    DONE – 2025-12-03 20:15 – Enabled Vitest v8 coverage reporting with branch/line thresholds, enforced via `npm test` and CI.

---

## 14. DX & documentation

- [✔️] README & environment docs
  - [✔️] Expand `README.md` to cover:
    - [✔️] Tech stack (Vite, React, TypeScript, Supabase, Edge functions, TMDB/OMDb).
    - [✔️] Local dev setup (`npm install`, `npm run dev`).
    - [✔️] Supabase setup (migrations via `supabase/schema.sql`, environment vars).
    - [✔️] Edge Function deployment commands (`supabase functions deploy ...`).
    - [✔️] All relevant env vars:
      - [✔️] `VITE_SUPABASE_URL`
      - [✔️] `VITE_SUPABASE_ANON_KEY` (and any other public keys)
      - [✔️] Service role, TMDB/OMDb keys, etc. (documented but not committed).
    DONE – 2025-12-03 18:09 – Added README with stack overview, local dev steps, Supabase setup, Edge Function deploy commands, env var matrix, and Supabase type regeneration instructions.
    - [✔️] Document how to regenerate Supabase types and where they live.

- [✔️] Developer comments & experimental flags
  DONE – 2025-12-03 18:25 – Added file-level summaries to `useSwipeDeck` and `useConversations` explaining their roles and current polling/Edge Function assumptions; documented messaging as a simple polled experience until realtime wiring ships.
  - [✔️] Add short comments at top of complex or central files (`useSwipeDeck`, `useConversations`, `get_home_feed` SQL, key Edge functions) describing their purpose and assumptions.
  - [✔️] Clearly tag experimental/demo features (Realtime chat, Lists if not yet implemented) so future maintainers know what is production vs experimental.

- [✔️] React Router v7 readiness
  DONE – 2025-12-03 22:19 – Opted into React Router v7 startTransition and relative splat path flags in app and test routers to silence future warnings and align navigation behavior.

---

_This checklist is designed so an AI coding agent (or a human) can work through it item by item, marking `[✔️]` or `[✖️]` and adding a dated `DONE – ...` summary line under each completed task._
