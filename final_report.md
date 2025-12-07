# Supabase Schema Consistency Audit Report

This report details the inconsistencies found between the generated Supabase types file (`src/types/supabase.ts`) and the actual project code.

## Summary of Findings

The audit revealed several types of inconsistencies, including:

- **Missing Relationships:** Queries using joins on tables where the relationship is not defined in the `supabase.ts` types.
- **Missing Columns:** Queries selecting or inserting data into columns that do not exist in the `supabase.ts` schema.
- **Incorrect Column Names:** Queries using incorrect column names (typos).
- **Inconsistent Enum Usage:** Code using enum values that are not defined in the `supabase.ts` schema.
- **Incorrect Property Access:** Code accessing properties on a type that do not exist.
- **Heavy `any` Casting:** Several files use `(row as any)` to bypass TypeScript's type checking, which can hide potential issues.

## Detailed Findings

### 1. `src/modules/diary/useDiaryLibrary.ts`

- **Inconsistency:** A query uses an inner join from `library_entries` to `titles`, but this relationship is not defined in the `supabase.ts` types for the `library_entries` table.
- **Query:** `supabase.from("library_entries").select('..., titles!inner(...)')`
- **Impact:** This could lead to type errors and makes it difficult to understand the intended relationships between tables.

### 2. `src/modules/home/HomeForYouTab.tsx`

- **Inconsistency:** A query filters the `titles` table for `content_type = 'anime'`, but the `content_type` enum in `supabase.ts` only allows `'movie'` or `'series'`.
- **Query:** `supabase.from("titles")...eq("content_type", "anime")`
- **Impact:** This query will likely return no data, and it indicates a misunderstanding of the schema.

### 3. `src/modules/search/search.service.ts`

- **Inconsistency:** A query uses an inner join on `title_genres` from `titles`, but this relationship is not defined in the `supabase.ts` types for the `titles` table.
- **Query:** `supabase.from("titles").select('..., title_genres!inner(genre_id, genres(id, name))')`
- **Impact:** Similar to the issue in `useDiaryLibrary.ts`, this can cause type errors and confusion.

### 4. `src/modules/title/TitleDetailPage.tsx`

- **Inconsistency 1 (Missing Columns):** The main query for `titles` selects `youtube_trailer_url`, `youtube_trailer_video_id`, and `youtube_trailer_title`. These columns do not exist in the `titles` table definition in `supabase.ts`.
- **Inconsistency 2 (Incorrect Column Names):** A query on the `follows` table uses `followed_user_id` and `follower_user_id` instead of the correct `followed_id` and `follower_id`.
- **Query:** `supabase.from("follows").select("followed_user_id").eq("follower_user_id", userId)`
- **Impact:** The query with incorrect column names will fail. The query with missing columns will also fail.

### 5. `supabase/functions/catalog-sync/index.ts`

- **Inconsistency 1 (Missing Columns):** The `buildTmdbBlock` function populates `tmdb_poster_url` and `tmdb_backdrop_url`, but these columns are not defined in the `supabase.ts` schema for the `titles` table.
- **Impact:** The insert/update operation will fail due to the missing columns.

### 6. `supabase/functions/swipe-event/index.ts`

- **Inconsistency (Missing Enum Value):** The `recordActivityEvent` function uses an `event_type` of `"swipe_skipped"`, which is not defined in the `activity_event_type` enum in `supabase.ts`.
- **Impact:** While the `event_type` column is a `string` and won't cause a database error, this is inconsistent with the intended enum usage and can lead to unexpected behavior in downstream processing.

### 7. `supabase/functions/swipe-trending/index.ts`

- **Inconsistency (Incorrect Property Access):** The code accesses a non-existent `preferredContentType` property on the `UserProfile` type.
- **Code:** `if (candidate.content_type === profile.preferredContentType)`
- **Impact:** This will likely result in a runtime error.

## Test Suite Status

The test suite is currently failing. I attempted to fix the tests, but was unsuccessful. The errors seem to be related to incorrect mocks and missing environment variables. Further investigation is required to resolve these issues.

## Recommendations

1.  **Update Supabase Types:** Regenerate the `supabase.ts` file to ensure it accurately reflects the current database schema, including all relationships and correct column names.
2.  **Fix Incorrect Queries:** Correct the queries in the identified files to use the proper column names, relationships, and enum values.
3.  **Add Missing Columns:** If the missing columns (`youtube_trailer_*`, `tmdb_poster_url`, `tmdb_backdrop_url`) are required, add them to the `titles` table and then regenerate the types.
4.  **Correct Type Definitions:** Update the `UserProfile` type to include the `preferredContentType` property if it's intended to be there, or update the code to derive it from `contentTypeWeights`.
5.  **Reduce `any` Casting:** Refactor the code to avoid using `(row as any)` and instead rely on the generated Supabase types. This will improve type safety and make the code easier to maintain.
6.  **Fix Test Suite:** Investigate and fix the failing tests. This will likely involve updating mocks and ensuring that environment variables are loaded correctly in the test environment.
