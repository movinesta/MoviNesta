select cron.schedule('catalog-backfill-daily', '0 3 * * *', 'select
      net.http_post(
        url :=
          (select decrypted_secret
           from vault.decrypted_secretsselect cron.schedule('assistant-chat-reply-runner', '*/1 * * * *', 'SELECT public.invoke_assistant_chat_reply_runner_with_anon_key()');
select cron.schedule('openrouter-refresh-hourly', '0 * * * *', 'select
      net.http_post(
        url :=
          (select decrypted_secret
           from vault.decrypted_secrets
           where name = ''project_url'')
          || ''/functions/v1/openrouter-refresh'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          -- Use anon key as Bearer token so Authorization is present
          ''Authorization'',
            ''Bearer '' ||
            (select decrypted_secret
             from vault.decrypted_secrets
             where name = ''anon_key''),
          ''x-job-token'',
            (select decrypted_secret
             from vault.decrypted_secrets
             where name = ''internal_job_token'')
        ),
        body := jsonb_build_object(
          ''reason'', ''cron-openrouter-refresh''
        )
      ) as request_id;');
           where name = ''project_url'')
          || ''/functions/v1/catalog-backfill'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          -- Use anon key as Bearer token so Authorization is present
          ''Authorization'',
            ''Bearer '' ||
            (select decrypted_secret
             from vault.decrypted_secrets
             where name = ''anon_key''),
          ''x-job-token'',
            (select decrypted_secret
             from vault.decrypted_secrets
             where name = ''internal_job_token'')
        ),
        body := jsonb_build_object(
          ''reason'',       ''daily-cron-backfill'',
          ''mediaTypes'',   jsonb_build_array(''movie'',''tv''),
          ''pagesPerType'', 9,
          ''maxPerType'',   300,
          ''options'',      jsonb_build_object(''syncOmdb'', true)
        )
      ) as request_id;');
select cron.schedule('media-backfill-daily', '0 2 * * *', ' select public.invoke_media_backfill_daily(); ');
select cron.schedule('media-trending-refresh-edge-anon-key', '*/30 * * * *', 'select public.invoke_media_trending_refresh_with_anon_key();');
select cron.schedule('media-embed-backfill-voyage', '*/30 * * * *', 'SELECT public.invoke_media_embed_backfill_voyage_edge_with_anon_key();');
select cron.schedule('assistant-trigger-runner', '0 0 * * *', 'SELECT public.invoke_assistant_trigger_runner_with_anon_key()');
select cron.schedule('assistant-goal-sweeper', '0 0 * * *', 'SELECT public.invoke_assistant_goal_sweeper_with_anon_key()');
select cron.schedule('assistant-metrics-rollup-daily', '0 0 * * *', 'SELECT public.invoke_assistant_metrics_rollup_daily_with_anon_key()');
select cron.schedule('assistant-chat-reply-runner', '*/1 * * * *', 'SELECT public.invoke_assistant_chat_reply_runner_with_anon_key()');
