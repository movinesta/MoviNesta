-- Guard assistant_health_snapshot_v1 against missing ops_alerts table.
create or replace function public.assistant_health_snapshot_v1() returns jsonb
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_now timestamptz := now();
  v_counts jsonb;
  v_by_kind jsonb;
  v_oldest_pending bigint;
  v_oldest_processing bigint;
  v_last24 jsonb;
  v_failures jsonb;
  v_ai_failures jsonb;
  v_cron jsonb;
begin
  perform public.assert_admin();

  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb) into v_counts
  from (select status, count(*)::int as cnt from public.assistant_reply_jobs group by status) s;

  with k as (
    select job_kind,
      sum((status = 'pending')::int) as pending,
      sum((status = 'processing')::int) as processing,
      sum((status = 'done')::int) as done,
      sum((status = 'failed')::int) as failed,
      count(*)::int as total
    from public.assistant_reply_jobs group by job_kind
  )
  select coalesce(jsonb_object_agg(
    job_kind,
    jsonb_build_object('pending', pending, 'processing', processing, 'done', done, 'failed', failed, 'total', total)
  ), '{}'::jsonb)
  into v_by_kind from k;

  select floor(extract(epoch from (v_now - min(created_at))))::bigint
  into v_oldest_pending from public.assistant_reply_jobs where status = 'pending';
  select floor(extract(epoch from (v_now - min(updated_at))))::bigint
  into v_oldest_processing from public.assistant_reply_jobs where status = 'processing';

  select jsonb_build_object('created', count(*)::int, 'done', sum((status = 'done')::int), 'failed', sum((status = 'failed')::int))
  into v_last24 from public.assistant_reply_jobs where created_at >= (v_now - interval '24 hours');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'conversationId', conversation_id,
    'userId', user_id,
    'jobKind', job_kind,
    'attempts', attempts,
    'updatedAt', updated_at,
    'lastError', left(coalesce(last_error, ''), 220)
  ) order by updated_at desc), '[]'::jsonb)
  into v_failures from (
    select * from public.assistant_reply_jobs where status = 'failed' order by updated_at desc limit 20
  ) f;

  if to_regclass('public.ops_alerts') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'createdAt', created_at,
      'requestId', request_id,
      'userId', user_id,
      'code', code,
      'reason', message,
      'context', left(context::text, 500)
    ) order by created_at desc), '[]'::jsonb)
    into v_ai_failures
    from (
      select *
      from public.ops_alerts
      where kind = 'assistant_failure'
        and created_at >= (v_now - interval '72 hours')
      order by created_at desc
      limit 50
    ) af;
  else
    v_ai_failures := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'job', job_name,
    'requestId', request_id,
    'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
  into v_cron from (
    select id, job_name, request_id, created_at from public.assistant_cron_requests order by created_at desc limit 25
  ) c;

  return jsonb_build_object(
    'ok', true,
    'ts', v_now,
    'counts', v_counts,
    'byKind', v_by_kind,
    'oldestPendingSec', coalesce(v_oldest_pending, 0),
    'oldestProcessingSec', coalesce(v_oldest_processing, 0),
    'last24h', coalesce(v_last24, '{}'::jsonb),
    'recentFailures', v_failures,
    'recentAiFailures', coalesce(v_ai_failures, '[]'::jsonb),
    'recentCron', v_cron
  );
end;
$$;
