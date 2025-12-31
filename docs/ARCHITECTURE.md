# MoviNesta Architecture Notes

## IDs & canonicalization

- **Canonical IDs** are UUIDs stored in `public.media_items.id`.
- **Virtual IDs** (`tmdb-<id>` / `tv-<id>`) are legacy, client-side placeholders for TMDb-only results.
  - `catalog-sync` is responsible for turning a virtual ID into a canonical UUID.
  - Clients should always navigate after canonicalization (never route to `/title/tmdb-*`).

## Core tables & RLS expectations

- `media_items`: canonical catalog items (movies/series) sourced from TMDb/OMDb.
- `library_entries`: user watchlist/diary entries keyed by `user_id` + `title_id`.
- `messages`, `message_read_receipts`, `message_delivery_receipts`: messaging storage and status tracking.
- `conversations`, `conversation_participants`: participant lists and last-read pointers.

RLS is expected to:
- Restrict reads to the current user’s own data where applicable (library, messages, receipts).
- Allow edge functions (service role) to read/write where global operations are required.

## Edge functions & payloads (selected)

- **Envelope**: `{ ok: true, ... }` on success, `{ ok: false, code?, message? }` on error.
- `catalog-sync`
  - **Request**: `{ tmdbId, contentType: "movie" | "series", options?: { syncOmdb?, forceRefresh? } }`
  - **Response**: `{ ok: true, media_item_id, kind, tmdb_id, omdb_imdb_id }`
- `media-swipe-deck`
  - **Request**: `{ sessionId, mode, limit?, seed?, kindFilter?, minImdbRating?, genresAny?, skipRerank? }`
  - **Response**: `{ ok: true, deckId, cards }`
- `media-swipe-event`
  - **Request**: `{ sessionId, mediaItemId, eventType, ... }`
  - **Response**: `{ ok: true }`

## Messaging: delivered/seen computation

- **Delivered** is tracked via `message_delivery_receipts` per message and recipient.
- **Seen** is derived from each participant’s read marker:
  - Prefer `last_read_message_id` (mapped to message timestamps when available).
  - Avoid falling back to `last_read_at` when the referenced message is not loaded to prevent false “seen” states.

## Suggested scripts

- `npm run check:edge-functions` (requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
