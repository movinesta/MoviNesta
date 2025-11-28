/**
 * Legacy external movie search helpers.
 *
 * This module is kept for backwards compatibility but no longer performs any
 * direct calls to OMDb or TMDb. The app now relies entirely on Supabase for
 * title search and discovery.
 */

export type ExternalTitleResult = {
  imdbId: string;
  title: string;
  year: number | null;
  type: string | null;
  posterUrl: string | null;
};

export async function searchExternalTitles(_query: string): Promise<ExternalTitleResult[]> {
  return [];
}
