-- MoviNesta AI Assistant FINAL - RUN ALL
-- Apply on top of supabase/schema/schema_full_20260102_020425.sql
-- Run this entire file in Supabase SQL Editor.


-- =============================================================
-- BEGIN 01_service_role_rls.sql
-- =============================================================
-- MoviNesta Assistant hardening (RLS policies)
-- Apply this in Supabase SQL editor.

-- assistant_metrics_daily: Edge Functions need to insert/update rollups.
DO $$
BEGIN
  IF to_regclass('public.assistant_metrics_daily') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'assistant_metrics_daily'
        AND policyname = 'rls_assistant_metrics_daily_service_role_all'
    ) THEN
      EXECUTE 'CREATE POLICY rls_assistant_metrics_daily_service_role_all ON public.assistant_metrics_daily TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END
$$;

-- assistant_trigger_fires: Edge Functions need to insert/update trigger fire records.
DO $$
BEGIN
  IF to_regclass('public.assistant_trigger_fires') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'assistant_trigger_fires'
        AND policyname = 'rls_assistant_trigger_fires_service_role_all'
    ) THEN
      EXECUTE 'CREATE POLICY rls_assistant_trigger_fires_service_role_all ON public.assistant_trigger_fires TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END
$$;

-- END 01_service_role_rls.sql

-- =============================================================
-- BEGIN 02_extensions_and_indexes.sql
-- =============================================================
-- MoviNesta AI Assistant (Final)
-- Extensions + core indexes used by assistant tools.
-- Safe to run multiple times.

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- assistant_message_action_log: keep ONE canonical handle index
-- ----------------------------------------------------------------------------
-- Older iterations created similar indexes under different names.
-- Drop legacy names (if any) then create the canonical one.
drop index if exists public.assistant_message_action_log_user_action_id_created_at_idx;
drop index if exists public.assistant_message_action_log_user_action_created_idx;

create index if not exists assistant_message_action_log_user_action_created_idx
  on public.assistant_message_action_log using btree (user_id, action_id, created_at desc);

-- ----------------------------------------------------------------------------
-- list_items: faster de-dupe / membership checks
-- ----------------------------------------------------------------------------
create index if not exists idx_list_items_list_id_title_id
  on public.list_items using btree (list_id, title_id);

-- ----------------------------------------------------------------------------
-- reviews: faster upsert / latest lookup per (user,title)
-- ----------------------------------------------------------------------------
create index if not exists reviews_user_title_updated_idx
  on public.reviews using btree (user_id, title_id, updated_at desc);

-- END 02_extensions_and_indexes.sql

-- =============================================================
-- BEGIN 03_plan_execute_tx.sql
-- =============================================================
-- MoviNesta AI Assistant v5 migrations
-- Date: 2026-01-02
--
-- Adds a transactional multi-step plan executor RPC used by the assistant.
-- Failure mode is "rollback only summary": the function returns a compact
-- {ok:false, rolledBack:true, error:"..."} object (no partial step details).
--
-- Safe to re-run.

-- -----------------------------------------------------------------------------
-- 0) Helpful indexes (safe if already applied in earlier migrations)
-- -----------------------------------------------------------------------------
create index if not exists idx_list_items_list_id_title_id
  on public.list_items using btree (list_id, title_id);

create index if not exists assistant_message_action_log_user_action_created_idx
  on public.assistant_message_action_log using btree (user_id, action_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 1) Transactional plan executor
-- -----------------------------------------------------------------------------
create or replace function public.assistant_tx_plan_execute_v1(p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_steps jsonb;
  v_len int;
  v_i int;
  v_step jsonb;
  v_tool text;
  v_args jsonb;
  v_now timestamptz := now();

  -- common
  v_list_id uuid;
  v_title_id uuid;
  v_item_id uuid;
  v_target_id uuid;
  v_ct public.content_type;
  v_ct_text text;
  v_note text;
  v_pos int;

  -- ratings
  v_rating numeric(3,1);
  v_comment text;

  -- reviews
  v_review_id uuid;
  v_body text;
  v_headline text;
  v_spoiler boolean;

  -- diary
  v_status_text text;
  v_status public.library_status;
  v_started_at timestamptz;
  v_completed_at timestamptz;
  v_notes text;

  -- notifications
  v_all boolean;
  v_ids uuid[];

  -- conversation mute
  v_muted boolean;
  v_muted_until timestamptz;

  -- outputs (success only; small)
  v_outputs jsonb := '[]'::jsonb;

  -- item iterator
  it jsonb;
  inserted_title_ids jsonb;
  v_added boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'rolledBack', true, 'error', 'UNAUTHENTICATED');
  end if;

  v_steps := p_plan->'steps';
  if jsonb_typeof(v_steps) <> 'array' then
    return jsonb_build_object('ok', false, 'rolledBack', true, 'error', 'Missing steps');
  end if;

  v_len := jsonb_array_length(v_steps);
  if v_len < 1 then
    return jsonb_build_object('ok', false, 'rolledBack', true, 'error', 'No steps');
  end if;
  if v_len > 10 then
    return jsonb_build_object('ok', false, 'rolledBack', true, 'error', 'Too many steps (max 10)');
  end if;

  -- Wrap execution in an exception block so any error rolls back all work.
  begin
    for v_i in 0..(v_len - 1) loop
      v_step := v_steps->v_i;
      v_tool := coalesce(v_step->>'tool', '');
      v_args := coalesce(v_step->'args', '{}'::jsonb);

      if v_tool = '' then
        raise exception 'Missing tool at step %', v_i;
      end if;

      -- reset per-step vars
      v_list_id := null;
      v_title_id := null;
      v_item_id := null;
      v_target_id := null;
      v_ct := null;
      v_pos := null;
      v_note := null;

      -- helper: resolve content_type from args or media_items
      -- (inline pattern per tool that needs it)

      if v_tool = 'create_list' then
        -- args: name, description?, isPublic?, items?
        if nullif(trim(coalesce(v_args->>'name','')), '') is null then
          raise exception 'List name is required';
        end if;

        insert into public.lists (user_id, name, description, is_public, created_at, updated_at)
        values (
          v_uid,
          left(trim(v_args->>'name'), 120),
          nullif(left(trim(coalesce(v_args->>'description','')), 500), ''),
          (lower(coalesce(v_args->>'isPublic','false')) in ('true','1','yes')),
          v_now,
          v_now
        )
        returning id into v_list_id;

        -- Optional items array
        if jsonb_typeof(v_args->'items') = 'array' then
          v_pos := 0;
          for it in select * from jsonb_array_elements(v_args->'items') loop
            exit when v_pos >= 50;
            if (it->>'titleId') is null then
              continue;
            end if;
            v_title_id := (it->>'titleId')::uuid;

            -- content_type
            v_ct_text := lower(coalesce(it->>'contentType',''));
            if v_ct_text in ('movie','series','anime') then
              v_ct := v_ct_text::public.content_type;
            else
              select (case mi.kind::text when 'anime' then 'anime' when 'series' then 'series' else 'movie' end)::public.content_type
                into v_ct
              from public.media_items mi
              where mi.id = v_title_id;
              if v_ct is null then
                v_ct := 'movie'::public.content_type;
              end if;
            end if;

            v_note := nullif(left(trim(coalesce(it->>'note','')), 200), '');
            v_pos := v_pos + 1;

            insert into public.list_items (list_id, title_id, content_type, "position", note, created_at, updated_at)
            values (v_list_id, v_title_id, v_ct, v_pos, v_note, v_now, v_now);
          end loop;
        end if;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'listId', v_list_id));

      elsif v_tool = 'list_add_item' then
        v_list_id := (v_args->>'listId')::uuid;
        v_title_id := (v_args->>'titleId')::uuid;
        if v_list_id is null or v_title_id is null then
          raise exception 'Missing listId/titleId';
        end if;

        -- ownership check
        perform 1 from public.lists l where l.id = v_list_id and l.user_id = v_uid;
        if not found then
          raise exception 'List not found';
        end if;

        -- dedupe
        perform 1 from public.list_items li where li.list_id = v_list_id and li.title_id = v_title_id;
        if found then
          v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'listId', v_list_id, 'titleId', v_title_id, 'added', false));
        else
          -- content_type
          v_ct_text := lower(coalesce(v_args->>'contentType',''));
          if v_ct_text in ('movie','series','anime') then
            v_ct := v_ct_text::public.content_type;
          else
            select (case mi.kind::text when 'anime' then 'anime' when 'series' then 'series' else 'movie' end)::public.content_type
              into v_ct
            from public.media_items mi
            where mi.id = v_title_id;
            if v_ct is null then
              v_ct := 'movie'::public.content_type;
            end if;
          end if;

          select coalesce(max(li."position"), 0) + 1 into v_pos
          from public.list_items li
          where li.list_id = v_list_id;

          v_note := nullif(left(trim(coalesce(v_args->>'note','')), 200), '');

          insert into public.list_items (list_id, title_id, content_type, "position", note, created_at, updated_at)
          values (v_list_id, v_title_id, v_ct, v_pos, v_note, v_now, v_now)
          returning id into v_item_id;

          update public.lists set updated_at = v_now where id = v_list_id;

          v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'listId', v_list_id, 'titleId', v_title_id, 'itemId', v_item_id, 'added', true));
        end if;

      elsif v_tool = 'list_add_items' then
        v_list_id := (v_args->>'listId')::uuid;
        if v_list_id is null then
          raise exception 'Missing listId';
        end if;

        perform 1 from public.lists l where l.id = v_list_id and l.user_id = v_uid;
        if not found then
          raise exception 'List not found';
        end if;

        if jsonb_typeof(v_args->'items') <> 'array' then
          raise exception 'Missing items';
        end if;

        select coalesce(max(li."position"), 0) into v_pos
        from public.list_items li
        where li.list_id = v_list_id;

        inserted_title_ids := '[]'::jsonb;
        v_pos := coalesce(v_pos, 0);

        for it in select * from jsonb_array_elements(v_args->'items') loop
          exit when jsonb_array_length(inserted_title_ids) >= 50;
          if (it->>'titleId') is null then
            continue;
          end if;
          v_title_id := (it->>'titleId')::uuid;

          -- dedupe
          perform 1 from public.list_items li where li.list_id = v_list_id and li.title_id = v_title_id;
          if found then
            continue;
          end if;

          -- content_type
          v_ct_text := lower(coalesce(it->>'contentType',''));
          if v_ct_text in ('movie','series','anime') then
            v_ct := v_ct_text::public.content_type;
          else
            select (case mi.kind::text when 'anime' then 'anime' when 'series' then 'series' else 'movie' end)::public.content_type
              into v_ct
            from public.media_items mi
            where mi.id = v_title_id;
            if v_ct is null then
              v_ct := 'movie'::public.content_type;
            end if;
          end if;

          v_note := nullif(left(trim(coalesce(it->>'note','')), 200), '');
          v_pos := v_pos + 1;

          insert into public.list_items (list_id, title_id, content_type, "position", note, created_at, updated_at)
          values (v_list_id, v_title_id, v_ct, v_pos, v_note, v_now, v_now);

          inserted_title_ids := inserted_title_ids || jsonb_build_array(v_title_id);
        end loop;

        update public.lists set updated_at = v_now where id = v_list_id;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'listId', v_list_id, 'insertedTitleIds', inserted_title_ids));

      elsif v_tool = 'list_remove_item' then
        v_list_id := (v_args->>'listId')::uuid;
        if v_list_id is null then
          raise exception 'Missing listId';
        end if;

        v_item_id := null;
        if (v_args->>'itemId') is not null and (v_args->>'itemId') <> '' then
          v_item_id := (v_args->>'itemId')::uuid;
        end if;

        v_title_id := null;
        if (v_args->>'titleId') is not null and (v_args->>'titleId') <> '' then
          v_title_id := (v_args->>'titleId')::uuid;
        end if;

        if v_item_id is null and v_title_id is null then
          raise exception 'Provide itemId or titleId';
        end if;

        -- ownership via lists join
        delete from public.list_items li
        using public.lists l
        where l.id = li.list_id
          and l.user_id = v_uid
          and l.id = v_list_id
          and (v_item_id is null or li.id = v_item_id)
          and (v_title_id is null or li.title_id = v_title_id);

        update public.lists set updated_at = v_now where id = v_list_id and user_id = v_uid;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'listId', v_list_id, 'removed', true));

      elsif v_tool = 'list_set_visibility' then
        v_list_id := (v_args->>'listId')::uuid;
        if v_list_id is null then
          raise exception 'Missing listId';
        end if;

        update public.lists
          set is_public = (lower(coalesce(v_args->>'isPublic','false')) in ('true','1','yes')),
              updated_at = v_now
        where id = v_list_id and user_id = v_uid;

        if not found then
          raise exception 'List not found';
        end if;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'listId', v_list_id, 'isPublic', (lower(coalesce(v_args->>'isPublic','false')) in ('true','1','yes'))));

      elsif v_tool = 'rate_title' then
        v_title_id := (v_args->>'titleId')::uuid;
        if v_title_id is null then
          raise exception 'Missing titleId';
        end if;

        v_rating := (v_args->>'rating')::numeric;
        if v_rating is null then
          raise exception 'Missing rating';
        end if;
        if v_rating < 0 or v_rating > 10 then
          raise exception 'Rating must be between 0 and 10';
        end if;
        if mod(v_rating * 2, 1) <> 0 then
          raise exception 'Rating must be in 0.5 increments';
        end if;

        v_comment := nullif(left(trim(coalesce(v_args->>'comment','')), 400), '');

        -- content_type
        v_ct_text := lower(coalesce(v_args->>'contentType',''));
        if v_ct_text in ('movie','series','anime') then
          v_ct := v_ct_text::public.content_type;
        else
          select (case mi.kind::text when 'anime' then 'anime' when 'series' then 'series' else 'movie' end)::public.content_type
            into v_ct
          from public.media_items mi
          where mi.id = v_title_id;
          if v_ct is null then
            v_ct := 'movie'::public.content_type;
          end if;
        end if;

        insert into public.ratings (user_id, title_id, content_type, rating, comment, created_at, updated_at)
        values (v_uid, v_title_id, v_ct, v_rating, v_comment, v_now, v_now)
        on conflict (user_id, title_id)
        do update set
          rating = excluded.rating,
          comment = excluded.comment,
          content_type = excluded.content_type,
          updated_at = excluded.updated_at;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'titleId', v_title_id, 'rating', v_rating));

      elsif v_tool = 'review_upsert' then
        v_title_id := (v_args->>'titleId')::uuid;
        if v_title_id is null then
          raise exception 'Missing titleId';
        end if;

        v_body := nullif(trim(coalesce(v_args->>'body','')), '');
        if v_body is null then
          raise exception 'Review body is required';
        end if;
        v_body := left(v_body, 6000);

        v_spoiler := (lower(coalesce(v_args->>'spoiler','false')) in ('true','1','yes'));
        v_headline := nullif(left(trim(coalesce(v_args->>'headline','')), 140), '');

        -- rating is optional
        v_rating := null;
        if (v_args->>'rating') is not null and (v_args->>'rating') <> '' then
          v_rating := (v_args->>'rating')::numeric;
          if v_rating < 0 or v_rating > 10 then
            raise exception 'Rating must be between 0 and 10';
          end if;
          if mod(v_rating * 2, 1) <> 0 then
            raise exception 'Rating must be in 0.5 increments';
          end if;
        end if;

        -- content_type
        v_ct_text := lower(coalesce(v_args->>'contentType',''));
        if v_ct_text in ('movie','series','anime') then
          v_ct := v_ct_text::public.content_type;
        else
          select (case mi.kind::text when 'anime' then 'anime' when 'series' then 'series' else 'movie' end)::public.content_type
            into v_ct
          from public.media_items mi
          where mi.id = v_title_id;
          if v_ct is null then
            v_ct := 'movie'::public.content_type;
          end if;
        end if;

        select r.id into v_review_id
        from public.reviews r
        where r.user_id = v_uid and r.title_id = v_title_id
        order by r.updated_at desc
        limit 1;

        if v_review_id is not null then
          update public.reviews
            set body = v_body,
                spoiler = v_spoiler,
                headline = v_headline,
                rating = v_rating,
                content_type = v_ct,
                updated_at = v_now
          where id = v_review_id;

          v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'titleId', v_title_id, 'reviewId', v_review_id, 'updated', true));
        else
          insert into public.reviews (user_id, title_id, content_type, rating, headline, body, spoiler, created_at, updated_at)
          values (v_uid, v_title_id, v_ct, v_rating, v_headline, v_body, v_spoiler, v_now, v_now)
          returning id into v_review_id;

          v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'titleId', v_title_id, 'reviewId', v_review_id, 'created', true));
        end if;

      elsif v_tool = 'diary_set_status' then
        v_title_id := (v_args->>'titleId')::uuid;
        if v_title_id is null then
          raise exception 'Missing titleId';
        end if;

        v_status_text := lower(coalesce(v_args->>'status',''));
        if v_status_text not in ('want_to_watch','watching','watched','dropped') then
          raise exception 'Invalid status';
        end if;
        v_status := v_status_text::public.library_status;

        v_started_at := null;
        if (v_args->>'startedAt') is not null and (v_args->>'startedAt') <> '' then
          v_started_at := (v_args->>'startedAt')::timestamptz;
        end if;

        v_completed_at := null;
        if (v_args->>'completedAt') is not null and (v_args->>'completedAt') <> '' then
          v_completed_at := (v_args->>'completedAt')::timestamptz;
        end if;

        v_notes := nullif(left(trim(coalesce(v_args->>'notes','')), 2000), '');

        -- content_type
        v_ct_text := lower(coalesce(v_args->>'contentType',''));
        if v_ct_text in ('movie','series','anime') then
          v_ct := v_ct_text::public.content_type;
        else
          select (case mi.kind::text when 'anime' then 'anime' when 'series' then 'series' else 'movie' end)::public.content_type
            into v_ct
          from public.media_items mi
          where mi.id = v_title_id;
          if v_ct is null then
            v_ct := 'movie'::public.content_type;
          end if;
        end if;

        insert into public.library_entries (user_id, title_id, content_type, status, notes, started_at, completed_at, created_at, updated_at)
        values (v_uid, v_title_id, v_ct, v_status, v_notes, v_started_at, v_completed_at, v_now, v_now)
        on conflict (user_id, title_id)
        do update set
          status = excluded.status,
          notes = excluded.notes,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          content_type = excluded.content_type,
          updated_at = excluded.updated_at;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'titleId', v_title_id, 'status', v_status_text));

      elsif v_tool = 'follow_user' then
        v_target_id := (coalesce(nullif(v_args->>'targetUserId',''), nullif(v_args->>'userId','')))::uuid;
        if v_target_id is null then
          raise exception 'Missing userId';
        end if;
        if v_target_id = v_uid then
          raise exception 'Cannot follow yourself';
        end if;

        insert into public.follows (follower_id, followed_id, created_at)
        values (v_uid, v_target_id, v_now)
        on conflict (follower_id, followed_id) do nothing;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'userId', v_target_id, 'following', true));

      elsif v_tool = 'unfollow_user' then
        v_target_id := (coalesce(nullif(v_args->>'targetUserId',''), nullif(v_args->>'userId','')))::uuid;
        if v_target_id is null then
          raise exception 'Missing userId';
        end if;

        delete from public.follows where follower_id = v_uid and followed_id = v_target_id;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'userId', v_target_id, 'following', false));

      elsif v_tool = 'block_user' then
        v_target_id := (coalesce(nullif(v_args->>'targetUserId',''), nullif(v_args->>'userId','')))::uuid;
        if v_target_id is null then
          raise exception 'Missing userId';
        end if;
        if v_target_id = v_uid then
          raise exception 'Cannot block yourself';
        end if;

        insert into public.blocked_users (blocker_id, blocked_id, created_at)
        values (v_uid, v_target_id, v_now)
        on conflict (blocker_id, blocked_id) do nothing;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'userId', v_target_id, 'blocked', true));

      elsif v_tool = 'unblock_user' then
        v_target_id := (coalesce(nullif(v_args->>'targetUserId',''), nullif(v_args->>'userId','')))::uuid;
        if v_target_id is null then
          raise exception 'Missing userId';
        end if;

        delete from public.blocked_users where blocker_id = v_uid and blocked_id = v_target_id;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'userId', v_target_id, 'blocked', false));

      elsif v_tool = 'notifications_mark_read' then
        v_all := (lower(coalesce(v_args->>'all','false')) in ('true','1','yes'));

        if v_all then
          update public.notifications set is_read = true where user_id = v_uid;
        else
          if jsonb_typeof(v_args->'ids') <> 'array' then
            raise exception 'Provide ids or set all=true';
          end if;

          -- parse up to 50 ids
          select array(
            select (value::text)::uuid
            from jsonb_array_elements_text(v_args->'ids')
            limit 50
          ) into v_ids;

          if v_ids is null or array_length(v_ids, 1) is null then
            raise exception 'Provide ids or set all=true';
          end if;

          update public.notifications set is_read = true where user_id = v_uid and id = any(v_ids);
        end if;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'markedRead', true, 'all', v_all));

      elsif v_tool = 'conversation_mute' then
        v_list_id := (v_args->>'conversationId')::uuid;
        if v_list_id is null then
          raise exception 'Missing conversationId';
        end if;

        perform 1 from public.conversation_participants cp where cp.conversation_id = v_list_id and cp.user_id = v_uid;
        if not found then
          raise exception 'Not a participant of this conversation';
        end if;

        v_muted := (lower(coalesce(v_args->>'muted','true')) in ('true','1','yes'));

        v_muted_until := null;
        if (v_args->>'mutedUntil') is not null and (v_args->>'mutedUntil') <> '' then
          v_muted_until := (v_args->>'mutedUntil')::timestamptz;
        end if;

        insert into public.conversation_prefs (user_id, conversation_id, muted, muted_until, updated_at)
        values (v_uid, v_list_id, v_muted, v_muted_until, v_now)
        on conflict (user_id, conversation_id)
        do update set
          muted = excluded.muted,
          muted_until = excluded.muted_until,
          updated_at = excluded.updated_at;

        v_outputs := v_outputs || jsonb_build_array(jsonb_build_object('tool', v_tool, 'conversationId', v_list_id, 'muted', v_muted));

      else
        raise exception 'Unsupported tool: %', v_tool;
      end if;

    end loop;

    return jsonb_build_object('ok', true, 'outputs', v_outputs);

  exception when others then
    -- Rollback is automatic for this block. Return a compact summary only.
    return jsonb_build_object(
      'ok', false,
      'rolledBack', true,
      'error', left(coalesce(SQLERRM, 'Unknown error'), 220)
    );
  end;

end;
$$;

-- Lock down execute privileges (security definer). Only allow authenticated/service_role.
revoke all on function public.assistant_tx_plan_execute_v1(jsonb) from public;
grant execute on function public.assistant_tx_plan_execute_v1(jsonb) to authenticated;
grant execute on function public.assistant_tx_plan_execute_v1(jsonb) to service_role;

-- END 03_plan_execute_tx.sql

-- =============================================================
-- BEGIN 04_ctx_snapshot.sql
-- =============================================================
-- MoviNesta AI Assistant v6
-- Adds a compact context snapshot RPC and fixes/optimizes lookups used by the assistant.

-- Perf indexes for assistant reads (safe if they already exist).
create index if not exists media_events_user_type_created_idx
  on public.media_events (user_id, event_type, created_at desc);

create index if not exists library_entries_user_updated_idx
  on public.library_entries (user_id, updated_at desc);

create index if not exists lists_user_updated_idx
  on public.lists (user_id, updated_at desc);

-- One-call context snapshot to reduce roundtrips and hallucinations.
create or replace function public.assistant_ctx_snapshot_v1(p_limit int default 8)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_limit int;

  v_profile jsonb;
  v_prefs jsonb;

  v_library_total int;
  v_library_by_status jsonb;

  v_lists jsonb;
  v_recent_library jsonb;
  v_recent_likes jsonb;
  v_goals jsonb;

  v_lists_count int;
  v_likes_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;

  v_limit := greatest(1, least(20, coalesce(p_limit, 8)));

  select jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'displayName', p.display_name,
      'avatarUrl', p.avatar_url,
      'bio', p.bio
    )
    into v_profile
  from public.profiles p
  where p.id = v_uid;

  select jsonb_build_object(
      'enabled', ap.enabled,
      'proactivityLevel', ap.proactivity_level,
      'updatedAt', ap.updated_at
    )
    into v_prefs
  from public.assistant_prefs ap
  where ap.user_id = v_uid;

  if v_prefs is null then
    v_prefs := jsonb_build_object('enabled', false, 'proactivityLevel', 0);
  end if;

  select
    coalesce(sum(cnt), 0)::int,
    coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
    into v_library_total, v_library_by_status
  from (
    select le.status::text as status, count(*)::int as cnt
    from public.library_entries le
    where le.user_id = v_uid
    group by le.status
  ) s;

  select count(*)::int into v_lists_count
  from public.lists
  where user_id = v_uid;

  select count(*)::int into v_likes_count
  from public.media_events
  where user_id = v_uid and event_type = 'like';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'isPublic', l.is_public,
        'updatedAt', l.updated_at
      )
      order by l.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_lists
  from (
    select id, name, is_public, updated_at
    from public.lists
    where user_id = v_uid
    order by updated_at desc
    limit v_limit
  ) l;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'titleId', le.title_id,
        'status', le.status,
        'updatedAt', le.updated_at,
        'title', coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'poster', coalesce(mi.tmdb_poster_path, mi.omdb_poster),
        'kind', mi.kind
      )
      order by le.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_library
  from (
    select title_id, status, updated_at
    from public.library_entries
    where user_id = v_uid
    order by updated_at desc
    limit v_limit
  ) le
  left join public.media_items mi on mi.id = le.title_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'titleId', e.media_item_id,
        'createdAt', e.created_at,
        'kind', mi.kind,
        'title', coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'poster', coalesce(mi.tmdb_poster_path, mi.omdb_poster)
      )
      order by e.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_likes
  from (
    select media_item_id, created_at
    from public.media_events
    where user_id = v_uid and event_type = 'like'
    order by created_at desc
    limit v_limit
  ) e
  left join public.media_items mi on mi.id = e.media_item_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'kind', g.kind,
        'title', g.title,
        'description', g.description,
        'status', g.status,
        'startAt', g.start_at,
        'endAt', g.end_at,
        'progressCount', gs.progress_count,
        'targetCount', gs.target_count,
        'lastEventAt', gs.last_event_at
      )
      order by g.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_goals
  from public.assistant_goals g
  left join public.assistant_goal_state gs on gs.goal_id = g.id
  where g.user_id = v_uid and g.status = 'active'
  order by g.updated_at desc
  limit 5;

  return jsonb_build_object(
    'ok', true,
    'profile', coalesce(v_profile, '{}'::jsonb),
    'prefs', coalesce(v_prefs, '{}'::jsonb),
    'stats', jsonb_build_object(
      'libraryTotal', coalesce(v_library_total, 0),
      'libraryByStatus', coalesce(v_library_by_status, '{}'::jsonb),
      'listsCount', coalesce(v_lists_count, 0),
      'likesCount', coalesce(v_likes_count, 0)
    ),
    'lists', coalesce(v_lists, '[]'::jsonb),
    'recentLibrary', coalesce(v_recent_library, '[]'::jsonb),
    'recentLikes', coalesce(v_recent_likes, '[]'::jsonb),
    'activeGoals', coalesce(v_goals, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.assistant_ctx_snapshot_v1(int) from public;
grant execute on function public.assistant_ctx_snapshot_v1(int) to authenticated;
grant execute on function public.assistant_ctx_snapshot_v1(int) to service_role;

-- END 04_ctx_snapshot.sql

-- =============================================================
-- BEGIN 05_perf_indexes.sql
-- =============================================================
-- MoviNesta AI Assistant v7
-- Performance indexes used by the assistant's schema-aware, read-only db_read tool.
-- Safe to run multiple times.

-- Ratings / Reviews
create index if not exists ratings_user_updated_idx
  on public.ratings (user_id, updated_at desc);

create index if not exists reviews_user_updated_idx
  on public.reviews (user_id, updated_at desc);

-- Notifications
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Goals
create index if not exists assistant_goals_user_updated_idx
  on public.assistant_goals (user_id, updated_at desc);

-- Lists / list items
create index if not exists list_items_list_position_idx
  on public.list_items (list_id, position);

-- Social graph
create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc);

create index if not exists blocked_users_blocker_created_idx
  on public.blocked_users (blocker_id, created_at desc);

-- END 05_perf_indexes.sql

-- =============================================================
-- BEGIN 06_schema_hardening.sql
-- =============================================================
-- MoviNesta AI Assistant v9
-- Schema hardening: enable RLS + least-privilege grants + immutable-column guards
-- Safe to re-run.

-- -----------------------------------------------------------------------------
-- 0) Helper: admin predicate
-- -----------------------------------------------------------------------------
create or replace function public.is_app_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 1) assistant_prefs: user can read/write own prefs; admins can read all; service_role all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_prefs enable row level security;

revoke all on table public.assistant_prefs from anon, authenticated;
grant select, insert, update on table public.assistant_prefs to authenticated;
grant all on table public.assistant_prefs to service_role;

drop policy if exists assistant_prefs_select_own on public.assistant_prefs;
create policy assistant_prefs_select_own
on public.assistant_prefs
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_prefs_upsert_own on public.assistant_prefs;
create policy assistant_prefs_upsert_own
on public.assistant_prefs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_prefs_update_own on public.assistant_prefs;
create policy assistant_prefs_update_own
on public.assistant_prefs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Guard: prevent non-admin/service updates to immutable columns (user_id)
create or replace function public.assistant_prefs_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_app_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.user_id <> old.user_id then
    raise exception 'assistant_prefs.user_id is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assistant_prefs_guard_update on public.assistant_prefs;
create trigger trg_assistant_prefs_guard_update
before update on public.assistant_prefs
for each row
execute function public.assistant_prefs_guard_update();

-- -----------------------------------------------------------------------------
-- 2) assistant_memory: user can read/write own; admins read all; service_role all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_memory enable row level security;

revoke all on table public.assistant_memory from anon, authenticated;
grant select, insert, update on table public.assistant_memory to authenticated;
grant all on table public.assistant_memory to service_role;

drop policy if exists assistant_memory_select_own on public.assistant_memory;
create policy assistant_memory_select_own
on public.assistant_memory
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_memory_insert_own on public.assistant_memory;
create policy assistant_memory_insert_own
on public.assistant_memory
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_memory_update_own on public.assistant_memory;
create policy assistant_memory_update_own
on public.assistant_memory
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) assistant_suggestions: user can read own; user can update only state columns; service_role all; admins read all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_suggestions enable row level security;

revoke all on table public.assistant_suggestions from anon, authenticated;
grant select, insert, update on table public.assistant_suggestions to authenticated;
grant all on table public.assistant_suggestions to service_role;

drop policy if exists assistant_suggestions_select_own on public.assistant_suggestions;
create policy assistant_suggestions_select_own
on public.assistant_suggestions
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_suggestions_insert_own on public.assistant_suggestions;
create policy assistant_suggestions_insert_own
on public.assistant_suggestions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_suggestions_update_own on public.assistant_suggestions;
create policy assistant_suggestions_update_own
on public.assistant_suggestions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Guard updates so users can't mutate generated content
create or replace function public.assistant_suggestions_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_app_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  -- Immutable content columns
  if new.user_id <> old.user_id
    or new.surface <> old.surface
    or new.context_key <> old.context_key
    or new.context <> old.context
    or new.kind <> old.kind
    or new.title <> old.title
    or new.body <> old.body
    or new.actions <> old.actions
    or new.score <> old.score
    or coalesce(new.model,'') <> coalesce(old.model,'')
    or coalesce(new.usage,'{}'::jsonb) <> coalesce(old.usage,'{}'::jsonb)
    or new.created_at <> old.created_at
  then
    raise exception 'assistant_suggestions content is immutable; only state fields can change';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assistant_suggestions_guard_update on public.assistant_suggestions;
create trigger trg_assistant_suggestions_guard_update
before update on public.assistant_suggestions
for each row
execute function public.assistant_suggestions_guard_update();

-- Optional: enforce known surfaces (safe if you only use these)
alter table if exists public.assistant_suggestions
  drop constraint if exists assistant_suggestions_surface_chk;
alter table if exists public.assistant_suggestions
  add constraint assistant_suggestions_surface_chk
  check (surface in ('home','swipe','title','messages','diary','search','assistant'));

-- -----------------------------------------------------------------------------
-- 4) assistant_message_action_log: user can select/insert own; admins select all; service_role all
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_message_action_log enable row level security;

revoke all on table public.assistant_message_action_log from anon, authenticated;
grant select, insert on table public.assistant_message_action_log to authenticated;
grant all on table public.assistant_message_action_log to service_role;

-- Dedupe (user_id, action_id) in case older migrations inserted twice
do $$
begin
  if to_regclass('public.assistant_message_action_log') is not null then
    delete from public.assistant_message_action_log a
    using public.assistant_message_action_log b
    where a.user_id = b.user_id
      and a.action_id = b.action_id
      and a.ctid < b.ctid;
  end if;
end $$;

create unique index if not exists assistant_message_action_log_user_action_uidx
  on public.assistant_message_action_log (user_id, action_id);

drop policy if exists assistant_action_log_select_own on public.assistant_message_action_log;
create policy assistant_action_log_select_own
on public.assistant_message_action_log
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_action_log_insert_own on public.assistant_message_action_log;
create policy assistant_action_log_insert_own
on public.assistant_message_action_log
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
  )
  and exists (
    select 1 from public.messages m
    where m.id = message_id
      and m.conversation_id = conversation_id
  )
);

-- -----------------------------------------------------------------------------
-- 5) assistant_goals / goal_state / goal_events: user reads/writes own goals; goal_state/events are restricted via join
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_goals enable row level security;
alter table if exists public.assistant_goal_state enable row level security;
alter table if exists public.assistant_goal_events enable row level security;

revoke all on table public.assistant_goals from anon, authenticated;
revoke all on table public.assistant_goal_state from anon, authenticated;
revoke all on table public.assistant_goal_events from anon, authenticated;

grant select, insert, update on table public.assistant_goals to authenticated;
grant select, insert, update on table public.assistant_goal_state to authenticated;
grant select on table public.assistant_goal_events to authenticated;

grant all on table public.assistant_goals to service_role;
grant all on table public.assistant_goal_state to service_role;
grant all on table public.assistant_goal_events to service_role;

drop policy if exists assistant_goals_select_own on public.assistant_goals;
create policy assistant_goals_select_own
on public.assistant_goals
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists assistant_goals_insert_own on public.assistant_goals;
create policy assistant_goals_insert_own
on public.assistant_goals
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists assistant_goals_update_own on public.assistant_goals;
create policy assistant_goals_update_own
on public.assistant_goals
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- goal_state: tie to goals ownership
drop policy if exists assistant_goal_state_select_own on public.assistant_goal_state;
create policy assistant_goal_state_select_own
on public.assistant_goal_state
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

drop policy if exists assistant_goal_state_upsert_own on public.assistant_goal_state;
create policy assistant_goal_state_upsert_own
on public.assistant_goal_state
for insert
to authenticated
with check (
  exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

drop policy if exists assistant_goal_state_update_own on public.assistant_goal_state;
create policy assistant_goal_state_update_own
on public.assistant_goal_state
for update
to authenticated
using (
  exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

-- goal_events: read-only to owner
drop policy if exists assistant_goal_events_select_own on public.assistant_goal_events;
create policy assistant_goal_events_select_own
on public.assistant_goal_events
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1 from public.assistant_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 6) assistant_trigger_fires / triggers / metrics_daily: lock down
-- -----------------------------------------------------------------------------
alter table if exists public.assistant_trigger_fires enable row level security;
alter table if exists public.assistant_triggers enable row level security;
alter table if exists public.assistant_metrics_daily enable row level security;

revoke all on table public.assistant_trigger_fires from anon, authenticated;
revoke all on table public.assistant_triggers from anon, authenticated;
revoke all on table public.assistant_metrics_daily from anon, authenticated;

grant select on table public.assistant_trigger_fires to authenticated;
grant select on table public.assistant_triggers to authenticated;
grant select on table public.assistant_metrics_daily to authenticated;

grant all on table public.assistant_trigger_fires to service_role;
grant all on table public.assistant_triggers to service_role;
grant all on table public.assistant_metrics_daily to service_role;

-- trigger_fires: user can read own; admins can read all; no user inserts
drop policy if exists assistant_trigger_fires_select_own on public.assistant_trigger_fires;
create policy assistant_trigger_fires_select_own
on public.assistant_trigger_fires
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

-- triggers: only admins can read; hide definitions from regular users (still available via edge functions if needed)
drop policy if exists assistant_triggers_select_admin on public.assistant_triggers;
create policy assistant_triggers_select_admin
on public.assistant_triggers
for select
to authenticated
using (public.is_app_admin());

-- metrics_daily: admin-only reads
drop policy if exists assistant_metrics_daily_select_admin on public.assistant_metrics_daily;
create policy assistant_metrics_daily_select_admin
on public.assistant_metrics_daily
for select
to authenticated
using (public.is_app_admin());

-- -----------------------------------------------------------------------------
-- 7) Harden RPC function privileges (remove PUBLIC/anon)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.assistant_tx_plan_execute_v1(jsonb)') is not null then
    revoke all on function public.assistant_tx_plan_execute_v1(jsonb) from public, anon;
    grant execute on function public.assistant_tx_plan_execute_v1(jsonb) to authenticated, service_role;
  end if;

  if to_regprocedure('public.assistant_ctx_snapshot_v1(integer)') is not null then
    revoke all on function public.assistant_ctx_snapshot_v1(integer) from public, anon;
    grant execute on function public.assistant_ctx_snapshot_v1(integer) to authenticated, service_role;
  end if;
end $$;

-- END 06_schema_hardening.sql

-- =============================================================
-- BEGIN 07_noop_v10.sql
-- =============================================================
-- MoviNesta AI Assistant v10
-- No database schema changes in this version.
-- (v10 is a code-only update: evidence enforcement + evidence UI.)

-- END 07_noop_v10.sql
