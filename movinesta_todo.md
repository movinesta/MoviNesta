# MoviNesta – AI Coding Agent TODO Checklist

_For each task or subtask below:_

- Change `- [ ]` to `- [✔️]` when the work is fully completed (or `[✖️]` if intentionally skipped).
- Immediately under the completed line, append:

  `DONE – YYYY-MM-DD HH:MM – one-line summary of what changed (mention key files + impact)`

  Example:

  `DONE – 2025-12-03 14:32 – Refactored useConversations to use get_conversation_summaries RPC; reduced 5 queries to 1.`

---

## 1. Repo & infra hygiene

- [ ] Ensure Supabase `Database` types file exists and is wired
  - [ ] Confirm `src/types/supabase.ts` is generated and checked into the repo.
  - [ ] Add or verify a script (e.g. `npm run generate:supabase-types`) that runs `supabase gen types typescript --schema public` and writes to `src/types/supabase.ts`.
  - [ ] Replace any ad-hoc `import type { Database } from "...";` with a single canonical import path (e.g. `@/types/supabase`).
  - [ ] Update hooks like `useProfile`, `useConversations`, `useBlockStatus`, diary and swipe hooks to use typed row types instead of `any` (and remove casts like `(profileError as any)`).

- [ ] Clean up build outputs
  - [✔️] Confirm Vite builds to `docs/` (for GitHub Pages) via `vite.config.ts`.
    DONE – 2025-12-03 15:06 – Verified `vite.config.ts` already targets `docs/` for builds, aligning with GitHub Pages output.
  - [✔️] Remove any committed `dist/` directory from version control if present.
    DONE – 2025-12-03 15:06 – Removed tracked `dist/` artifacts now that builds publish to `docs/` only.
  - [✔️] Ensure `.gitignore` includes `dist/` so only `docs/` is used as the static output.
    DONE – 2025-12-03 15:06 – Confirmed `.gitignore` excludes `dist/` to prevent reintroducing build outputs.
  - [✔️] Verify any build helper scripts (e.g. `scripts/copy404.mjs`) still make sense for the `docs/` deployment target.
    DONE – 2025-12-03 15:06 – Confirmed `scripts/copy404.mjs` copies `docs/index.html` to `docs/404.html` for SPA fallback.

- [ ] GitHub Actions workflows
  - [ ] Keep deploy workflow focused on build & deploy only (no tests in the deploy pipeline).
    DONE – 2025-12-03 15:06 – Verified deploy workflow only builds and publishes without bundling tests into the pipeline.
  - [✔️] Ensure a dedicated CI workflow (e.g. `ci.yml` or `test.yml`) runs on `push` and `pull_request` to `main`:
    - [✔️] `npm ci`
      DONE – 2025-12-03 15:06 – Added CI job step to install dependencies via `npm ci` on pushes/PRs to `main`.
    - [✔️] `npm run lint`
      DONE – 2025-12-03 15:06 – CI now runs `npm run lint` to enforce linting during automated checks.
    - [✔️] `npm test`
      DONE – 2025-12-03 15:06 – CI executes `npm test` with Vitest as part of the workflow.
  - [✔️] Fail the workflow when lint or tests fail so broken changes can’t be merged.
    DONE – 2025-12-03 15:06 – CI workflow stops on lint/test failures, preventing merges of broken builds.

---

## 2. Supabase clients, type-safety, security & RLS

- [ ] Split user vs admin Supabase clients for Edge Functions
  - [ ] Create `supabase/functions/_shared/supabase.ts` with:
    - [ ] `getUserClient()` that uses `SUPABASE_URL` + `SUPABASE_ANON_KEY` and respects RLS.
    - [ ] `getAdminClient()` that uses `SUPABASE_SERVICE_ROLE_KEY` for cross-user or aggregation workflows that truly need it.
  - [ ] Refactor existing Edge Functions (`swipe-*`, `catalog-*`, `create-direct-conversation`, etc.) to use these helpers instead of re-creating clients inline.
  - [ ] Make sure `getAdminClient()` is only used when strictly necessary.

- [ ] Frontend Supabase client hygiene
  - [ ] Consolidate to a single browser Supabase client in `src/lib/supabase.ts`.
  - [ ] Validate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at startup and throw a clear error if they’re missing.
  - [ ] Only attach `window.supabase = supabase` in **development** (`import.meta.env.DEV === true`).
  - [ ] Remove or move `src/lib/client.ts` / `src/lib/server.ts` if they are unused in this Vite SPA, or relocate them into a clearly separated `server/` folder if kept for SSR/back-end use.

- [ ] Type-safety for Supabase queries
  - [ ] Update `useConversations` to use `Database` row types instead of `any` for conversations, participants, messages, and read receipts.
  - [ ] Update `useProfile` (and related profile hooks) to:
    - [ ] Use typed `profiles` + `follows` rows.
    - [ ] Replace casts like `(profileError as any)` with proper error typing or narrowing.
  - [ ] Ensure other key hooks (`useDiaryTimeline`, `useDiaryLibrary`, `useDiaryStats`, `useHomeFeed`, `useSwipeDeck`, `useBlockStatus`) are using typed Supabase responses and avoid `any`.

- [ ] RLS policies and indexes
  - [ ] Audit and add Row Level Security (RLS) policies for all user-data tables, including:
    - [ ] `profiles`
    - [ ] `ratings`, `reviews`, `review_reactions`
    - [ ] `library_entries`, `episode_progress`
    - [ ] `activity_events`
    - [ ] `follows`, `blocked_users`
    - [ ] `conversations`, `conversation_participants`
    - [ ] `messages`, `message_read_receipts`, `message_delivery_receipts`, `message_reactions`
    - [ ] `swipes`
    - [ ] `notifications` and (future) `notification_preferences`
    - [ ] `reports` (for moderation)
  - [ ] Ensure policies restrict access to `auth.uid()` and/or conversation membership, as appropriate.
  - [ ] Add or verify indexes for frequent access patterns:
    - [ ] `ratings(user_id)`
    - [ ] `library_entries(user_id)`
    - [ ] `activity_events(user_id, created_at)`
    - [ ] `follows(follower_id)`, `follows(followed_id)`
    - [ ] `blocked_users(blocker_id)`, `blocked_users(blocked_id)`
    - [ ] `conversation_participants(user_id)`, `conversation_participants(conversation_id)`
    - [ ] `messages(conversation_id, created_at desc)`
    - [ ] `message_read_receipts(user_id, conversation_id)`
    - [ ] `swipes(user_id, created_at)`
    - [ ] Any other indices referenced in RPCs or heavy queries.

- [ ] Direct conversation uniqueness
  - [ ] Add a unique index to prevent duplicate 1-to-1 conversations when `is_group = false` (e.g. a normalized pair of user IDs).
  - [ ] Update `create-direct-conversation` Edge Function to:
    - [ ] Use this unique constraint and handle “conversation already exists” gracefully.
    - [ ] Return the existing conversation instead of creating a duplicate.

---

## 3. Shared Edge utilities & HTTP layer

- [ ] Add shared Edge HTTP helpers
  - [ ] Create `supabase/functions/_shared/http.ts` with:
    - [ ] `jsonResponse(data, status = 200)` – consistent JSON + CORS response.
    - [ ] `jsonError(message, status, code)` – standardized error shape `{ ok: false, error, code }`.
    - [ ] Shared `corsHeaders` and OPTIONS handler for CORS preflight.
  - [ ] Refactor Edge Functions (`catalog-*`, `swipe-*`, `debug-env`, etc.) to use these helpers instead of duplicating `jsonOk/jsonError/corsHeaders`.

- [ ] Request validation helpers
  - [ ] Introduce a `validateRequest<T>()` helper that:
    - [ ] Parses `req.json()` safely.
    - [ ] Validates required fields and basic types (manually or via a small schema).
    - [ ] Returns typed payload or responds with HTTP 400 via `jsonError`.
  - [ ] Use this helper in functions like `swipe-event`, `swipe-for-you`, `catalog-sync`, and any other write-heavy endpoints.

- [ ] `debug-env` hardening
  - [ ] Ensure `debug-env` returns only non-sensitive meta (e.g. booleans, build ID, feature flags), never secrets or raw env values.
  - [ ] Optionally gate or disable `debug-env` in production behind an environment flag.

---

## 4. Supabase + TMDB integration

- [ ] Reusable Edge Function caller in frontend
  - [ ] Add `src/lib/callSupabaseFunction.ts` with:
    - [ ] `callSupabaseFunction<T>(name: string, body: unknown, opts?: { timeoutMs?: number }): Promise<T>`.
    - [ ] An `AbortController` + default timeout (e.g. 25s).
    - [ ] Clear error throwing when `error` exists or `data` is missing.
  - [ ] Refactor all `supabase.functions.invoke` usages (search, catalog sync, swipe, etc.) to use this helper.

- [ ] TMDB proxy Edge Function
  - [ ] Implement a `tmdb-proxy` Edge Function that:
    - [ ] Accepts a constrained set of TMDB paths and query parameters.
    - [ ] Injects the TMDB read token on the server side.
    - [ ] Validates input so the proxy can’t be abused as a generic TMDB explorer.
  - [ ] Update frontend TMDB calls to go through `callSupabaseFunction("tmdb-proxy", ...)` instead of calling TMDB directly.
  - [ ] Remove any direct TMDB read token usage from frontend code.

- [ ] TMDB image helper & performance
  - [ ] Add a central helper (e.g. `tmdbImageUrl(path, size)`).
  - [ ] Replace inline `https://image.tmdb.org/t/p/...` usages (e.g. in title detail, swipe cards, search results) with this helper.
  - [ ] Use appropriate sizes depending on context (`w342` / `w500` / etc.).
  - [ ] Add `loading="lazy"` for non-critical images (lists, avatars).
  - [ ] Prefetch images for the next few swipe cards to improve perceived performance.

---

## 5. Messaging & conversations

- [ ] Type-safe `useConversations` hook
  - [ ] Import typed rows from `Database` for conversations, participants, messages, and read receipts.
  - [ ] Replace any `any` or manual casting with proper typing.
  - [ ] Confirm mapping logic filters out null IDs safely and correctly derives conversation IDs.

- [ ] `get_conversation_summaries` RPC
  - [ ] Create Postgres function `get_conversation_summaries(p_user_id uuid)` that returns:
    - [ ] `conversation_id`, `is_group`, `title`, `created_at`, `updated_at`.
    - [ ] `last_message_id`, `last_message_body`, `last_message_created_at`, plus sender summary.
    - [ ] Participants as JSON array (id, displayName, username, avatarUrl, isSelf).
    - [ ] Read receipt summary per conversation (e.g. last read message/timestamp for the current user).
  - [ ] Use efficient SQL patterns (`DISTINCT ON`, window functions, indexes) to avoid N+1 queries.
  - [ ] Add or verify supporting indexes as needed.

- [ ] Refactor `useConversations` to use the RPC
  - [ ] Replace the multi-query waterfall with a single call to `.rpc("get_conversation_summaries", { p_user_id: user.id })`.
  - [ ] Map RPC rows to the existing `ConversationListItem` UI model:
    - [ ] Compute `lastMessageAt` from last message or conversation timestamps.
    - [ ] Generate a message preview from `body` or JSON payload.
    - [ ] Use read receipts to derive `hasUnread`.

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
    - [ ] Ensure `useBlockStatus` remains type-safe and uses a single Supabase client.
  - [ ] Add tests for the “blocked” behavior at least at the hook/service level.

- [ ] Global realtime chat (experimental)
  - [ ] Decide if `RealtimeChatPage` + `realtime-chat.tsx` is a supported feature or experimental demo.
    - [ ] If **supported**:
      - [ ] Ensure `@supabase/realtime-chat-react-router` is installed and documented.
      - [ ] Add an “Experimental” or subtle entry point in navigation.
    - [ ] If **not**:
      - [ ] Move files into an experimental folder or remove the route and components to avoid confusion.

---

## 6. Search subsystem

- [ ] `useSearchTitles` cancellation & structure
  - [ ] Update React Query `queryFn` to take `({ signal })` and pass the `signal` to all underlying fetches.
  - [ ] Early-return from loops or transformations if `signal.aborted` is true.
  - [ ] Ensure all Supabase, TMDB proxy, and catalog sync calls respect the `AbortSignal`.

- [ ] Batch catalog sync
  - [ ] Implement `catalog-sync-batch` Edge Function that:
    - [ ] Accepts an array of items `{ tmdbId, imdbId, mediaType }[]`.
    - [ ] Upserts titles into `public.titles` (and related tables) once per request.
    - [ ] Returns mapping from external IDs to internal title IDs.
  - [ ] Refactor search flow to:
    - [ ] Identify which TMDB results are not in the local library.
    - [ ] Only sync top N results per query.
    - [ ] Use `catalog-sync-batch` instead of multiple single-title sync calls.

- [ ] Search result typing & UI
  - [ ] Extend `TitleSearchResult` with `source: "library" | "external-synced" | "external-only"`.
  - [ ] Populate `source` correctly for each item when merging local + TMDB data.
  - [ ] Update UI to show a small badge or styling hint for the result source.

- [ ] Encode search state in URL
  - [ ] In `SearchPage`, derive `query`, `tab`, and filters (type, year range, language, genres) from `useSearchParams`.
  - [ ] Update `searchParams` via `setSearchParams` when user changes filters or tabs (use `replace: true` where appropriate).
  - [ ] Verify that:
    - [ ] Reloading keeps the same search state.
    - [ ] Back/forward navigation restores previous queries and filters.

- [ ] Infinite scroll for search results
  - [ ] Switch title search to `useInfiniteQuery` with a clear `getNextPageParam`.
  - [ ] Implement loading more results as the user scrolls near the bottom (or via a “Load more” button).
  - [ ] Ensure deduplication across pages (no repeated titles).

- [ ] Extract search service
  - [ ] Create `src/lib/searchTitles.service.ts` that:
    - [ ] Accepts query + filters as input.
    - [ ] Calls Supabase + TMDB proxy + batch sync as needed.
    - [ ] Returns a normalized array of `TitleSearchResult`.
  - [ ] Make `useSearchTitles` a thin React Query wrapper around this service.

---

## 7. Diary, stats & activity

- [ ] Activity payload typing
  - [ ] Define a discriminated union type for `activity_events.payload` based on `event_type` (e.g. `log`, `rating`, `review`, `status_change`).
  - [ ] Implement a runtime validator (Zod or custom) to parse and validate payloads.
  - [ ] Update `useDiaryTimeline` to:
    - [ ] Parse payload through this validator.
    - [ ] Return a typed timeline entry or a safe fallback when invalid.

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

- [ ] Swipe deck state machine
  - [ ] In `useSwipeDeck.ts`, replace scattered booleans with a structured state:
    - [ ] `status: "idle" | "loading" | "ready" | "exhausted" | "error"`.
    - [ ] `cards`, `index`, optional `errorMessage`.
  - [ ] Ensure state transitions are explicit and tested (e.g. `idle → loading → ready → exhausted`).
  - [ ] Keep swipe logging (`swipe-event`) non-blocking for UI responsiveness.

- [ ] `select_for_you_swipe_deck` RPC
  - [ ] Implement Postgres function `select_for_you_swipe_deck(p_user_id uuid, p_limit int)` that:
    - [ ] Uses `ratings`, `library_entries`, `activity_events`, and preferences to rank titles.
    - [ ] Returns everything needed to render swipe cards.
  - [ ] Update `swipe-for-you` Edge Function to call this RPC (using `getAdminClient()` where appropriate) and map rows to swipe DTOs.

- [ ] Per-variant swipe deck caching
  - [ ] Use React Query keys like:
    - [ ] `["swipeDeck", { variant: "for-you" }]`
    - [ ] `["swipeDeck", { variant: "from-friends" }]`
    - [ ] `["swipeDeck", { variant: "trending" }]`
  - [ ] Cache decks per variant so tab-switching doesn’t refetch unnecessarily.
  - [ ] Add a “refresh” action to manually fetch a new deck.

- [ ] Swipe Edge functions consolidation
  - [ ] Ensure shared logic (seen titles, preference profiles) is in `_shared/swipe.ts` and `_shared/preferences.ts`.
  - [ ] Make all swipe-related Edge Functions (`swipe-for-you`, `swipe-from-friends`, `swipe-trending`, `swipe-more-like-this`, `swipe-event`) use the new shared HTTP + Supabase helpers.
  - [ ] Keep `swipe-event` responses minimal (e.g. `{ ok: true }`) and allow UI to remain snappy.

- [ ] Swipe imagery & UX
  - [ ] Use TMDB image helper for swipe cards (poster and/or backdrop).
  - [ ] Prefetch images for the next 1–2 cards off-screen.
  - [ ] Ensure cards have accessible labels (`aria-label` with title, year, and rating if any).

---

## 9. Settings, notifications, language & onboarding

- [ ] Language setting wiring
  - [ ] In `SettingsAppPage`, clearly mark the language selector as “coming soon” until full i18n is ready.
  - [ ] Implement minimal i18n scaffolding:
    - [ ] `src/i18n/en.json` (and possibly another locale).
    - [ ] A small `useI18n()` hook returning `t(key)` and current language.
  - [ ] Replace key strings (nav labels, major headings, key buttons) with `t("...")` calls.
  - [ ] Use the selected language for TMDB requests when appropriate.

- [ ] Notification settings → backend
  - [ ] Short term:
    - [ ] In `SettingsNotificationsPage`, clarify that toggles are currently local to the device until wired to the backend.
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

- [ ] AvatarPicker integration
  - [ ] Decide on the role of `AvatarPicker`:
    - [ ] If used:
      - [ ] Add it to `SettingsProfilePage` for avatar uploads.
      - [ ] Upload images to Supabase Storage (e.g. `avatars/{userId}`).
      - [ ] Save `avatar_url` in `profiles` and use it across the app.
    - [ ] If not used:
      - [ ] Move `AvatarPicker` to a `future/` or `experimental/` folder or remove it to avoid dead code.

- [ ] Settings overview
  - [ ] Decide whether `SettingsOverviewPage` is a central hub or not:
    - [ ] If yes, wire `/settings` to show overview and link to subsections.
    - [ ] If no, remove or de-emphasize this page to avoid confusion.
  - [ ] Ensure routing and top bar labels are consistent for settings subsections.

- [ ] Onboarding copy & lists
  - [ ] Review `OnboardingPage` copy, especially:
    - [ ] “Follow your crew, trade lists, and plan your next movie night together.”
  - [ ] Either:
    - [ ] Soften copy to remove “trade lists” until the lists feature exists, or
    - [ ] Prioritize building a v1 Lists feature (create, edit, and share lists) to match the promise.

---

## 10. UI, design system, accessibility & performance

- [ ] Standardize UI primitives
  - [ ] Replace ad-hoc buttons with the shared `Button` component where appropriate.
  - [ ] Use shared `Tabs` for tabbed interfaces (home, swipe variants, search, diary).
  - [ ] Use shared `Input` for search fields and forms, reducing repeated markup.

- [ ] Accessibility improvements
  - [ ] Tabs:
    - [ ] Ensure tab triggers have `role="tab"`, `aria-selected`, `aria-controls` and associated IDs.
    - [ ] Panels use `role="tabpanel"` and `aria-labelledby`.
  - [ ] Bottom navigation:
    - [ ] Wrap in `<nav aria-label="Main">`.
    - [ ] Hide icons from screen readers (`aria-hidden="true"`) and expose readable labels.
  - [ ] Modals & drawers:
    - [ ] Add focus trap and restore focus to the opener on close.
    - [ ] Use `aria-modal="true"` and appropriate labeling.
  - [ ] Messages:
    - [ ] Distinguish own vs others’ messages for screen readers (e.g. `aria-label` with “You” or sender name).
  - [ ] Swipe cards:
    - [ ] Provide accessible labels describing the current card (title, year, rating).

- [ ] Prevent theme flash (FOUC)
  - [ ] Add an inline script in `index.html` before the JS bundle:
    - [ ] Read the stored theme from `localStorage` (same key as `ui-store`).
    - [ ] Apply or remove the `dark` class on `document.documentElement` before React mounts.
  - [ ] Ensure logic matches the theme computation in `ui-store.ts`.

- [ ] List virtualization
  - [ ] Introduce virtualization (e.g. `react-window` or similar) for:
    - [ ] Long conversation message lists.
    - [ ] Diary timelines with many entries.
    - [ ] Large search result sets.
    - [ ] Home feed lists.
  - [ ] Ensure scroll-to-bottom in chat still works correctly with virtualization.

- [ ] Skeletons & perceived performance
  - [ ] Add skeleton components for:
    - [ ] Conversations list.
    - [ ] Swipe deck.
    - [ ] Search results.
    - [ ] Diary timeline and stats.
  - [ ] Use skeletons while queries are loading to avoid jarring blank states.

- [ ] Background prefetch & app shell performance
  - [ ] After successful sign-in, prefetch:
    - [ ] Home feed.
    - [ ] Swipe decks.
    - [ ] Recent conversations.
    - [ ] Diary stats summary.
  - [ ] Use React Query prefetch APIs and/or idle callbacks to avoid blocking initial paint.

- [ ] Routing & code splitting
  - [ ] Use `React.lazy` + `Suspense` for page-level components (Home, Swipe, Search, Diary, Settings, Messages).
  - [ ] Keep `AppShell` and core layout non-lazy.
  - [ ] Provide meaningful fallbacks (skeletons, loading text) during lazy loading.

- [ ] Date & number formatting
  - [ ] Centralize date formatting via `Intl.DateTimeFormat`, respecting language/locale settings.
  - [ ] Centralize ratings and other numeric formatting via `Intl.NumberFormat`.
  - [ ] Use these helpers consistently across messages, diary, stats, and home feed.

- [ ] Toasts & inline error feedback
  - [ ] Implement a minimal toast system for global notifications.
  - [ ] Connect React Query global error handler to show a toast when requests fail.
  - [ ] Show inline failure states for:
    - [ ] Message send failures (with retry).
    - [ ] Swipe logging failures (optional retry).

---

## 11. React Query, services & data layer

- [ ] Extract domain services
  - [ ] Create service modules (`messages.service.ts`, `search.service.ts`, `diary.service.ts`, `swipe.service.ts`, `homeFeed.service.ts`) that:
    - [ ] Contain pure functions calling Supabase/Edge Functions.
    - [ ] Map raw rows to domain models (`UiMessage`, `TitleSearchResult`, `DiaryEntry`, `SwipeCardData`, `HomeFeedItem`).
  - [ ] Refactor hooks (`useConversations`, `useConversationMessages`, `useSearchTitles`, `useDiaryTimeline`, `useDiaryStats`, `useSwipeDeck`, `useHomeFeed`) to:
    - [ ] Become thin React Query wrappers around these services.

- [ ] Tune React Query settings
  - [ ] For relatively static data (title metadata, TMDB info), use longer `staleTime` and avoid aggressive `refetchOnWindowFocus`.
  - [ ] For dynamic data (messages, swipe decks, home feed), use shorter `staleTime` and consider enabling `refetchOnWindowFocus`.
  - [ ] Use `keepPreviousData` / `placeholderData` for paginated lists to avoid flicker.

- [ ] Cancellable work
  - [ ] Ensure all multi-step workflows (combined search, complex feed building) accept `AbortSignal` and check `signal.aborted`.
  - [ ] Propagate `signal` down into underlying fetch calls.

---

## 12. Media, attachments & hero pages

- [ ] Chat attachments
  - [ ] Verify attachment upload flow:
    - [ ] Upload to Supabase Storage (e.g. `message_attachments/{conversation}/{id}`).
    - [ ] Generate and use signed URLs where necessary.
  - [ ] Confirm `ChatImage` (and related components) support `loading="lazy"`, proper alt text, and safe error states.
  - [ ] Add an attachment button to `MessageComposer` if not already wired end-to-end.

- [ ] Hero title pages
  - [ ] Ensure `TitleDetailPage`:
    - [ ] Uses backdrop + overlay for legible text.
    - [ ] Exposes clear CTAs (log, rate, add to watchlist) wired to diary/library mutations.
    - [ ] Prefetches primary poster/backdrop for a snappy hero experience.
  - [ ] Make sure stats and diary info on title pages rely on the same library/diary hooks used elsewhere.

---

## 13. Testing & CI

- [ ] Unit tests for pure logic
  - [ ] Message text helpers:
    - [ ] Parsing plain text vs JSON bodies.
    - [ ] Handling deleted/edited message metadata if applicable.
  - [ ] Search merge logic:
    - [ ] Deduping titles across local vs external sources.
    - [ ] Source precedence (`library` vs `external-synced` vs `external-only`).
  - [ ] Diary stats reducer:
    - [ ] Correct averages and distributions.
    - [ ] Accurate monthly/yearly watch counts.
  - [ ] Swipe deck helpers:
    - [ ] Next-card selection.
    - [ ] Exhaustion state transitions.
  - [ ] Preferences builder (`_shared/preferences.ts`):
    - [ ] Correctly builds `UserProfile` from ratings, library, and activity.

- [ ] Auth & provider tests
  - [ ] Add tests for `AuthProvider`:
    - [ ] Initial state with no session.
    - [ ] Session restoration from Supabase.
    - [ ] Sign-out clearing session and related local state.

- [ ] Component / snapshot tests
  - [ ] Add lightweight tests (Vitest + React Testing Library) for:
    - [ ] Conversation list item (with and without unread).
    - [ ] Message bubble (self vs other).
    - [ ] Swipe card component.
    - [ ] Title search result row.
    - [ ] Skeleton components (render without crashing).

- [ ] CI wiring
  - [ ] Confirm CI workflow runs `npm run lint` and `npm test` on every push/PR.
  - [ ] Optionally add coverage reporting and fail CI below a chosen threshold.

---

## 14. DX & documentation

- [ ] README & environment docs
  - [ ] Expand `README.md` to cover:
    - [ ] Tech stack (Vite, React, TypeScript, Supabase, Edge functions, TMDB/OMDb).
    - [ ] Local dev setup (`npm install`, `npm run dev`).
    - [ ] Supabase setup (migrations via `supabase/schema.sql`, environment vars).
    - [ ] Edge Function deployment commands (`supabase functions deploy ...`).
    - [ ] All relevant env vars:
      - [ ] `VITE_SUPABASE_URL`
      - [ ] `VITE_SUPABASE_ANON_KEY` (and any other public keys)
      - [ ] Service role, TMDB/OMDb keys, etc. (documented but not committed).
  - [ ] Document how to regenerate Supabase types and where they live.

- [ ] Developer comments & experimental flags
  - [ ] Add short comments at top of complex or central files (`useSwipeDeck`, `useConversations`, `get_home_feed` SQL, key Edge functions) describing their purpose and assumptions.
  - [ ] Clearly tag experimental/demo features (Realtime chat, Lists if not yet implemented) so future maintainers know what is production vs experimental.

---

_This checklist is designed so an AI coding agent (or a human) can work through it item by item, marking `[✔️]` or `[✖️]` and adding a dated `DONE – ...` summary line under each completed task._
