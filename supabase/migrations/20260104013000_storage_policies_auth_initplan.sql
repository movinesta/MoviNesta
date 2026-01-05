-- Migration: 20260104013000_storage_policies_auth_initplan
-- Description: Optimize Storage RLS policies to avoid per-row auth.uid() re-evaluation
--              and remove a redundant avatars SELECT policy.

BEGIN;

--
-- Supabase Database Linter (auth_rls_initplan) best practice:
--   Wrap auth.*() calls in (SELECT ...) so they are evaluated once per statement.
--
-- Additionally, prefer uuid comparisons (when safe) to enable index use.
-- Since object paths are user-controlled strings, we guard UUID casts with a regex
-- to avoid runtime cast errors during RLS evaluation.
--

-- Chat media policies (storage bucket: chat-media)
DROP POLICY IF EXISTS "Chat media delete (owner participants only)" ON storage.objects;
DROP POLICY IF EXISTS "Chat media read (participants only)" ON storage.objects;
DROP POLICY IF EXISTS "Chat media upload (participants only)" ON storage.objects;

CREATE POLICY "Chat media read (participants only)"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND split_part(name, '/', 1) = 'message_attachments'
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.user_id = (SELECT auth.uid())
        AND cp.conversation_id = (
          CASE
            WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(name, '/', 2)::uuid
          END
        )
    )
  );

CREATE POLICY "Chat media upload (participants only)"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND split_part(name, '/', 1) = 'message_attachments'
    AND split_part(name, '/', 3) = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.user_id = (SELECT auth.uid())
        AND cp.conversation_id = (
          CASE
            WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(name, '/', 2)::uuid
          END
        )
    )
  );

CREATE POLICY "Chat media delete (owner participants only)"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND split_part(name, '/', 1) = 'message_attachments'
    -- Only the owner may delete their own attachment
    AND split_part(name, '/', 3) = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.user_id = (SELECT auth.uid())
        AND cp.conversation_id = (
          CASE
            WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(name, '/', 2)::uuid
          END
        )
    )
  );

-- Avatars policies (storage bucket: avatars)
DROP POLICY IF EXISTS avatars_delete_own_prefix ON storage.objects;
DROP POLICY IF EXISTS avatars_insert_own_prefix ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own_prefix ON storage.objects;

CREATE POLICY avatars_delete_own_prefix
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );

CREATE POLICY avatars_insert_own_prefix
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );

CREATE POLICY avatars_update_own_prefix
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- This policy is redundant with avatars_read_authenticated in the baseline schema.
DROP POLICY IF EXISTS avatars_select_authenticated ON storage.objects;

COMMIT;
