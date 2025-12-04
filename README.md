# MoviNesta

MoviNesta is a Vite-powered React + TypeScript SPA backed by Supabase for auth and data plus TMDB/OMDb for movie metadata. The app ships with React Query for data fetching, Tailwind utilities, and Edge Functions for swipe decks, catalog sync, and messaging helpers.

## Tech stack
- **Vite + React + TypeScript** for the frontend (see `vite.config.ts`, `src/`).
- **Supabase** for auth, row-level security, and Edge Functions (`supabase/functions`).
- **TanStack Query (React Query)** for client-side data caching (`src/lib/react-query.ts`).
- **Tailwind CSS** utilities and component primitives.
- **TMDB / OMDb** for external title metadata (`src/lib/tmdb.ts`, `src/modules/search/useSearchTitles.ts`).

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   Vite serves the app on the port it prints to the console.
3. Run linting and tests locally:
   ```bash
   npm run lint
   npm test
   ```

## Supabase setup
- Apply database schema from `supabase/schema.sql` to your Supabase project (via the Supabase SQL editor or `supabase db push --file supabase/schema.sql`).
- Edge Functions live in `supabase/functions/`. You can deploy them with the Supabase CLI, for example:
  ```bash
  supabase functions deploy swipe-for-you
  supabase functions deploy swipe-trending
  supabase functions deploy catalog-sync
  ```
- Regenerate typed database definitions with:
  ```bash
  npm run generate:supabase-types
  ```
  This script writes `src/types/supabase.ts` and expects `SUPABASE_DB_URL` (or `DATABASE_URL`) to point to your Postgres instance.

## Environment variables
Set these in your `.env` (Vite requires the `VITE_` prefix for frontend variables):

| Variable | Where it’s used | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend Supabase client | Project URL from Supabase dashboard. |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase client | Public anon key for browser access. |
| `VITE_OMDB_API_KEY` (optional) | Search fallback helpers | Used when fetching OMDb metadata in search flows. |
| `SUPABASE_URL` | Edge Functions | Supabase project URL for server-side calls. |
| `SUPABASE_ANON_KEY` | Edge Functions | Anon key for user-scoped Edge Function calls. |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Service role key for admin-only workflows that bypass RLS when needed. |
| `TMDB_API_READ_ACCESS_TOKEN` | Edge Functions (`tmdb-proxy`, `catalog-search`) | Server-side TMDB read token injected by the proxy; not exposed to the browser. |
| `SUPABASE_DB_URL` or `DATABASE_URL` | Supabase type generation | Postgres connection string for `npm run generate:supabase-types`. |

## Edge Function notes
- Shared client helpers live at `supabase/functions/_shared/supabase.ts`, providing `getUserClient` (RLS-aware) and `getAdminClient` (service-role) for reuse.
- Swipe/catalog functions such as `swipe-for-you`, `swipe-trending`, and `catalog-sync` depend on `SUPABASE_URL` plus the appropriate key (`SUPABASE_ANON_KEY` for user reads, `SUPABASE_SERVICE_ROLE_KEY` for administrative tasks).

## Regenerating Supabase types
The canonical database types live at `src/types/supabase.ts`. Run `npm run generate:supabase-types` after schema changes to refresh the generated types.

## Project scripts
- `npm run dev` – start the Vite dev server.
- `npm run build` – build to `docs/` for GitHub Pages and copy a SPA-friendly `404.html`.
- `npm run lint` – ESLint with zero-warnings tolerance for `src/**/*.{ts,tsx}`.
- `npm test` – Vitest test suite.
- `npm run generate:supabase-types` – regenerate `src/types/supabase.ts` from the database schema.
