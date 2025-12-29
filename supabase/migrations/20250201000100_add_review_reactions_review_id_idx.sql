-- Add missing index to speed review reaction lookups by review id
create index if not exists review_reactions_review_id_idx
  on public.review_reactions (review_id);
