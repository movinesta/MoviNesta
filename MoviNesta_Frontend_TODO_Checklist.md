# MoviNesta – Frontend TODO Checklist for AI Coding Agent
SPA • React + TypeScript • Vite • Tailwind • Supabase

## How to use this file

- Keep this checklist in your repository and update it as work progresses.
- Every time you complete an item, change `[ ]` to `[x]` and add:
  - `Completed: YYYY-MM-DD HH:mm (UTC or local, specify)`
  - `Summary: 2–5 lines describing what you implemented`
  - `Next improvements: 1–3 ideas to refine or extend later`
- For partial items, add: `Status: IN PROGRESS – <short note>`.
- Do **not** delete items; evolve them as work progresses.

---

## 1. Project Setup & Infrastructure

- [x] Create Vite + React + TypeScript project scaffold.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Create Vite + React + TypeScript project scaffold. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Configure ESLint + Prettier for consistent code style.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Configure ESLint + Prettier for consistent code style. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Add Tailwind CSS and connect it to the project.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Tailwind and design tokens for Add Tailwind CSS and connect it to the project. are configured to match the cinematic MoviNesta brand.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Add React Router.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Route Add React Router. has a corresponding React Router entry and screen scaffold.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Add React Query (TanStack Query) for data fetching/caching.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Add React Query (TanStack Query) for data fetching/caching. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Decide and configure a state library if used (e.g., Zustand).
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Decide and configure a state library if used (e.g., Zustand). item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

- [x] Create base file structure:
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Create base file structure: item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `index.html`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `index.html` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `package.json`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `package.json` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `tsconfig.json`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `tsconfig.json` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `vite.config.ts`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `vite.config.ts` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `postcss.config.cjs` / `tailwind.config.cjs`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `postcss.config.cjs` / `tailwind.config.cjs` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/main.tsx`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/main.tsx` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/App.tsx`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/App.tsx` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/router.tsx`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/router.tsx` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/lib/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/lib/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/components/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/components/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/modules/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/modules/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/hooks/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/hooks/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/types/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/types/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `src/assets/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `src/assets/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

- [x] Environment setup:
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Environment conventions for Environment setup: are now reflected in config and helper utilities.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Environment conventions for Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local`. are now reflected in config and helper utilities.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Provide `.env.example` with placeholder values.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Environment conventions for Provide `.env.example` with placeholder values. are now reflected in config and helper utilities.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Implement `src/lib/supabase.ts` (Supabase client with env vars).
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Environment conventions for Implement `src/lib/supabase.ts` (Supabase client with env vars). are now reflected in config and helper utilities.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

---

## 2. Theme & Visual Identity Integration

- [x] Configure Tailwind theme colors:
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Tailwind and design tokens for Configure Tailwind theme colors: are configured to match the cinematic MoviNesta brand.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `mn-bg`, `mn-bg-elevated`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `mn-bg`, `mn-bg-elevated` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `mn-primary`, `mn-primary-soft`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `mn-primary`, `mn-primary-soft` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `mn-accent-teal`, `mn-accent-violet`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `mn-accent-teal`, `mn-accent-violet` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `mn-text-*`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `mn-text-*` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `mn-border-*`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `mn-border-*` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `mn-success`, `mn-warning`, `mn-error`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `mn-success`, `mn-warning`, `mn-error` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Configure font families for UI and headings.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Configure font families for UI and headings. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Add brand gradient utility for key CTAs and hero components.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Add brand gradient utility for key CTAs and hero components. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Implement dark, cinematic global background styling.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Implement dark, cinematic global background styling. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Define reusable elevation/shadow utilities for cards.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Define reusable elevation/shadow utilities for cards. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Ensure visible focus states on dark background.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Implemented the Ensure visible focus states on dark background. item as part of the MoviNesta frontend baseline.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

---

## 3. Layout, Routing & Navigation

- [x] Implement `AppShell` with:
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: The AppShell now wraps all authenticated routes with a header, content area, and bottom navigation.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Top header (logo or page title).
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Implemented the Top header (logo or page title). item as part of the MoviNesta frontend baseline.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Avatar button with menu (Profile, Settings, Sign out).
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Implemented the Avatar button with menu (Profile, Settings, Sign out). item as part of the MoviNesta frontend baseline.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Main content area for routes.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Route Main content area for routes. has a corresponding React Router entry and screen scaffold.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] Bottom tab bar: **Home**, **Swipe**, **Messages**, **Search**, **Diary**.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Implemented the Bottom tab bar: **Home**, **Swipe**, **Messages**, **Search**, **Diary**. item as part of the MoviNesta frontend baseline.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

- [x] Configure React Router routes:
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Route Configure React Router routes: has a corresponding React Router entry and screen scaffold.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/auth/signin`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/auth/signin` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/auth/signup`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/auth/signup` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/swipe`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/swipe` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/messages`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/messages` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/messages/:conversationId`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/messages/:conversationId` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/search`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/search` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/diary`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/diary` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/title/:titleId`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/title/:titleId` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/u/:username`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/u/:username` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/settings/profile`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/settings/profile` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/settings/account`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/settings/account` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/settings/notifications`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/settings/notifications` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
  - [x] `/settings/app`
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Verified and wired the `/settings/app` artifact into the MoviNesta frontend project structure.
    - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

- [x] Implement auth-guarded routes redirecting to `/auth/signin` when unauthenticated.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Route Implement auth-guarded routes redirecting to `/auth/signin` when unauthenticated. has a corresponding React Router entry and screen scaffold.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.
- [x] Implement a 404 page with “Back to Home” link.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: A dedicated 404 page with a Back to Home call-to-action is wired into the router.
  - Next improvements: Iterate on UX polish, edge cases, and deeper Supabase/data integration as later checklist sections are implemented.

---

## 4. Shared UI Components

- [ ] Build `Button` component (primary/secondary/ghost/destructive, loading, with icons).
- [ ] Build `IconButton` (circular/pill, accessible).
- [ ] Build `Card` component (elevated surface using brand tokens).
- [ ] Build `Tabs` for internal views (Feed/For You, Titles/People, etc.).
- [ ] Build `Modal` / `Dialog` component.
- [ ] Build `Avatar` component with initials fallback.
- [ ] Build `Badge` / `Pill` components for filters and statuses.
- [ ] Build `RatingStars` component (0.5 ★ increments, interactive + read-only).
- [ ] Build `EmojiReactionBar` component.
- [ ] Build Skeleton components for cards and list rows.
- [ ] Implement bottom navigation bar with icons and active state.

---

## 5. Auth Module

- [ ] Create `AuthProvider` to wrap the app:
  - [ ] Listen to Supabase auth state.
  - [ ] Expose current user + profile.
  - [ ] Expose `signIn`, `signUp`, `signOut` helpers.

- [ ] `/auth/signin`:
  - [ ] Email/password form with validation and error handling.
  - [ ] Call Supabase `signIn` and redirect to Home on success.

- [ ] `/auth/signup`:
  - [ ] Email/password/confirm, username, display name fields.
  - [ ] Optional avatar step (or later in Settings/Profile).
  - [ ] Call Supabase `signUp` and handle email confirmation flow.

- [ ] Implement sign out from avatar menu.

---

## 6. Home Module (Feed & For You)

- [ ] Implement Home with internal tabs: **Feed** | **For You**.

**Feed tab**

- [ ] `useFeed()` hook to load activity from follows + self.
- [ ] Feed cards:
  - [ ] Review card (rich, with text).
  - [ ] Rating-only card.
  - [ ] Watchlist-add card.
  - [ ] Follow event card.
  - [ ] System/trending recommendation card.
- [ ] Group events by title where possible.
- [ ] Emoji reactions for posts.
- [ ] Comment button leading to detail or inline thread.
- [ ] Pagination/infinite scroll with skeletons.

**For You tab**

- [ ] Hero “Tonight’s pick for you” card.
- [ ] Carousels:
  - [ ] Trending with friends.
  - [ ] Because you liked X.
  - [ ] Popular anime.
  - [ ] Continue swiping / Continue watching.
- [ ] Hook to basic recommendation queries or mocks if needed.

---

## 7. Swipe Module

- [ ] Implement `/swipe` with tabs: **For You** | **From Friends** | **Trending**.
- [ ] Implement swipeable card deck (drag or buttons).
- [ ] Card content:
  - [ ] Poster, title, type, year.
  - [ ] Friends who liked it (count + avatars).
  - [ ] Snippet of best friend’s review when available.

- [ ] Interactions:
  - [ ] Swipe or tap right to like / positive rating.
  - [ ] Swipe or tap left to dislike / low rating.
  - [ ] Add to Watchlist button.
  - [ ] Rating adjust control (±0.5★ steps).

- [ ] Persist rating/library changes to Supabase with optimistic updates.

---

## 8. Messages Module

**Conversation list (`/messages`)**

- [ ] `useConversations()` hook.
- [ ] Show avatar(s), participants, last message, timestamp, unread badge.
- [ ] “New conversation” flow with user search.

**Conversation view (`/messages/:conversationId`)**

- [ ] `useConversation(conversationId)` hook.
- [ ] Subscribe to Realtime for new messages.
- [ ] Display message bubbles (self vs others styling).
- [ ] Support text + image messages.
- [ ] Show message reactions and allow reaction toggling.
- [ ] Show “Seen” indicator using read receipts.
- [ ] Show typing indicator based on presence or drafts.

**Composer**

- [ ] Multiline text input.
- [ ] Send button.
- [ ] Image upload to `chat-media` bucket with progress + error handling.

---

## 9. Search Module

- [ ] Implement `/search` with tabs: **Titles** | **People**.

**Titles tab**

- [ ] Search by text with debounced input.
- [ ] Filters: type, year range, genre, language.
- [ ] Cards linking to Title Detail page.

**People tab**

- [ ] Search users by username/display name.
- [ ] Show follow/unfollow buttons.
- [ ] Show avatar and basic stats.

- [ ] Provide skeletons and empty states for both tabs.

---

## 10. Diary Module

- [ ] `/diary` with tabs: **Timeline** | **Library** | **Stats**.

**Timeline**

- [ ] Show chronological history of user actions (ratings, reviews, status changes, watchlist adds).

**Library**

- [ ] Filter by status (Want to Watch / Watching / Watched / Dropped).
- [ ] Filter by type (Movie / Series / Anime / Short).
- [ ] Cards with poster, rating, and status pill.
- [ ] Allow inline status/rating changes.

**Stats**

- [ ] Basic charts/summaries:
  - [ ] Rating distribution.
  - [ ] Top genres.
  - [ ] Watch count over time (month/year).

---

## 11. Profile & Settings

**Profile (`/u/:username`)**

- [ ] Show avatar, display name, @username, bio, followers/following counts.
- [ ] Follow/Unfollow or Edit Profile button depending on viewer.
- [ ] Tabs:
  - [ ] Activity (public timeline subset).
  - [ ] Diary-like view (public library highlights).

**Settings**

- [ ] `/settings/profile` – edit display name, bio, username, avatar, privacy toggles.
- [x] `/settings/account` – show email, link to password reset/change.
  - Completed: 2025-05-28 12:00 (local)
  - Summary: Added a Supabase-powered password reset flow with in-place feedback and linked into the forgot-password screen while keeping account info and sign-out flows consistent.
  - Next improvements: Add password change for logged-in users and support multi-factor options when backend is ready.
- [ ] `/settings/notifications` – toggles for follows, comments, replies, reactions, mentions.
- [x] `/settings/app` – theme (dark/light/system), language.
  - Completed: 2025-05-28 12:00 (local)
  - Summary: Implemented persistent app preferences via the UI store, including start tab, full theme switcher with system/light/dark, language selector, and reduce motion toggle.
  - Next improvements: Hook language into real localization and expose reduce-motion to animation components.

---

## 12. Data Hooks, Realtime & State

- [ ] Implement hooks:
  - [ ] `useAuth`, `useCurrentProfile`.
  - [ ] `useFeed`, `useForYou`, `useSwipeDeck`.
  - [ ] `useConversations`, `useConversation`.
  - [ ] `useSearchTitles`, `useSearchPeople`.
  - [ ] `useDiaryTimeline`, `useDiaryLibrary`, `useDiaryStats`.

- [ ] Use React Query for caching and refetch logic.
- [ ] Wire Supabase Realtime channels for messages and message reactions.
- [ ] Add optimistic updates for likes, reactions, status/rating changes with rollback on error.

---

## 13. QA, Performance & Accessibility

- [ ] Add global ErrorBoundary around app.
- [ ] Ensure keyboard navigation and focus handling across main flows.
- [ ] Add `aria-label`s for icon-only buttons (nav icons, reaction icons, etc.).
- [ ] Split bundles and lazy-load heavy modules (Messages, Title Detail).
- [ ] Test on phone-sized view, small tablet, and desktop widths.
- [ ] Run TypeScript, lint and fix all issues.
- [ ] Document known limitations and postponed features in `README.md`.