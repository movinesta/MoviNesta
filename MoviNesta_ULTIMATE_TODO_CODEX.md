# MoviNesta – Ultimate TODO Checklist (Codex-ready)

_Generated: 2025-12-31 (Asia/Baghdad)_

## How Codex should use this file

**Goal:** Fix the project by working top-to-bottom through **P0 → P2**. As each item is completed, Codex must **mark the checkbox** and add a short done-note (files changed + command(s) run).

### Workflow rules for Codex

1. Create a branch (or worktree) per group of related tasks (e.g., `fix/messages-scroll`, `fix/catalog-sync`).
2. After each completed task:
   - Change `- [ ]` to `- [x]` in this file.
   - Under it add an indented note: `- Done: <what changed> (files: ...). Verified: <commands / manual steps>`
3. Keep migrations incremental:
   - Put DB changes into `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` (don’t rewrite the full schema dump).
4. Maintain contracts:
   - If an edge function response/payload changes, update **all** callers and add a tiny runtime validator (zod) or at least a TypeScript type + `if (!ok) throw` guard.
5. Definition of Done (per task):
   - No TypeScript errors (`npm run build`), no runtime console errors in the affected flow, and the UI shows a clear error state when backend calls fail.

## 1) Route-level pages

### Main app routes (`src/router.tsx`)
- `/auth/signin` → **SignInPage**
- `/auth/signup` → **SignUpPage**
- `/auth/forgot-password` → **ForgotPasswordPage**
- `/auth/reset-password` → **ResetPasswordPage**
- `/welcome` → **OnboardingPage**
- `/onboarding` → **TasteOnboardingPage**
- `/home` → **HomePage**
- `/swipe` → **SwipePage**
- `/messages` → **MessagesPage**
- `/messages/new` → **NewMessagePage**
- `/messages/:conversationId` → **ConversationPage**
- `/search` → **SearchPage**
- `/diary` → **DiaryPage**
- `/title/:titleId` → **TitleDetailPage**
- `/title/:titleId/reviews` → **TitleReviewsPage**
- `/activity` → **ActivityPage**
- `/activity/requests` → **FollowRequestsPage**
- `/me` → **MePage**
- `/u/:username` → **ProfilePage**
- `/u/:username/followers` → **FollowersPage**
- `/u/:username/following` → **FollowingPage**
- `/suggested-people` → **SuggestedPeoplePage**
- `/lists/:listId` → **ListDetailPage**
- `/settings` → **SettingsOverviewPage**
- `/settings/profile` → **SettingsProfilePage**
- `/settings/account` → **SettingsAccountPage**
- `/settings/notifications` → **SettingsNotificationsPage**
- `/settings/app` → **SettingsAppPage**
- `*` → **NotFoundPage**

### Admin dashboard routes (`admin-dashboard/src/App.tsx`)
- `/`
- `/embeddings`
- `/jobs`
- `/users`
- `/logs`
- `/audit`
- `/costs`
- `*`

## 2) Page modules and their files

### src/modules/activity

- `src/modules/activity/ActivityPage.tsx`
- `src/modules/activity/FollowRequestsPage.tsx`
- `src/modules/activity/useActivityNotifications.ts`

### src/modules/auth

- `src/modules/auth/AuthLayout.tsx`
- `src/modules/auth/AuthProvider.test.tsx`
- `src/modules/auth/AuthProvider.tsx`
- `src/modules/auth/ForgotPasswordPage.tsx`
- `src/modules/auth/RequireAuth.tsx`
- `src/modules/auth/ResetPasswordPage.tsx`
- `src/modules/auth/SignInPage.tsx`
- `src/modules/auth/SignUpPage.tsx`

### src/modules/diary

- `src/modules/diary/DiaryLibraryTab.tsx`
- `src/modules/diary/DiaryPage.tsx`
- `src/modules/diary/DiaryStatsTab.tsx`
- `src/modules/diary/DiaryTimelineTab.tsx`
- `src/modules/diary/diaryStatsReducer.ts`
- `src/modules/diary/diaryStatus.ts`
- `src/modules/diary/useDiaryLibrary.ts`
- `src/modules/diary/useDiaryStats.ts`
- `src/modules/diary/useDiaryTimeline.ts`

### src/modules/home

- `src/modules/home/HomeFeedItemCard.tsx`
- `src/modules/home/HomeFeedTab.tsx`
- `src/modules/home/HomeForYouSkeletons.tsx`
- `src/modules/home/HomeForYouTab.tsx`
- `src/modules/home/HomePage.tsx`
- `src/modules/home/HomeStoriesRow.tsx`
- `src/modules/home/homeFeedTypes.ts`
- `src/modules/home/useHomeFeed.ts`
- `src/modules/home/useHomeStories.ts`

### src/modules/messages

- `src/modules/messages/ChatImage.test.tsx`
- `src/modules/messages/ConversationPage.tsx`
- `src/modules/messages/MessagesPage.tsx`
- `src/modules/messages/NewMessagePage.tsx`
- `src/modules/messages/cacheListHelpers.test.ts`
- `src/modules/messages/cacheListHelpers.ts`
- `src/modules/messages/chatMedia.ts`
- `src/modules/messages/chatMediaStorage.ts`
- `src/modules/messages/clientId.ts`
- `src/modules/messages/components/ChatImage.tsx`
- `src/modules/messages/components/ConversationActionsSheet.tsx`
- `src/modules/messages/components/ConversationComposerBar.tsx`
- `src/modules/messages/components/ConversationHeader.tsx`
- `src/modules/messages/components/ConversationInfoSheet.tsx`
- `src/modules/messages/components/DeleteMessageDialog.tsx`
- `src/modules/messages/components/EditMessageDialog.tsx`
- `src/modules/messages/components/LinkifiedText.tsx`
- `src/modules/messages/components/MessageBubble.tsx`
- `src/modules/messages/components/MessageComposer.tsx`
- `src/modules/messages/components/MessageList.tsx`
- `src/modules/messages/components/MessageRow.tsx`
- `src/modules/messages/components/MessageScrollToLatest.tsx`
- `src/modules/messages/components/MessageScrollToUnread.tsx`
- `src/modules/messages/components/MuteOptionsSheet.tsx`
- `src/modules/messages/conversationMessagesCache.ts`
- `src/modules/messages/conversationPrefs.ts`
- `src/modules/messages/conversationRealtimeManager.ts`
- `src/modules/messages/conversationsCache.test.ts`
- `src/modules/messages/conversationsCache.ts`
- `src/modules/messages/formatSupabaseError.ts`
- `src/modules/messages/formatTimeAgo.test.ts`
- `src/modules/messages/formatTimeAgo.ts`
- `src/modules/messages/getMessageDeliveryStatus.test.ts`
- `src/modules/messages/getMessageDeliveryStatus.ts`
- `src/modules/messages/idUtils.test.ts`
- `src/modules/messages/idUtils.ts`
- `src/modules/messages/messageModel.ts`
- `src/modules/messages/messageSelect.ts`
- `src/modules/messages/messageText.test.ts`
- `src/modules/messages/messageText.ts`
- `src/modules/messages/queryKeys.ts`
- `src/modules/messages/reactionSummaries.test.ts`
- `src/modules/messages/reactionSummaries.ts`
- `src/modules/messages/realtimeGuards.test.ts`
- `src/modules/messages/realtimeGuards.ts`
- `src/modules/messages/realtimeListUpdaters.test.ts`
- `src/modules/messages/realtimeListUpdaters.ts`
- `src/modules/messages/realtimeQueryDefaults.ts`
- `src/modules/messages/signedUrlCache.ts`
- `src/modules/messages/storageUrls.ts`
- `src/modules/messages/supabaseConversationQueries.ts`
- `src/modules/messages/supabaseReceiptWrites.ts`
- `src/modules/messages/time.ts`
- `src/modules/messages/useAttachmentUpload.ts`
- `src/modules/messages/useBlockStatus.test.ts`
- `src/modules/messages/useBlockStatus.ts`
- `src/modules/messages/useConversationDraft.ts`
- `src/modules/messages/useConversationInsertedMessageEffects.ts`
- `src/modules/messages/useConversationLayoutState.ts`
- `src/modules/messages/useConversationMessageActions.ts`
- `src/modules/messages/useConversationMessages.ts`
- `src/modules/messages/useConversationReactions.ts`
- `src/modules/messages/useConversationReadReceiptWriter.ts`
- `src/modules/messages/useConversationRealtimeSubscription.ts`
- `src/modules/messages/useConversationReceipts.ts`
- `src/modules/messages/useConversationSearch.ts`
- `src/modules/messages/useConversationUiMessages.ts`
- `src/modules/messages/useConversationUnreadDivider.ts`
- `src/modules/messages/useConversations.ts`
- `src/modules/messages/useDeleteMessage.ts`
- `src/modules/messages/useEditMessage.ts`
- `src/modules/messages/useFailedOutgoingMessages.ts`
- `src/modules/messages/useLastVisibleOwnMessageId.ts`
- `src/modules/messages/usePrefersReducedMotion.ts`
- `src/modules/messages/useRealtimePollFallback.test.ts`
- `src/modules/messages/useRealtimePollFallback.ts`
- `src/modules/messages/useRealtimeQueryFallbackOptions.ts`
- `src/modules/messages/useSendMessage.test.tsx`
- `src/modules/messages/useSendMessage.ts`
- `src/modules/messages/useTypingChannel.ts`

### src/modules/misc

- `src/modules/misc/NotFoundPage.tsx`
- `src/modules/misc/OnboardingPage.tsx`
- `src/modules/misc/TasteOnboardingPage.tsx`

### src/modules/profile

- `src/modules/profile/ConnectionsPage.tsx`
- `src/modules/profile/FollowersPage.tsx`
- `src/modules/profile/FollowingPage.tsx`
- `src/modules/profile/ListDetailPage.tsx`
- `src/modules/profile/MePage.tsx`
- `src/modules/profile/ProfileActivityTab.tsx`
- `src/modules/profile/ProfileDiaryTab.tsx`
- `src/modules/profile/ProfilePage.tsx`
- `src/modules/profile/SuggestedPeoplePage.tsx`
- `src/modules/profile/resolveAvatarUrl.ts`
- `src/modules/profile/suggestedPeopleStorage.ts`
- `src/modules/profile/useCreateHighlight.ts`
- `src/modules/profile/useListDetail.ts`
- `src/modules/profile/useProfile.ts`
- `src/modules/profile/useProfileConnections.ts`
- `src/modules/profile/useProfileHighlights.ts`
- `src/modules/profile/useProfilePostCount.ts`
- `src/modules/profile/useSuggestedPeople.ts`

### src/modules/search

- `src/modules/search/HighlightText.tsx`
- `src/modules/search/PeopleResultRow.tsx`
- `src/modules/search/SearchPage.tsx`
- `src/modules/search/SearchPeopleTab.tsx`
- `src/modules/search/SearchTitlesTab.tsx`
- `src/modules/search/externalMovieSearch.ts`
- `src/modules/search/recentSearches.ts`
- `src/modules/search/search.service.ts`
- `src/modules/search/searchState.ts`
- `src/modules/search/titleSorting.ts`
- `src/modules/search/useSearchDiscover.ts`
- `src/modules/search/useSearchPeople.ts`
- `src/modules/search/useSearchTitles.ts`
- `src/modules/search/useTitleDiaryBulk.ts`
- `src/modules/search/useToggleFollow.ts`

### src/modules/settings

- `src/modules/settings/SettingsAccountPage.tsx`
- `src/modules/settings/SettingsAppPage.tsx`
- `src/modules/settings/SettingsNotificationsPage.tsx`
- `src/modules/settings/SettingsOverviewPage.tsx`
- `src/modules/settings/SettingsProfilePage.tsx`

### src/modules/swipe

- `src/modules/swipe/FriendAvatarStack.tsx`
- `src/modules/swipe/FriendsListModal.tsx`
- `src/modules/swipe/SwipeCardComponents.tsx`
- `src/modules/swipe/SwipePage.tsx`
- `src/modules/swipe/SwipeSyncBanner.tsx`
- `src/modules/swipe/eventQueue.ts`
- `src/modules/swipe/mediaSwipeApi.ts`
- `src/modules/swipe/swipeCardMeta.ts`
- `src/modules/swipe/useMediaSwipeDeck.ts`
- `src/modules/swipe/useSwipeDeck.ts`

### src/modules/title

- `src/modules/title/TitleDetailPageV2.tsx`
- `src/modules/title/TitleReviewsPageV2.tsx`

### admin-dashboard/src/pages

- `admin-dashboard/src/pages/Audit.tsx`
- `admin-dashboard/src/pages/Costs.tsx`
- `admin-dashboard/src/pages/Embeddings.tsx`
- `admin-dashboard/src/pages/Jobs.tsx`
- `admin-dashboard/src/pages/Logs.tsx`
- `admin-dashboard/src/pages/Overview.tsx`
- `admin-dashboard/src/pages/SignIn.tsx`
- `admin-dashboard/src/pages/Users.tsx`

## 3) Ultimate TODO (bugs + mismatches + not-working flows)

### P0 — Breaks core flows / wrong data / stuck UI

- [ ] Fix `catalog-sync` client/server contract (series clicks open as movies; external-only items don’t resolve).
  Server (`supabase/functions/catalog-sync/index.ts`) expects payload with `tmdbId` + `contentType` ("movie"|"series") and returns `{ ok, media_item_id, ... }`.
  Clients currently send `{ kind, tmdbId }` and read `res.data.id`.
  Update clients:
  - `src/modules/title/TitleDetailPageV2.tsx` (virtual ids `tmdb-*` / `tv-*`): call with `{ tmdbId, contentType: kind }` and read `res.media_item_id`.
  - `src/modules/search/SearchTitlesTab.tsx`: same payload + navigate only after canonicalization for external-only results.
  Add at least a smoke test for `virtual id → canonical uuid` to prevent regressions.

- [ ] Fix Search ‘external-only’ navigation so it never routes to `/title/{tmdb-*}`.
  `src/modules/search/SearchTitlesTab.tsx`: wrap card click with `await ensureCanonicalId()` then navigate to `/title/{canonicalUuid}`.
  Show loading, disable double-click while syncing.

- [ ] Make Trending/Discover stable when a session is invalid or the edge function fails (`INVALID_SESSION`).
  `src/modules/swipe/mediaSwipeApi.ts`: on `INVALID_SESSION`, clear stored session id, regenerate UUID, retry (2 attempts total), then show a user-friendly error state.
  Verify *all* callers use `getOrCreateMediaSwipeSessionId()` consistently.

- [ ] Align Vite base-path handling with deployment (avoid broken routes/assets when not on GitHub Pages).
  `vite.config.ts` currently hard-codes `base: "/MoviNesta/"`.
  Make base dynamic via env (e.g., `VITE_BASE_URL`) with safe defaults for local dev (`/`).

- [ ] Messages: Fix typing indicator leaking across conversations (stuck “X is typing…”).
  Cause: `useTypingChannel` clears timeouts on cleanup but never resets `remoteTypingById`, so values persist indefinitely across conversation switches.
  Fix in `src/modules/messages/useTypingChannel.ts`:
  - Clear `remoteTypingById` on `conversationId` change and on cleanup.
  - Also clear `remoteTimeoutsRef` safely.
  Add a tiny unit test or manual repro steps note.

- [ ] Messages: Prevent premature read receipts on initial load (isAtBottom starts `true`).
  `useConversationLayoutState` initializes `isAtBottom` to `true`, so `useConversationReadReceiptWriter` can mark the last message read immediately after mount.
  Fix:
  - Initialize `isAtBottom` as `false` or `null` (unknown) until Virtuoso reports `atBottomStateChange`.
  - Gate read-receipt writes until `isAtBottom === true` and the list has rendered at least once.

- [ ] Deploy + verify all referenced Supabase Edge Functions exist in the target Supabase project.
  App uses (at least): `media-swipe-deck`, `media-swipe-event`, `onboarding-batch`, `catalog-sync`, `create-direct-conversation`, `update-notification-prefs`.
  Admin uses: `admin-whoami`, `admin-overview`, `admin-embeddings`, `admin-jobs`, `admin-logs`, `admin-audit`, `admin-users`, `admin-costs`.
  Add a deploy checklist or script to call each function and validate response shape.

### P1 — Bugs that hurt UX / consistency / performance

- [ ] Messages: Fix pending-new counter spikes when the last-seen message becomes hidden/deleted.
  In `ConversationPage.tsx`, if `lastSeenLastMessageIdRef` points to a message no longer in `visibleMessages`, `findIndex` returns `-1` and the code treats *all* visible messages as unseen.
  Fix by resetting `lastSeenLastMessageIdRef` when not found (or track last-seen by timestamp, not id).

- [ ] Messages: “Unread” button should hide when `unreadCount === 0`.
  Currently `MessageScrollToUnread` shows when `firstUnreadIndex != null && !isAtBottom` even if unread count is 0.
  Update condition in `ConversationPage.tsx`.

- [ ] Messages: Improve Jump-to-Unread when last-read message isn’t loaded yet.
  If `last_read_message_id` is older than the current loaded window, `useConversationUnreadDivider` returns `0` and Jump-to-Unread scrolls to the top of the *loaded* window.
  Better behavior: when user taps “Unread”, auto-load older pages until the last-read id is found (or `hasMore=false`), then scroll to the true first-unread.

- [ ] Messages: Typing UX — keep identities (userId) instead of only `displayName` values.
  `useTypingChannel` returns `Object.values(remoteTypingById)` which loses userId and can show duplicates incorrectly.
  Return `[{ userId, displayName }]` and render “A and B are typing…” reliably (especially in group chats).

- [ ] Messages: Stabilize `isAtBottom` around layout changes (composer resize / emoji picker).
  Composer height changes can make Virtuoso briefly report not-at-bottom, causing:
  - pending-new badge flicker
  - read receipts to stop/start
  Fix: if user *was* at bottom before layout change, keep them at bottom by scrolling to last item after resize (or reduce threshold).

- [ ] Delivery/Seen status: Avoid “seen” falling back to `last_read_at` when `last_read_message_id` is missing from loaded messages.
  `getMessageDeliveryStatus.ts` maps read markers using:
  - `lastReadMessageId` → createdAtMs (if available), else
  - `lastReadAt` timestamp.
  This can misclassify messages as seen when messages are missing in cache.
  Fix options:
  - Persist and rely more on `last_read_message_id` (ensure it is always set in DB),
  - Or fetch the referenced message timestamp when needed (RPC), or store `last_read_message_created_at` in receipts.

- [ ] Realtime fallback correctness: verify polling + realtime don’t double-insert or reorder messages.
  `useConversationMessages` merges realtime upserts and infinite-query pages. Test:
  - realtime inserts while older-page fetching
  - reconnect after realtime-down (polling enabled)
  Ensure stable sort and no duplicates.

- [ ] Types drift: include views in generated Supabase types (or stop querying views through `any`).
  Project queries views (e.g., `media_item_trending_72h`) but generator likely excludes Views.
  Update `scripts/generate-supabase-types.js` to include views, or provide typed wrappers per view.

- [ ] Verify `get_conversation_summaries_v2` RPC exists and matches expected fields.
  Expected fields include: `self_muted`, `self_hidden`, `self_muted_until` (and whatever UI reads).
  If mismatch: update SQL or UI mapping to avoid silent wrong UI state.

### P2 — Cleanup / maintainability

- [ ] Introduce Supabase migrations (stop relying only on full schema dumps).
  Add `supabase/migrations/*` with incremental changes.
  Keep `supabase/schema/schema_full_*.sql` as optional snapshot artifacts.

- [ ] Standardize API envelopes across edge functions.
  Choose either `{ ok: true, data: {...} }` or `{ ok: true, ...flat }` and stick with it.
  Add small zod validators for critical functions (catalog-sync, media-swipe-deck).

- [ ] Reduce `as any` usage: create typed RPC wrappers.
  Files calling `supabase.rpc as any` should be wrapped in `src/lib/rpc.ts` with strongly-typed helpers.

- [ ] Add automated checks: `tsc --noEmit`, `vitest`, and a lightweight smoke check script for edge functions.
  Even a minimal CI workflow that runs on PRs will prevent regressions in contracts (IDs, payload shapes, etc.).

- [ ] Document architecture: IDs + flows.
  Add `docs/ARCHITECTURE.md` explaining:
  - uuid vs `tmdb-*` / `tv-*`
  - tables + RLS expectations
  - edge functions and their payloads
  - how “delivered/seen” is computed.
