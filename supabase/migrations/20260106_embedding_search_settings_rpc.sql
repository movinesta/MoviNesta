create or replace function public.get_embedding_search_settings_v1()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'rerank_search_enabled', coalesce(rerank_search_enabled, false),
    'rerank_top_k', coalesce(rerank_top_k, 20)
  )
  from public.embedding_settings
  where id = 1
$$;

grant all on function public.get_embedding_search_settings_v1() to anon;
grant all on function public.get_embedding_search_settings_v1() to authenticated;
grant all on function public.get_embedding_search_settings_v1() to service_role;
