# MoviNesta — Operational Scaling Manual (Pre‑Launch)

_Last updated: 2026-01-15_

This manual is a practical, production-oriented guide to run MoviNesta at **high scale (500k+ DAU)** on Supabase (Postgres + Realtime + Edge Functions) with a Vite/React frontend and an admin dashboard.

It focuses on:
- Keeping p95 latency low and **avoiding thundering herds**
- Preventing runaway costs from Realtime, AI calls, and write amplification
- Maintaining **data integrity, security (RLS), and reliability** during rapid growth

---

## 1) Target SLOs and budgets

### Suggested SLOs (initial)
- **Home feed**: p95 < 400ms (server), p95 < 1.5s (end-to-end)
- **Swipe deck**: p95 < 700ms (server), p95 < 2.0s (end-to-end)
- **Message send**: p95 < 250ms (server), p95 < 1.0s (end-to-end)
- **Edge function availability**: 99.9% monthly

### Error budgets
- Treat *any* sustained p95 regression > 25% as an incident.
- Treat *any* elevated 5xx rate on critical endpoints > 0.5% for 5 minutes as an incident.

---

## 2) Capacity planning (how to think about 500k DAU)

### Key assumptions (tune these to your app analytics)
- DAU: 500,000
- Sessions/day: DAU * 1.5 (example) = 750,000
- Avg session length: 8 minutes
- Swipes per session: 25–60 (depends on UX)
- Messages per active messaging user per day: 5–30

### Derive the two big cost drivers
1) **Writes/day** (events, receipts, presence)  
2) **Edge invocations/day** (deck fetches, swipe event ingestion, assistant calls)

#### Why this matters
At high DAU, you rarely “run out of CPU” first. You usually hit:
- write amplification (too many small inserts)
- subscription amplification (Realtime `list_changes`)
- expensive RPCs called too frequently
- long-running edge handlers (timeouts, retries, cold-start loops)

---

## 3) Architecture at scale (recommended shape)

### Separate concerns
- **Hot path**: user-facing reads/writes (swipe deck, message send) must be short, indexed, and cache-friendly.
- **Warm path**: enrichment (vector updates, taste vectors, rollups) should be asynchronous or scheduled.
- **Cold path**: analytics queries should read from rollups/materialized views, not raw event tables.

### Data shape principles
- Prefer **append-only** tables for event streams.
- Keep “current state” tables small (profiles, settings, current decks, latest conversation pointers).
- Use **idempotent writes** with unique constraints + UPSERT.

---

## 4) Postgres (Supabase) — performance + safety

### 4.1 Indexing rules of thumb
- Every foreign key should have a covering index (performance advisor will flag this).
- For “latest per group” patterns (messages per conversation), index:
  - `(conversation_id, created_at DESC)` and include commonly read columns.
- For user event streams, index:
  - `(user_id, created_at DESC)`.

### 4.2 Partitioning strategy (when you grow)
When event tables start exceeding ~50–200M rows:
- Partition **append-only** tables by time (daily/weekly) or hash (user_id).
- Keep partitions small enough that VACUUM and index maintenance stay predictable.

**Candidates**:
- `media_events`
- `rec_impressions`
- `rec_outcomes`
- large logs (feature logs, audits)

### 4.3 Autovacuum / bloat control
- Monitor table bloat and dead tuples on high-write tables.
- If you see rising latency despite indexes, bloat is often the culprit.
- Prefer smaller indexes on write-heavy tables (don’t index columns you never filter/sort on).

### 4.4 Query profiling workflow
1) Use Supabase “Query Performance” (pg_stat_statements) to find top total time.
2) Pick top 1–3 queries and run:
   - `EXPLAIN (ANALYZE, BUFFERS)`
3) Fix either:
   - index alignment
   - candidate set reduction
   - removing repeated per-row function calls
4) Re-measure after resetting stats.

---

## 5) Edge Functions — keep them fast and cheap

### 5.1 Hard constraints
- Avoid long-running edge handlers. Aim for < 200ms CPU per request on hot paths.
- Don’t call `supabase.auth.getUser()` on hot paths if `verify_jwt=true` is already validating JWT.
- Always validate request payloads and cap sizes (protect from large JSON abuse).

### 5.2 Idempotency and retries
- Every hot write endpoint should be safe to retry:
  - Use a `client_event_id` / `dedupe_key`
  - Unique constraints + UPSERT + `ignoreDuplicates` patterns
- Never rely on “the client won’t retry” — mobile networks will.

### 5.3 Batching (the biggest win)
For swipe / impression events:
- Send **batches** (e.g., 25 items) instead of per-event requests.
- Persist an offline queue (IndexedDB/localStorage) and flush in chunks with backoff.

### 5.4 Keep background work off the hot path
Move heavy work to:
- scheduled functions
- runners/sweepers (already in this repo)
- DB jobs (cron), if available

Examples:
- taste vector updates
- rollups
- embedding backfills
- recommendation model refresh

### 5.5 Rate limiting
- Apply rate limiting to endpoints that can be abused or create cost:
  - `media-search`
  - `tmdb-proxy`
  - AI endpoints (`assistant-*`)
  - deck refresh endpoints
- Prefer light-weight limits (avoid DB locks / heavy rate check queries at scale).

---

## 6) Realtime — avoiding `realtime.list_changes` blowups

Realtime Postgres Changes can become one of your biggest costs.

### 6.1 Rules
- Subscribe only while the user is on the relevant screen.
- Avoid one-subscription-per-row patterns.
- Ensure cleanup on unmount (no leaks).
- Prefer **Broadcast** for ephemeral signals:
  - typing indicators
  - presence / “is online”
  - transient UI events

### 6.2 Messaging strategy
Recommended:
- Subscribe to a **single channel per active conversation**.
- Use Broadcast for “new message” notification payloads.
- Only use Postgres Changes where you truly need “DB is the source of truth for updates”.

---

## 7) Client performance (React / Vite)

### 7.1 Default caching policy
- Use meaningful `staleTime` to prevent constant refetch.
- Disable `refetchOnWindowFocus` unless the screen truly needs it.
- For feeds, use pagination + cache pages.

### 7.2 List rendering
- Virtualize long lists:
  - messages
  - home feed
  - search results
- Keep the DOM small to avoid jank on low-end devices.

### 7.3 Image and media
- Prefer responsive posters and `loading="lazy"` for offscreen items.
- Avoid rendering expensive blurred backdrops on every card (cache or limit).

---

## 8) AI / OpenRouter operational discipline

### 8.1 Hard caps
- Enforce max tokens and timeouts.
- Apply circuit breakers per provider/model.
- Track p95 latency and failure rate per model.

### 8.2 Cost controls
- Log cost per request + per user (aggregated).
- Put quotas in `app_settings` (server enforced) for:
  - max assistant messages/day
  - max tool calls per message
  - max web search calls

### 8.3 Degradation
Define explicit fallback behaviors:
- if AI fails: show “Try again” + safe default suggestions
- if tools fail: return partial answer without tool data

---

## 9) Observability and alerting

### 9.1 What to capture (minimum)
- Edge function: request id, function name, user hash, latency, status, cold start estimate
- Postgres: top queries by total time, lock waits, connection count, replication lag (if applicable)
- Realtime: subscription count, error rate
- Client: error boundary reports, route-level timings (optional)

### 9.2 Alerting
Create alerts for:
- 5xx > 0.5% on hot endpoints
- p95 latency > target for 10 min
- DB connections approaching limit
- sudden spikes in event writes/minute
- spikes in `realtime.list_changes` total time

---

## 10) Deployment and release checklist

### Before release
- ✅ RLS enabled and policies exist for all public tables
- ✅ “debug/test” edge functions removed or gated behind internal token
- ✅ `supabase/config.toml` has explicit blocks for every function
- ✅ Run migrations on staging and verify:
  - `EXPLAIN` for top RPCs uses indexes
  - no duplicate rows violating new uniqueness constraints
- ✅ Add feature flags for risky features (AI rollouts, experimental recs)

### After release
- Watch the top 5 queries daily for 2 weeks.
- Tighten rate limits based on real traffic.
- Add rollups/materialized views for admin analytics once raw tables grow.

---

## 11) Incident response playbook (quick)

### If swipe deck latency spikes
1) Check pg_stat_statements for `media_swipe_deck_v3` and its children.
2) Run EXPLAIN on the top call signature.
3) Look for:
   - missing index usage
   - candidate explosion
   - sorts/hashes on big sets
4) Temporarily reduce deck size and increase client caching.
5) If needed, disable expensive rerank step via app_settings flag.

### If `realtime.list_changes` dominates
1) Audit active subscriptions and check for leaks.
2) Reduce Postgres Changes usage, move presence/typing to Broadcast.
3) Narrow filters, unsubscribe on background.

### If DB writes spike
1) Confirm batching is enabled client-side.
2) Check uniqueness constraint conflicts (dedupe keys).
3) Temporarily reduce event types logged if needed (feature flag).

---

## 12) Cost estimation (practical)
Your costs will scale with:
- **Edge invocations** (swipe events, AI endpoints)
- **DB writes** (events, receipts)
- **Realtime subscriptions**
- **Storage bandwidth** (posters, images)

**Best levers to reduce cost without sacrificing features**
1) Batch event ingestion (largest win)
2) Cache decks for short TTLs (reduce RPC)
3) Convert ephemeral realtime to Broadcast
4) Aggressive client caching defaults

---

## Appendix — Useful SQL snippets

### Find duplicates (should be zero after uniqueness)
```sql
select conversation_id, message_id, user_id, count(*)
from message_delivery_receipts
group by 1,2,3
having count(*) > 1;
```

### Top queries (manual inspection)
```sql
select query, calls, total_exec_time, mean_exec_time
from pg_stat_statements
order by total_exec_time desc
limit 20;
```
