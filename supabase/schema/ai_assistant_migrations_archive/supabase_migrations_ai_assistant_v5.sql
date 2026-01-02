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
