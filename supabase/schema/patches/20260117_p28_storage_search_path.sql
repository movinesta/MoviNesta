-- DeepReview P28
-- SECURITY: Set search_path for Supabase Storage SECURITY DEFINER functions.
--
-- Supabase Database Advisor "Function Search Path Mutable" flags functions where search_path isn't set.
-- SECURITY DEFINER functions should always pin search_path to a safe value.
--
-- We use search_path = 'pg_catalog' because these functions schema-qualify storage objects already.

begin;

alter function storage.add_prefixes(_bucket_id text, _name text) set search_path = 'pg_catalog';
alter function storage.delete_leaf_prefixes(bucket_ids text[], names text[]) set search_path = 'pg_catalog';
alter function storage.delete_prefix(_bucket_id text, _name text) set search_path = 'pg_catalog';
alter function storage.lock_top_prefixes(bucket_ids text[], names text[]) set search_path = 'pg_catalog';
alter function storage.objects_delete_cleanup() set search_path = 'pg_catalog';
alter function storage.objects_update_cleanup() set search_path = 'pg_catalog';
alter function storage.prefixes_delete_cleanup() set search_path = 'pg_catalog';

commit;
