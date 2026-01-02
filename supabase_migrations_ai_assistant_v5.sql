-- MoviNesta AI Assistant v5
-- Transactional plan executor + list_items dedupe/unique key

-- 1) Dedupe list_items then enforce uniqueness on (list_id, title_id)
DO $$
BEGIN
  IF to_regclass('public.list_items') IS NOT NULL THEN
    -- Keep one row per (list_id,title_id) and delete the rest.
    DELETE FROM public.list_items li
    USING (
      SELECT min(ctid) AS keep_ctid, list_id, title_id
      FROM public.list_items
      GROUP BY list_id, title_id
      HAVING count(*) > 1
    ) d
    WHERE li.list_id = d.list_id
      AND li.title_id = d.title_id
      AND li.ctid <> d.keep_ctid;

    -- Enforce uniqueness for safe dedupe at write-time.
    CREATE UNIQUE INDEX IF NOT EXISTS list_items_list_id_title_id_uidx
      ON public.list_items (list_id, title_id);
  END IF;
END $$;

-- 2) Transactional executor for multi-step assistant write plans.
--
-- This function is SECURITY DEFINER (bypasses RLS), so it must enforce ownership checks.
-- It returns a rollback-only summary payload on failure (no partial writes).
CREATE OR REPLACE FUNCTION public.assistant_tx_plan_execute_v1(p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_steps jsonb := COALESCE(p_plan->'steps', '[]'::jsonb);
  v_step jsonb;
  v_tool text;
  v_args jsonb;

  v_now timestamptz := now();

  v_last_list_id uuid := NULL;
  v_list_id uuid;
  v_title_id uuid;
  v_item_id uuid;
  v_target_user uuid;

  v_ct public.content_type;
  v_pos integer;

  v_rating numeric;
  v_comment text;

  v_body text;
  v_headline text;
  v_spoiler boolean;

  v_status public.library_status;

  v_conversation_id uuid;
  v_muted boolean;
  v_muted_until timestamptz;

  v_all boolean;
  v_added integer;
  v_text text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED', 'rolledBack', true);
  END IF;

  IF jsonb_typeof(v_steps) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid plan: steps must be an array', 'rolledBack', true);
  END IF;

  -- Run all steps inside a subtransaction. If anything throws, everything rolls back.
  BEGIN
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_steps) LOOP
      v_tool := COALESCE(v_step->>'tool', '');
      v_args := COALESCE(v_step->'args', '{}'::jsonb);

      IF v_tool = '' THEN
        RAISE EXCEPTION 'Missing tool';
      END IF;

      -- Convenience placeholder: listId can reference the list created earlier in this plan.
      IF (v_args ? 'listId') AND (v_args->>'listId' = '$last_list_id') THEN
        IF v_last_list_id IS NULL THEN
          RAISE EXCEPTION 'No last list id available for $last_list_id';
        END IF;
        v_args := jsonb_set(v_args, '{listId}', to_jsonb(v_last_list_id::text), true);
      ELSIF (v_tool LIKE 'list_%') AND NOT (v_args ? 'listId') AND v_last_list_id IS NOT NULL THEN
        v_args := jsonb_set(v_args, '{listId}', to_jsonb(v_last_list_id::text), true);
      END IF;

      CASE v_tool
        WHEN 'create_list' THEN
          v_text := NULLIF(trim(COALESCE(v_args->>'name', '')), '');
          IF v_text IS NULL THEN
            RAISE EXCEPTION 'List name is required';
          END IF;

          INSERT INTO public.lists (user_id, name, description, is_public, created_at, updated_at)
          VALUES (
            v_user,
            v_text,
            NULLIF(trim(COALESCE(v_args->>'description', '')), ''),
            COALESCE((v_args->>'isPublic')::boolean, false),
            v_now,
            v_now
          )
          RETURNING id INTO v_list_id;

          v_last_list_id := v_list_id;

        WHEN 'list_set_visibility' THEN
          v_list_id := (v_args->>'listId')::uuid;
          UPDATE public.lists
            SET is_public = COALESCE((v_args->>'isPublic')::boolean, false),
                updated_at = v_now
          WHERE id = v_list_id AND user_id = v_user;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'List not found';
          END IF;

        WHEN 'list_add_item' THEN
          v_list_id := (v_args->>'listId')::uuid;
          v_title_id := (v_args->>'titleId')::uuid;

          PERFORM 1 FROM public.lists WHERE id = v_list_id AND user_id = v_user;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'List not found';
          END IF;

          PERFORM 1 FROM public.media_items WHERE id = v_title_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Title not found';
          END IF;

          PERFORM 1 FROM public.list_items WHERE list_id = v_list_id AND title_id = v_title_id;
          IF FOUND THEN
            -- Already present; no-op.
            CONTINUE;
          END IF;

          -- Content type: use args.contentType if valid; else infer from media_items.kind.
          v_ct := NULL;
          BEGIN
            IF v_args ? 'contentType' THEN
              v_ct := (v_args->>'contentType')::public.content_type;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_ct := NULL;
          END;

          IF v_ct IS NULL THEN
            SELECT CASE
              WHEN kind = 'anime' THEN 'anime'::public.content_type
              WHEN kind IN ('series', 'episode') THEN 'series'::public.content_type
              ELSE 'movie'::public.content_type
            END INTO v_ct
            FROM public.media_items
            WHERE id = v_title_id;
          END IF;

          SELECT COALESCE(max(position), 0) + 1 INTO v_pos
          FROM public.list_items
          WHERE list_id = v_list_id;

          INSERT INTO public.list_items (list_id, title_id, content_type, position, note, created_at, updated_at)
          VALUES (
            v_list_id,
            v_title_id,
            v_ct,
            v_pos,
            NULLIF(left(COALESCE(v_args->>'note', ''), 200), ''),
            v_now,
            v_now
          );

        WHEN 'list_add_items' THEN
          v_list_id := (v_args->>'listId')::uuid;

          PERFORM 1 FROM public.lists WHERE id = v_list_id AND user_id = v_user;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'List not found';
          END IF;

          v_added := 0;

          SELECT COALESCE(max(position), 0) INTO v_pos
          FROM public.list_items
          WHERE list_id = v_list_id;

          FOR v_text IN
            SELECT value FROM jsonb_array_elements_text(COALESCE(v_args->'titleIds', '[]'::jsonb))
            LIMIT LEAST(GREATEST(COALESCE((v_args->>'max')::int, 30), 1), 30)
          LOOP
            v_title_id := v_text::uuid;

            PERFORM 1 FROM public.media_items WHERE id = v_title_id;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'Title not found';
            END IF;

            PERFORM 1 FROM public.list_items WHERE list_id = v_list_id AND title_id = v_title_id;
            IF FOUND THEN
              CONTINUE;
            END IF;

            v_ct := NULL;
            BEGIN
              IF v_args ? 'contentType' THEN
                v_ct := (v_args->>'contentType')::public.content_type;
              END IF;
            EXCEPTION WHEN OTHERS THEN
              v_ct := NULL;
            END;

            IF v_ct IS NULL THEN
              SELECT CASE
                WHEN kind = 'anime' THEN 'anime'::public.content_type
                WHEN kind IN ('series', 'episode') THEN 'series'::public.content_type
                ELSE 'movie'::public.content_type
              END INTO v_ct
              FROM public.media_items
              WHERE id = v_title_id;
            END IF;

            v_pos := v_pos + 1;

            INSERT INTO public.list_items (list_id, title_id, content_type, position, note, created_at, updated_at)
            VALUES (
              v_list_id,
              v_title_id,
              v_ct,
              v_pos,
              NULLIF(left(COALESCE(v_args->>'note', ''), 200), ''),
              v_now,
              v_now
            );

            v_added := v_added + 1;
          END LOOP;

        WHEN 'list_remove_item' THEN
          v_list_id := (v_args->>'listId')::uuid;

          PERFORM 1 FROM public.lists WHERE id = v_list_id AND user_id = v_user;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'List not found';
          END IF;

          v_item_id := NULL;
          v_title_id := NULL;
          BEGIN
            IF v_args ? 'itemId' THEN v_item_id := NULLIF(v_args->>'itemId', '')::uuid; END IF;
          EXCEPTION WHEN OTHERS THEN v_item_id := NULL; END;
          BEGIN
            IF v_args ? 'titleId' THEN v_title_id := NULLIF(v_args->>'titleId', '')::uuid; END IF;
          EXCEPTION WHEN OTHERS THEN v_title_id := NULL; END;

          IF v_item_id IS NULL AND v_title_id IS NULL THEN
            RAISE EXCEPTION 'Provide itemId or titleId';
          END IF;

          IF v_item_id IS NOT NULL THEN
            DELETE FROM public.list_items WHERE list_id = v_list_id AND id = v_item_id;
          ELSE
            DELETE FROM public.list_items WHERE list_id = v_list_id AND title_id = v_title_id;
          END IF;

        WHEN 'rate_title' THEN
          v_title_id := (v_args->>'titleId')::uuid;
          v_rating := (v_args->>'rating')::numeric;
          v_comment := NULLIF(left(COALESCE(v_args->>'comment', ''), 400), '');

          IF v_rating IS NULL OR v_rating < 0 OR v_rating > 10 OR (((v_rating * 2) % 1) <> 0) THEN
            RAISE EXCEPTION 'Invalid rating';
          END IF;

          PERFORM 1 FROM public.media_items WHERE id = v_title_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Title not found';
          END IF;

          v_ct := NULL;
          BEGIN
            IF v_args ? 'contentType' THEN
              v_ct := (v_args->>'contentType')::public.content_type;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_ct := NULL;
          END;

          IF v_ct IS NULL THEN
            SELECT CASE
              WHEN kind = 'anime' THEN 'anime'::public.content_type
              WHEN kind IN ('series', 'episode') THEN 'series'::public.content_type
              ELSE 'movie'::public.content_type
            END INTO v_ct
            FROM public.media_items
            WHERE id = v_title_id;
          END IF;

          INSERT INTO public.ratings (user_id, title_id, content_type, rating, comment, created_at, updated_at)
          VALUES (v_user, v_title_id, v_ct, v_rating, v_comment, v_now, v_now)
          ON CONFLICT (user_id, title_id)
          DO UPDATE SET
            content_type = EXCLUDED.content_type,
            rating = EXCLUDED.rating,
            comment = EXCLUDED.comment,
            updated_at = EXCLUDED.updated_at;

        WHEN 'review_upsert' THEN
          v_title_id := (v_args->>'titleId')::uuid;
          v_body := NULLIF(left(COALESCE(v_args->>'body', ''), 6000), '');
          IF v_body IS NULL THEN
            RAISE EXCEPTION 'Review body is required';
          END IF;

          v_spoiler := COALESCE((v_args->>'spoiler')::boolean, false);
          v_headline := NULLIF(left(COALESCE(v_args->>'headline', ''), 140), '');

          v_rating := NULL;
          BEGIN
            IF v_args ? 'rating' AND NULLIF(v_args->>'rating', '') IS NOT NULL THEN
              v_rating := (v_args->>'rating')::numeric;
              IF v_rating < 0 OR v_rating > 10 OR (((v_rating * 2) % 1) <> 0) THEN
                RAISE EXCEPTION 'Invalid rating';
              END IF;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_rating := NULL;
          END;

          PERFORM 1 FROM public.media_items WHERE id = v_title_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Title not found';
          END IF;

          v_ct := NULL;
          BEGIN
            IF v_args ? 'contentType' THEN
              v_ct := (v_args->>'contentType')::public.content_type;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_ct := NULL;
          END;

          IF v_ct IS NULL THEN
            SELECT CASE
              WHEN kind = 'anime' THEN 'anime'::public.content_type
              WHEN kind IN ('series', 'episode') THEN 'series'::public.content_type
              ELSE 'movie'::public.content_type
            END INTO v_ct
            FROM public.media_items
            WHERE id = v_title_id;
          END IF;

          -- Update latest existing review for (user,title) else insert.
          SELECT id INTO v_item_id
          FROM public.reviews
          WHERE user_id = v_user AND title_id = v_title_id
          ORDER BY updated_at DESC
          LIMIT 1;

          IF v_item_id IS NOT NULL THEN
            UPDATE public.reviews
              SET body = v_body,
                  spoiler = v_spoiler,
                  headline = v_headline,
                  rating = v_rating,
                  content_type = v_ct,
                  updated_at = v_now
            WHERE id = v_item_id;
          ELSE
            INSERT INTO public.reviews (user_id, title_id, content_type, rating, headline, body, spoiler, created_at, updated_at)
            VALUES (v_user, v_title_id, v_ct, v_rating, v_headline, v_body, v_spoiler, v_now, v_now);
          END IF;

        WHEN 'diary_set_status' THEN
          v_title_id := (v_args->>'titleId')::uuid;
          v_status := (v_args->>'status')::public.library_status;

          PERFORM 1 FROM public.media_items WHERE id = v_title_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Title not found';
          END IF;

          v_ct := NULL;
          BEGIN
            IF v_args ? 'contentType' THEN
              v_ct := (v_args->>'contentType')::public.content_type;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_ct := NULL;
          END;

          IF v_ct IS NULL THEN
            SELECT CASE
              WHEN kind = 'anime' THEN 'anime'::public.content_type
              WHEN kind IN ('series', 'episode') THEN 'series'::public.content_type
              ELSE 'movie'::public.content_type
            END INTO v_ct
            FROM public.media_items
            WHERE id = v_title_id;
          END IF;

          INSERT INTO public.library_entries (user_id, title_id, content_type, status, created_at, updated_at)
          VALUES (v_user, v_title_id, v_ct, v_status, v_now, v_now)
          ON CONFLICT (user_id, title_id)
          DO UPDATE SET
            content_type = EXCLUDED.content_type,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at;

        WHEN 'follow_user' THEN
          v_target_user := COALESCE(NULLIF(v_args->>'targetUserId', ''), NULLIF(v_args->>'userId', ''))::uuid;
          IF v_target_user = v_user THEN
            RAISE EXCEPTION 'Cannot follow yourself';
          END IF;
          INSERT INTO public.follows (follower_id, followed_id, created_at)
          VALUES (v_user, v_target_user, v_now)
          ON CONFLICT (follower_id, followed_id) DO NOTHING;

        WHEN 'unfollow_user' THEN
          v_target_user := COALESCE(NULLIF(v_args->>'targetUserId', ''), NULLIF(v_args->>'userId', ''))::uuid;
          DELETE FROM public.follows WHERE follower_id = v_user AND followed_id = v_target_user;

        WHEN 'block_user' THEN
          v_target_user := COALESCE(NULLIF(v_args->>'targetUserId', ''), NULLIF(v_args->>'userId', ''))::uuid;
          IF v_target_user = v_user THEN
            RAISE EXCEPTION 'Cannot block yourself';
          END IF;
          INSERT INTO public.blocked_users (blocker_id, blocked_id, created_at)
          VALUES (v_user, v_target_user, v_now)
          ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

        WHEN 'unblock_user' THEN
          v_target_user := COALESCE(NULLIF(v_args->>'targetUserId', ''), NULLIF(v_args->>'userId', ''))::uuid;
          DELETE FROM public.blocked_users WHERE blocker_id = v_user AND blocked_id = v_target_user;

        WHEN 'notifications_mark_read' THEN
          v_all := COALESCE((v_args->>'all')::boolean, false);
          IF v_all THEN
            UPDATE public.notifications SET is_read = true
            WHERE user_id = v_user;
          ELSE
            IF jsonb_typeof(COALESCE(v_args->'ids', '[]'::jsonb)) <> 'array' THEN
              RAISE EXCEPTION 'Provide ids or set all=true';
            END IF;
            UPDATE public.notifications SET is_read = true
            WHERE user_id = v_user
              AND id IN (
                SELECT value::uuid
                FROM jsonb_array_elements_text(v_args->'ids')
                LIMIT 50
              );
          END IF;

        WHEN 'conversation_mute' THEN
          v_conversation_id := (v_args->>'conversationId')::uuid;

          -- Must be a participant.
          PERFORM 1 FROM public.conversation_participants
          WHERE conversation_id = v_conversation_id AND user_id = v_user;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Not a participant in that conversation';
          END IF;

          v_muted := COALESCE((v_args->>'muted')::boolean, true);
          v_muted_until := NULL;
          BEGIN
            IF v_args ? 'mutedUntil' AND NULLIF(v_args->>'mutedUntil', '') IS NOT NULL THEN
              v_muted_until := (v_args->>'mutedUntil')::timestamptz;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_muted_until := NULL;
          END;

          INSERT INTO public.conversation_prefs (user_id, conversation_id, muted, muted_until, updated_at)
          VALUES (v_user, v_conversation_id, v_muted, v_muted_until, v_now)
          ON CONFLICT (user_id, conversation_id)
          DO UPDATE SET
            muted = EXCLUDED.muted,
            muted_until = EXCLUDED.muted_until,
            updated_at = EXCLUDED.updated_at;

        ELSE
          RAISE EXCEPTION 'Unsupported tool: %', v_tool;
      END CASE;
    END LOOP;

    RETURN jsonb_build_object(
      'ok', true,
      'rolledBack', false,
      'steps', jsonb_array_length(v_steps),
      'listId', CASE WHEN v_last_list_id IS NOT NULL THEN v_last_list_id::text ELSE NULL END,
      'navigateTo', CASE WHEN v_last_list_id IS NOT NULL THEN '/lists/' || v_last_list_id::text ELSE NULL END
    );

  EXCEPTION WHEN OTHERS THEN
    -- All changes inside this BEGIN block are rolled back automatically.
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'rolledBack', true);
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_tx_plan_execute_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_tx_plan_execute_v1(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_tx_plan_execute_v1(jsonb) TO service_role;
