--
-- PostgreSQL database dump
--

\restrict XHGxenW7JnTsbBXrlZrfhTmHYWZPDyNbaHg3prcw331JMNHIFUVqts5wDg9UPaA

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

-- Started on 2025-12-24 00:47:54

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 42 (class 2615 OID 16494)
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- TOC entry 11 (class 3079 OID 56866)
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- TOC entry 5742 (class 0 OID 0)
-- Dependencies: 11
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- TOC entry 29 (class 2615 OID 16388)
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- TOC entry 40 (class 2615 OID 16624)
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- TOC entry 39 (class 2615 OID 16613)
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- TOC entry 10 (class 3079 OID 56820)
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- TOC entry 5745 (class 0 OID 0)
-- Dependencies: 10
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- TOC entry 18 (class 2615 OID 16386)
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- TOC entry 19 (class 2615 OID 16605)
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- TOC entry 145 (class 2615 OID 16542)
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- TOC entry 108 (class 2615 OID 20106)
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- TOC entry 143 (class 2615 OID 16653)
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- TOC entry 8 (class 3079 OID 52034)
-- Name: hypopg; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;


--
-- TOC entry 5751 (class 0 OID 0)
-- Dependencies: 8
-- Name: EXTENSION hypopg; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION hypopg IS 'Hypothetical indexes for PostgreSQL';


--
-- TOC entry 9 (class 3079 OID 52056)
-- Name: index_advisor; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;


--
-- TOC entry 5752 (class 0 OID 0)
-- Dependencies: 9
-- Name: EXTENSION index_advisor; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION index_advisor IS 'Query index advisor';


--
-- TOC entry 6 (class 3079 OID 16689)
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- TOC entry 5753 (class 0 OID 0)
-- Dependencies: 6
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- TOC entry 2 (class 3079 OID 16389)
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- TOC entry 5754 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- TOC entry 7 (class 3079 OID 32465)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;


--
-- TOC entry 5755 (class 0 OID 0)
-- Dependencies: 7
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 4 (class 3079 OID 16443)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- TOC entry 5756 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 5 (class 3079 OID 16654)
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- TOC entry 5757 (class 0 OID 0)
-- Dependencies: 5
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- TOC entry 3 (class 3079 OID 16432)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- TOC entry 5758 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 12 (class 3079 OID 146494)
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;


--
-- TOC entry 5759 (class 0 OID 0)
-- Dependencies: 12
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- TOC entry 1523 (class 1247 OID 16784)
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- TOC entry 1547 (class 1247 OID 16925)
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- TOC entry 1520 (class 1247 OID 16778)
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- TOC entry 1517 (class 1247 OID 16773)
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1565 (class 1247 OID 17028)
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- TOC entry 1577 (class 1247 OID 17101)
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1559 (class 1247 OID 17006)
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1568 (class 1247 OID 17038)
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1553 (class 1247 OID 16967)
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1774 (class 1247 OID 23280)
-- Name: activity_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activity_event_type AS ENUM (
    'rating_created',
    'review_created',
    'watchlist_added',
    'watchlist_removed',
    'follow_created',
    'comment_created',
    'reply_created',
    'list_created',
    'list_item_added',
    'message_sent',
    'swipe_skipped'
);


ALTER TYPE public.activity_event_type OWNER TO postgres;

--
-- TOC entry 1763 (class 1247 OID 32547)
-- Name: content_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.content_type AS ENUM (
    'movie',
    'series',
    'anime'
);


ALTER TYPE public.content_type OWNER TO postgres;

--
-- TOC entry 1780 (class 1247 OID 23310)
-- Name: episode_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.episode_status AS ENUM (
    'watching',
    'watched',
    'skipped'
);


ALTER TYPE public.episode_status OWNER TO postgres;

--
-- TOC entry 1631 (class 1247 OID 17508)
-- Name: impression_tag; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.impression_tag AS ENUM (
    'loved_it',
    'good',
    'meh',
    'bad'
);


ALTER TYPE public.impression_tag OWNER TO postgres;

--
-- TOC entry 1771 (class 1247 OID 23270)
-- Name: library_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.library_status AS ENUM (
    'want_to_watch',
    'watching',
    'watched',
    'dropped'
);


ALTER TYPE public.library_status OWNER TO postgres;

--
-- TOC entry 1848 (class 1247 OID 146850)
-- Name: media_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.media_event_type AS ENUM (
    'impression',
    'detail_open',
    'detail_close',
    'dwell',
    'like',
    'dislike',
    'skip',
    'watchlist_add',
    'watchlist_remove',
    'rating_set',
    'share',
    'watchlist',
    'rating'
);


ALTER TYPE public.media_event_type OWNER TO postgres;

--
-- TOC entry 1808 (class 1247 OID 135403)
-- Name: media_kind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.media_kind AS ENUM (
    'movie',
    'series',
    'episode',
    'other',
    'anime'
);


ALTER TYPE public.media_kind OWNER TO postgres;

--
-- TOC entry 1912 (class 1247 OID 411911)
-- Name: message_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.message_type AS ENUM (
    'text',
    'image',
    'text+image',
    'system'
);


ALTER TYPE public.message_type OWNER TO postgres;

--
-- TOC entry 1640 (class 1247 OID 17532)
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'follow',
    'comment',
    'reply',
    'reaction',
    'mention',
    'system'
);


ALTER TYPE public.notification_type OWNER TO postgres;

--
-- TOC entry 1777 (class 1247 OID 23302)
-- Name: participant_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.participant_role AS ENUM (
    'member',
    'admin',
    'owner'
);


ALTER TYPE public.participant_role OWNER TO postgres;

--
-- TOC entry 1783 (class 1247 OID 23318)
-- Name: privacy_level; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.privacy_level AS ENUM (
    'public',
    'followers_only',
    'private'
);


ALTER TYPE public.privacy_level OWNER TO postgres;

--
-- TOC entry 1634 (class 1247 OID 17518)
-- Name: profile_visibility; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.profile_visibility AS ENUM (
    'public',
    'followers_only'
);


ALTER TYPE public.profile_visibility OWNER TO postgres;

--
-- TOC entry 1786 (class 1247 OID 23326)
-- Name: report_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.report_status AS ENUM (
    'open',
    'in_review',
    'resolved',
    'dismissed'
);


ALTER TYPE public.report_status OWNER TO postgres;

--
-- TOC entry 1643 (class 1247 OID 17546)
-- Name: target_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.target_type AS ENUM (
    'feed_item',
    'review',
    'comment',
    'profile_wall'
);


ALTER TYPE public.target_type OWNER TO postgres;

--
-- TOC entry 1622 (class 1247 OID 17488)
-- Name: title_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.title_type AS ENUM (
    'movie',
    'series',
    'anime',
    'short'
);


ALTER TYPE public.title_type OWNER TO postgres;

--
-- TOC entry 1637 (class 1247 OID 17524)
-- Name: wall_visibility; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.wall_visibility AS ENUM (
    'everyone',
    'followers',
    'none'
);


ALTER TYPE public.wall_visibility OWNER TO postgres;

--
-- TOC entry 1628 (class 1247 OID 17498)
-- Name: watch_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.watch_status AS ENUM (
    'want_to_watch',
    'watching',
    'watched',
    'dropped'
);


ALTER TYPE public.watch_status OWNER TO postgres;

--
-- TOC entry 1592 (class 1247 OID 17175)
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- TOC entry 1583 (class 1247 OID 17122)
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- TOC entry 1586 (class 1247 OID 17137)
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- TOC entry 1619 (class 1247 OID 17394)
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- TOC entry 1595 (class 1247 OID 17203)
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- TOC entry 1607 (class 1247 OID 17301)
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- TOC entry 615 (class 1255 OID 16540)
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- TOC entry 5800 (class 0 OID 0)
-- Dependencies: 615
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- TOC entry 627 (class 1255 OID 16755)
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- TOC entry 501 (class 1255 OID 16539)
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- TOC entry 5803 (class 0 OID 0)
-- Dependencies: 501
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- TOC entry 544 (class 1255 OID 16538)
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- TOC entry 5805 (class 0 OID 0)
-- Dependencies: 544
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- TOC entry 721 (class 1255 OID 16597)
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- TOC entry 5837 (class 0 OID 0)
-- Dependencies: 721
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- TOC entry 673 (class 1255 OID 16618)
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- TOC entry 5839 (class 0 OID 0)
-- Dependencies: 673
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- TOC entry 595 (class 1255 OID 16599)
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- TOC entry 5841 (class 0 OID 0)
-- Dependencies: 595
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- TOC entry 488 (class 1255 OID 16609)
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- TOC entry 759 (class 1255 OID 16610)
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- TOC entry 519 (class 1255 OID 16620)
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- TOC entry 5931 (class 0 OID 0)
-- Dependencies: 519
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- TOC entry 618 (class 1255 OID 16387)
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- TOC entry 652 (class 1255 OID 466324)
-- Name: _mv_merge_policies(text, text, name[], text, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
declare
  u text;
  c text;
  pol text;
  roles_sql text;
begin
  select string_agg(quote_ident(r), ', ')
    into roles_sql
  from unnest(roles) as r;

  select string_agg('(' || public._mv_fix_rls_expr(p.qual) || ')', ' OR ')
    into u
  from pg_policies p
  where p.schemaname='public'
    and p.tablename=tname
    and p.cmd=pol_cmd
    and p.policyname = any(old_policies);

  select string_agg('(' || public._mv_fix_rls_expr(p.with_check) || ')', ' OR ')
    into c
  from pg_policies p
  where p.schemaname='public'
    and p.tablename=tname
    and p.cmd=pol_cmd
    and p.policyname = any(old_policies);

  if u is null and c is null then
    return;
  end if;

  execute format('drop policy if exists %I on public.%I;', new_policy, tname);
  foreach pol in array old_policies loop
    execute format('drop policy if exists %I on public.%I;', pol, tname);
  end loop;

  if pol_cmd = 'SELECT' then
    if u is null then u := 'true'; end if;
    execute format(
      'create policy %I on public.%I for select to %s using (%s);',
      new_policy, tname, roles_sql, u
    );

  elsif pol_cmd = 'DELETE' then
    if u is null then u := 'false'; end if;
    execute format(
      'create policy %I on public.%I for delete to %s using (%s);',
      new_policy, tname, roles_sql, u
    );

  elsif pol_cmd = 'INSERT' then
    if c is null then
      if u is null then u := 'false'; end if;
      execute format(
        'create policy %I on public.%I for insert to %s with check (%s);',
        new_policy, tname, roles_sql, u
      );
    else
      execute format(
        'create policy %I on public.%I for insert to %s with check (%s);',
        new_policy, tname, roles_sql, c
      );
    end if;

  elsif pol_cmd = 'UPDATE' then
    if u is null then u := 'true'; end if;
    if c is null then c := u; end if;
    execute format(
      'create policy %I on public.%I for update to %s using (%s) with check (%s);',
      new_policy, tname, roles_sql, u, c
    );
  end if;
end;
$$;


ALTER FUNCTION public._mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]) OWNER TO postgres;

--
-- TOC entry 840 (class 1255 OID 285130)
-- Name: _touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public._touch_updated_at() OWNER TO postgres;

--
-- TOC entry 841 (class 1255 OID 358501)
-- Name: _trg_job_run_log_coalesce_total_tokens(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._trg_job_run_log_coalesce_total_tokens() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
begin
  if new.ok is true and new.total_tokens is null then
    new.total_tokens := 0;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public._trg_job_run_log_coalesce_total_tokens() OWNER TO postgres;

--
-- TOC entry 763 (class 1255 OID 293492)
-- Name: _trg_sync_title_genres(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._trg_sync_title_genres() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.sync_title_genres_for_media_item(new.id);
  return new;
end;
$$;


ALTER FUNCTION public._trg_sync_title_genres() OWNER TO postgres;

--
-- TOC entry 556 (class 1255 OID 291046)
-- Name: admin_list_cron_jobs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_list_cron_jobs() RETURNS TABLE(jobid bigint, jobname text, schedule text, command text, active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $$
#variable_conflict use_column
begin
  -- keep admin_cron_registry in sync with existing pg_cron jobs
  insert into public.admin_cron_registry ("jobname", schedule, command, updated_at)
  select j.jobname, j.schedule, j.command, now()
  from cron.job j
  where j.jobname is not null
  on conflict ("jobname") do update
    set schedule   = excluded.schedule,
        command    = excluded.command,
        updated_at = now();

  return query
  select j.jobid::bigint, j.jobname::text, j.schedule::text, j.command::text, j.active::boolean
  from cron.job j
  order by j.jobid;
end;
$$;


ALTER FUNCTION public.admin_list_cron_jobs() OWNER TO postgres;

--
-- TOC entry 668 (class 1255 OID 290511)
-- Name: admin_run_cron_job(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_run_cron_job(p_jobname text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $$
declare
  v_jobid integer;
  v_command text;
  has_run_job boolean;
begin
  if p_jobname is null or length(trim(p_jobname)) = 0 then
    raise exception 'jobname required';
  end if;

  if to_regclass('cron.job') is not null then
    select j.jobid, j.command into v_jobid, v_command
    from cron.job j
    where j.jobname = p_jobname
    limit 1;
  end if;

  if v_command is null then
    select r.command into v_command
    from public.admin_cron_registry r
    where r.jobname = p_jobname;
  end if;

  if v_command is null then
    raise exception 'Cron job % is unknown (missing command).', p_jobname;
  end if;

  select exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'run_job'
  ) into has_run_job;

  if has_run_job and v_jobid is not null then
    perform cron.run_job(v_jobid);
  else
    execute v_command;
  end if;
end;
$$;


ALTER FUNCTION public.admin_run_cron_job(p_jobname text) OWNER TO postgres;

--
-- TOC entry 538 (class 1255 OID 287153)
-- Name: admin_search_users(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_search_users(p_search text, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, banned_until timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public', 'pg_temp'
    AS $$
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then
    raise exception 'Not authorized: Admin access required';
  end if;

  return query
  select u.id, u.email, u.created_at, u.banned_until
  from auth.users u
  where (p_search is null)
     or (u.email ilike ('%' || p_search || '%'))
  order by u.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(p_offset, 0);
end;
$$;


ALTER FUNCTION public.admin_search_users(p_search text, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- TOC entry 783 (class 1255 OID 287163)
-- Name: admin_set_cron_active(text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $$
declare
  v_jobid integer;
  v_schedule text;
  v_command text;
  has_alter boolean;
  has_active boolean;
  v_active boolean;
begin
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is not installed';
  end if;

  if p_jobname is null or length(trim(p_jobname)) = 0 then
    raise exception 'jobname required';
  end if;

  select exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'alter_job'
  ) into has_alter;

  select exists(
    select 1
    from information_schema.columns
    where table_schema='cron' and table_name='job' and column_name='active'
  ) into has_active;

  if has_active then
    select j.jobid, coalesce(j.active, true) into v_jobid, v_active
    from cron.job j
    where j.jobname = p_jobname
    limit 1;
  else
    select j.jobid into v_jobid
    from cron.job j
    where j.jobname = p_jobname
    limit 1;
    v_active := (v_jobid is not null);
  end if;

  if v_jobid is not null then
    if has_alter then
      perform cron.alter_job(v_jobid, active => p_active);
      return;
    end if;

    if p_active = false then
      perform cron.unschedule(v_jobid);
      return;
    end if;

    if v_active = false then
      select r.schedule, r.command into v_schedule, v_command
      from public.admin_cron_registry r
      where r.jobname = p_jobname;

      if v_schedule is null or v_command is null then
        raise exception 'Cron job % is disabled but not in registry. Save its schedule once, then enable.', p_jobname;
      end if;

      perform cron.unschedule(v_jobid);
      perform cron.schedule(p_jobname, v_schedule, v_command);
    end if;

    return;
  end if;

  if p_active = false then
    return;
  end if;

  select r.schedule, r.command into v_schedule, v_command
  from public.admin_cron_registry r
  where r.jobname = p_jobname;

  if v_schedule is null or v_command is null then
    raise exception 'Cron job % is not in registry. Create it once via SQL, then it will appear here.', p_jobname;
  end if;

  perform cron.schedule(p_jobname, v_schedule, v_command);
end;
$$;


ALTER FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean) OWNER TO postgres;

--
-- TOC entry 648 (class 1255 OID 290510)
-- Name: admin_set_cron_schedule(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_set_cron_schedule(p_jobname text, p_schedule text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $$
declare
  v_jobid integer;
  v_command text;
  has_alter boolean;
begin
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is not installed';
  end if;

  if p_jobname is null or length(trim(p_jobname)) = 0 then
    raise exception 'jobname required';
  end if;
  if p_schedule is null or length(trim(p_schedule)) = 0 then
    raise exception 'schedule required';
  end if;

  select exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'alter_job'
  ) into has_alter;

  select j.jobid, j.command into v_jobid, v_command
  from cron.job j
  where j.jobname = p_jobname
  limit 1;

  if v_command is null then
    select r.command into v_command
    from public.admin_cron_registry r
    where r.jobname = p_jobname;
  end if;

  if v_command is null then
    raise exception 'Cron job % is unknown (missing command).', p_jobname;
  end if;

  insert into public.admin_cron_registry(jobname, schedule, command, updated_at)
  values (p_jobname, p_schedule, v_command, now())
  on conflict (jobname) do update
    set schedule = excluded.schedule,
        command  = excluded.command,
        updated_at = now();

  if v_jobid is not null then
    if has_alter then
      perform cron.alter_job(v_jobid, schedule => p_schedule);
    else
      perform cron.unschedule(v_jobid);
      perform cron.schedule(p_jobname, p_schedule, v_command);
    end if;
  end if;
end;
$$;


ALTER FUNCTION public.admin_set_cron_schedule(p_jobname text, p_schedule text) OWNER TO postgres;

--
-- TOC entry 591 (class 1255 OID 150338)
-- Name: apply_media_event_to_daily_rollup(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_media_event_to_daily_rollup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_day date;
  v_et text;
  v_is_new_user_day boolean;
BEGIN
  v_day := COALESCE(NEW.event_day, (NEW.created_at AT TIME ZONE 'utc')::date, (NOW() AT TIME ZONE 'utc')::date);
  v_et := NEW.event_type::text;

  -- Atomic unique user tracking (any event counts toward unique users)
  INSERT INTO public.media_item_daily_users (day, media_item_id, user_id)
  VALUES (v_day, NEW.media_item_id, NEW.user_id)
  ON CONFLICT (day, media_item_id, user_id) DO NOTHING;

  v_is_new_user_day := FOUND;

  -- Atomic stats increment
  INSERT INTO public.media_item_daily (
    day, media_item_id,
    impressions, dwell_events, dwell_ms_sum,
    likes, dislikes, skips,
    watchlist_events, rating_events,
    unique_users, updated_at
  )
  VALUES (
    v_day,
    NEW.media_item_id,
    CASE WHEN v_et = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN v_et = 'dwell' THEN 1 ELSE 0 END,
    CASE WHEN v_et = 'dwell' AND NEW.dwell_ms IS NOT NULL THEN NEW.dwell_ms ELSE 0 END,
    CASE WHEN v_et = 'like' THEN 1 ELSE 0 END,
    CASE WHEN v_et = 'dislike' THEN 1 ELSE 0 END,
    CASE WHEN v_et = 'skip' THEN 1 ELSE 0 END,
    CASE WHEN v_et IN ('watchlist', 'watchlist_add') THEN 1 ELSE 0 END,
    CASE WHEN v_et IN ('rating', 'rating_set') THEN 1 ELSE 0 END,
    CASE WHEN v_is_new_user_day THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (day, media_item_id) DO UPDATE
  SET
    impressions      = public.media_item_daily.impressions + EXCLUDED.impressions,
    dwell_events     = public.media_item_daily.dwell_events + EXCLUDED.dwell_events,
    dwell_ms_sum     = public.media_item_daily.dwell_ms_sum + EXCLUDED.dwell_ms_sum,
    likes            = public.media_item_daily.likes + EXCLUDED.likes,
    dislikes         = public.media_item_daily.dislikes + EXCLUDED.dislikes,
    skips            = public.media_item_daily.skips + EXCLUDED.skips,
    watchlist_events = public.media_item_daily.watchlist_events + EXCLUDED.watchlist_events,
    rating_events    = public.media_item_daily.rating_events + EXCLUDED.rating_events,
    unique_users     = public.media_item_daily.unique_users + EXCLUDED.unique_users,
    updated_at       = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.apply_media_event_to_daily_rollup() OWNER TO postgres;

--
-- TOC entry 752 (class 1255 OID 149939)
-- Name: apply_media_event_to_feedback(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_media_event_to_feedback() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_last_action public.media_event_type;
  v_rating numeric;
  v_watchlist boolean;
  v_dwell int;
begin
  if NEW.event_type in ('like', 'dislike', 'skip', 'watchlist', 'watchlist_add', 'watchlist_remove', 'rating', 'rating_set') then
    v_last_action := NEW.event_type;
  end if;

  if NEW.event_type in ('rating', 'rating_set') then v_rating := NEW.rating_0_10; end if;
  if NEW.event_type = 'watchlist' then
    v_watchlist := NEW.in_watchlist;
  elsif NEW.event_type = 'watchlist_add' then
    v_watchlist := true;
  elsif NEW.event_type = 'watchlist_remove' then
    v_watchlist := false;
  end if;
  if NEW.event_type = 'dwell' then v_dwell := NEW.dwell_ms; end if;

  insert into public.media_feedback (user_id, media_item_id, last_action, last_action_at, rating_0_10, in_watchlist, last_dwell_ms)
  values (NEW.user_id, NEW.media_item_id, v_last_action, NEW.created_at, v_rating, v_watchlist, v_dwell)
  on conflict (user_id, media_item_id) do update
  set
    last_action = case
      -- Only update if the new event is newer
      when excluded.last_action_at >= public.media_feedback.last_action_at and excluded.last_action is not null then excluded.last_action
      else public.media_feedback.last_action
    end,
    last_action_at = greatest(public.media_feedback.last_action_at, excluded.last_action_at),
    rating_0_10 = case
      when excluded.last_action_at >= public.media_feedback.last_action_at and excluded.rating_0_10 is not null then excluded.rating_0_10
      else public.media_feedback.rating_0_10
    end,
    in_watchlist = case
      when excluded.last_action_at >= public.media_feedback.last_action_at and excluded.in_watchlist is not null then excluded.in_watchlist
      else public.media_feedback.in_watchlist
    end,
    last_dwell_ms = greatest(coalesce(public.media_feedback.last_dwell_ms, 0), coalesce(excluded.last_dwell_ms, 0));

  return NEW;
end;
$$;


ALTER FUNCTION public.apply_media_event_to_feedback() OWNER TO postgres;

--
-- TOC entry 514 (class 1255 OID 384865)
-- Name: assert_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assert_admin() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
begin
  if not exists (
    select 1 from public.app_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'admin_required';
  end if;
end;
$$;


ALTER FUNCTION public.assert_admin() OWNER TO postgres;

--
-- TOC entry 557 (class 1255 OID 392386)
-- Name: bump_conversation_on_participant_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_conversation_on_participant_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
begin
  perform public.touch_conversation_updated_at(
    case when tg_op = 'DELETE' then old.conversation_id else new.conversation_id end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.bump_conversation_on_participant_change() OWNER TO postgres;

--
-- TOC entry 726 (class 1255 OID 384885)
-- Name: bump_conversation_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bump_conversation_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;


ALTER FUNCTION public.bump_conversation_updated_at() OWNER TO postgres;

--
-- TOC entry 489 (class 1255 OID 465939)
-- Name: can_view_profile(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_view_profile(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_privacy public.privacy_level;
  v_viewer uuid;
begin
  v_viewer := auth.uid();

  -- Owner can always view self
  if v_viewer is not null and v_viewer = target_user_id then
    return true;
  end if;

  -- Read the target user's privacy setting (bypasses user_settings RLS because row_security=off)
  select us.privacy_profile
    into v_privacy
  from public.user_settings us
  where us.user_id = target_user_id;

  -- No settings row => treat as not visible
  if v_privacy is null then
    return false;
  end if;

  -- Public => visible to anyone (including anon)
  if v_privacy = 'public'::public.privacy_level then
    return true;
  end if;

  -- Followers-only => visible only if viewer follows target
  if v_privacy = 'followers_only'::public.privacy_level then
    if v_viewer is null then
      return false;
    end if;

    return exists (
      select 1
      from public.follows f
      where f.follower_id = v_viewer
        and f.followed_id = target_user_id
    );
  end if;

  -- Private => not visible
  return false;
end;
$$;


ALTER FUNCTION public.can_view_profile(target_user_id uuid) OWNER TO postgres;

--
-- TOC entry 554 (class 1255 OID 384883)
-- Name: canonicalize_direct_participant_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.canonicalize_direct_participant_ids() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  a uuid;
  b uuid;
begin
  if new.is_group = false and new.direct_participant_ids is not null then
    if array_length(new.direct_participant_ids, 1) = 2 then
      a := new.direct_participant_ids[1];
      b := new.direct_participant_ids[2];
      if a > b then
        new.direct_participant_ids := array[b, a];
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.canonicalize_direct_participant_ids() OWNER TO postgres;

--
-- TOC entry 522 (class 1255 OID 149941)
-- Name: cleanup_media_events(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_media_events(p_keep_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  deleted_count integer := 0;
begin
  delete from public.media_events e
  where e.created_at < now() - make_interval(days => p_keep_days)
    and (e.event_type::text in ('impression','dwell'))
    and e.rating_0_10 is null
    and e.in_watchlist is null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION public.cleanup_media_events(p_keep_days integer) OWNER TO postgres;

--
-- TOC entry 730 (class 1255 OID 150345)
-- Name: cleanup_media_events_hybrid(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_media_events_hybrid(p_keep_days_low_signal integer DEFAULT 90, p_keep_days_explicit integer DEFAULT 3650) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  deleted_count integer := 0;
begin
  delete from public.media_events e
  where e.created_at < now() - make_interval(days => p_keep_days_low_signal)
    and (e.event_type::text in ('impression','dwell'))
    and e.rating_0_10 is null
    and e.in_watchlist is null;

  delete from public.media_events e
  where e.created_at < now() - make_interval(days => p_keep_days_explicit)
    and (e.event_type::text in ('like','dislike','skip'))
    and e.rating_0_10 is null
    and e.in_watchlist is null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION public.cleanup_media_events_hybrid(p_keep_days_low_signal integer, p_keep_days_explicit integer) OWNER TO postgres;

--
-- TOC entry 851 (class 1255 OID 361192)
-- Name: create_direct_conversation_v1(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  pair uuid[];
  conv_id uuid;
begin
  if p_creator_id is null or p_target_user_id is null then
    raise exception 'Missing user id';
  end if;
  if p_creator_id = p_target_user_id then
    raise exception 'Cannot create conversation with self';
  end if;

  pair := array[p_creator_id, p_target_user_id];
  if pair[1] > pair[2] then
    pair := array[p_target_user_id, p_creator_id];
  end if;

  insert into public.conversations (is_group, created_by, direct_participant_ids)
  values (false, p_creator_id, pair)
  on conflict (direct_participant_ids) where (is_group = false)
  do update set updated_at = now()
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (conv_id, pair[1], 'member'),
    (conv_id, pair[2], 'member')
  on conflict (conversation_id, user_id) do nothing;

  return conv_id;
end;
$$;


ALTER FUNCTION public.create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid) OWNER TO postgres;

--
-- TOC entry 603 (class 1255 OID 384887)
-- Name: enforce_message_payload_safety(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_message_payload_safety() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  js jsonb;
  t text;
  deleted_flag boolean;
begin
  if new.attachment_url is not null and new.attachment_url ~* '^https?://' then
    raise exception 'external_attachment_url_not_allowed';
  end if;

  begin
    js := new.body::jsonb;
  exception when others then
    js := null;
  end;

  if js is not null then
    t := coalesce(js->>'type', '');
    deleted_flag := (js ? 'deleted') and ((js->>'deleted') = 'true');

    if t = 'system' then
      raise exception 'system_message_not_allowed';
    end if;

    if deleted_flag then
      raise exception 'deleted_flag_not_allowed_on_insert';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.enforce_message_payload_safety() OWNER TO postgres;

--
-- TOC entry 681 (class 1255 OID 384903)
-- Name: enforce_reaction_conversation_match(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_reaction_conversation_match() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
    declare msg_conv uuid;
    begin
      select conversation_id into msg_conv from public.messages where id = new.message_id;
      if msg_conv is null then
        raise exception 'message_not_found';
      end if;
      if new.conversation_id is distinct from msg_conv then
        raise exception 'reaction_conversation_mismatch';
      end if;
      return new;
    end;
    $$;


ALTER FUNCTION public.enforce_reaction_conversation_match() OWNER TO postgres;

--
-- TOC entry 729 (class 1255 OID 361186)
-- Name: enforce_reaction_message_scope_v1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_reaction_message_scope_v1() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if not exists (
    select 1 from public.messages m
    where m.id = new.message_id
      and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Reaction message does not belong to conversation';
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.enforce_reaction_message_scope_v1() OWNER TO postgres;

--
-- TOC entry 660 (class 1255 OID 392389)
-- Name: get_conversation_summaries(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_conversation_summaries() RETURNS TABLE(conversation_id uuid, is_group boolean, title text, updated_at timestamp with time zone, participants jsonb, participant_receipts jsonb, last_message_id uuid, last_message_created_at timestamp with time zone, last_message_user_id uuid, last_message_body text, last_message_display_name text, last_message_username text, self_last_read_message_id uuid, self_last_read_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select *
  from public.get_conversation_summaries_for_user(auth.uid());
$$;


ALTER FUNCTION public.get_conversation_summaries() OWNER TO postgres;

--
-- TOC entry 564 (class 1255 OID 421931)
-- Name: get_conversation_summaries(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_conversation_summaries(p_user_id uuid) RETURNS TABLE(conversation_id uuid, is_group boolean, title text, updated_at timestamp with time zone, participants jsonb, participant_receipts jsonb, last_message_id uuid, last_message_created_at timestamp with time zone, last_message_user_id uuid, last_message_body text, last_message_display_name text, last_message_username text, self_last_read_message_id uuid, self_last_read_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_auth uuid;
  v_role text;
  v_target uuid;
begin
  v_auth := auth.uid();
  v_role := auth.role();

  if v_auth is not null then
    -- Authenticated call: param must match, unless service_role.
    if p_user_id is not null and p_user_id <> v_auth and v_role <> 'service_role' then
      raise exception 'p_user_id must match auth.uid()';
    end if;
    v_target := v_auth;
  else
    -- No auth.uid(): allow only when service_role (server-side) and p_user_id is provided.
    if v_role <> 'service_role' then
      raise exception 'Not authenticated';
    end if;
    if p_user_id is null then
      raise exception 'p_user_id is required for service_role calls';
    end if;
    v_target := p_user_id;
  end if;

  return query
    select * from public.get_conversation_summaries_for_user(v_target);
end;
$$;


ALTER FUNCTION public.get_conversation_summaries(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 719 (class 1255 OID 421930)
-- Name: get_conversation_summaries_for_user(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_conversation_summaries_for_user(p_user_id uuid) RETURNS TABLE(conversation_id uuid, is_group boolean, title text, updated_at timestamp with time zone, participants jsonb, participant_receipts jsonb, last_message_id uuid, last_message_created_at timestamp with time zone, last_message_user_id uuid, last_message_body text, last_message_display_name text, last_message_username text, self_last_read_message_id uuid, self_last_read_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
with user_conversations as (
  select cp.conversation_id
  from public.conversation_participants cp
  where cp.user_id = p_user_id
),
last_messages as (
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.id as last_message_id,
    m.created_at as last_message_created_at,
    m.user_id as last_message_user_id,
    m.body as last_message_body
  from public.messages m
  where m.conversation_id in (select conversation_id from user_conversations)
  order by m.conversation_id, m.created_at desc, m.id desc
),
self_reads as (
  select
    r.conversation_id,
    (max(r.last_read_message_id::text))::uuid as self_last_read_message_id,
    max(r.last_read_at) as self_last_read_at
  from public.message_read_receipts r
  where r.user_id = p_user_id
    and r.conversation_id in (select conversation_id from user_conversations)
  group by r.conversation_id
),
participants_json as (
  select
    cp.conversation_id,
    jsonb_agg(
      jsonb_build_object(
        'id', cp.user_id,
        'role', cp.role,
        'joinedAt', cp.created_at,
        'username', pp.username,
        'displayName', pp.display_name,
        'avatarUrl', pp.avatar_url,
        'isSelf', (cp.user_id = p_user_id)
      )
      order by cp.created_at asc
    ) as participants
  from public.conversation_participants cp
  left join public.profiles_public pp on pp.id = cp.user_id
  where cp.conversation_id in (select conversation_id from user_conversations)
  group by cp.conversation_id
),
participant_receipts_json as (
  select
    r.conversation_id,
    jsonb_agg(
      jsonb_build_object(
        'userId', r.user_id,
        'lastReadMessageId', r.last_read_message_id,
        'lastReadAt', r.last_read_at
      )
      order by r.user_id
    ) as participant_receipts
  from public.message_read_receipts r
  where r.conversation_id in (select conversation_id from user_conversations)
  group by r.conversation_id
),
last_sender_profile as (
  select
    lm.conversation_id,
    pp.display_name as last_message_display_name,
    pp.username as last_message_username
  from last_messages lm
  left join public.profiles_public pp on pp.id = lm.last_message_user_id
)
select
  c.id as conversation_id,
  c.is_group,
  c.title,
  c.updated_at,
  coalesce(pj.participants, '[]'::jsonb) as participants,
  coalesce(prj.participant_receipts, '[]'::jsonb) as participant_receipts,
  lm.last_message_id,
  lm.last_message_created_at,
  lm.last_message_user_id,
  lm.last_message_body,
  lsp.last_message_display_name,
  lsp.last_message_username,
  sr.self_last_read_message_id,
  sr.self_last_read_at
from public.conversations c
join user_conversations uc on uc.conversation_id = c.id
left join participants_json pj on pj.conversation_id = c.id
left join participant_receipts_json prj on prj.conversation_id = c.id
left join last_messages lm on lm.conversation_id = c.id
left join last_sender_profile lsp on lsp.conversation_id = c.id
left join self_reads sr on sr.conversation_id = c.id
order by c.updated_at desc;
$$;


ALTER FUNCTION public.get_conversation_summaries_for_user(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 849 (class 1255 OID 129888)
-- Name: get_diary_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_diary_stats(p_user_id uuid) RETURNS TABLE(total_rated bigint, total_watched bigint, average_rating numeric, rating_distribution jsonb, top_genres jsonb, watch_count_by_month jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Allow access if it's the owner OR if the target profile is visible to the requester
  if auth.uid() <> p_user_id and not exists (select 1 from public.profiles_public where id = p_user_id) then
    raise exception 'Not authorized';
  end if;

  return query
  with watched_entries as (
    select le.title_id, le.updated_at
    from public.library_entries le
    where le.user_id = p_user_id and le.status = 'watched'
  ),
  rating_buckets as (
    select round((r.rating::numeric) * 2) / 2 as bucket, count(*)::bigint as bucket_count
    from public.ratings r where r.user_id = p_user_id group by bucket
  ),
  genre_counts as (
    select g.name as genre, count(*)::bigint as genre_count
    from watched_entries w
    join public.media_genres tg on tg.media_item_id = w.title_id
    join public.genres g on g.id = tg.genre_id
    group by g.name order by genre_count desc, g.name limit 8
  ),
  watch_months as (
    select to_char(date_trunc('month', w.updated_at), 'YYYY-MM') as month, count(*)::bigint as month_count
    from watched_entries w group by month order by month
  )
  select
    (select count(*)::bigint from public.ratings r where r.user_id = p_user_id) as total_rated,
    (select count(*)::bigint from watched_entries) as total_watched,
    (select avg(r.rating)::numeric from public.ratings r where r.user_id = p_user_id) as average_rating,
    coalesce((select jsonb_agg(jsonb_build_object('rating', bucket, 'count', bucket_count) order by bucket) from rating_buckets), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('genre', genre, 'count', genre_count) order by genre_count desc, genre) from genre_counts), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('month', month, 'count', month_count) order by month) from watch_months), '[]'::jsonb);
end;
$$;


ALTER FUNCTION public.get_diary_stats(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 739 (class 1255 OID 428448)
-- Name: get_embedding_settings_v1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_embedding_settings_v1() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'rerank_swipe_enabled', COALESCE(rerank_swipe_enabled, false),
    'rerank_top_k', COALESCE(rerank_top_k, 50)
  )
  FROM public.embedding_settings
  WHERE id = 1
$$;


ALTER FUNCTION public.get_embedding_settings_v1() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 410 (class 1259 OID 35098)
-- Name: activity_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    event_type public.activity_event_type NOT NULL,
    title_id text,
    related_user_id uuid,
    payload jsonb,
    media_item_id uuid
);


ALTER TABLE public.activity_events OWNER TO postgres;

--
-- TOC entry 664 (class 1255 OID 48787)
-- Name: get_home_feed(uuid, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_home_feed(p_user_id uuid, p_limit integer DEFAULT 40, p_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS SETOF public.activity_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  effective_limit integer := LEAST(COALESCE(p_limit, 40), 200);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT e.*
  FROM public.activity_events e
  WHERE (
      e.user_id = p_user_id
      OR e.user_id IN (
        SELECT f.followed_id
        FROM public.follows f
        WHERE f.follower_id = p_user_id
      )
    )
    AND (p_cursor IS NULL OR e.created_at < p_cursor)
  ORDER BY e.created_at DESC
  LIMIT effective_limit + 1;
END;
$$;


ALTER FUNCTION public.get_home_feed(p_user_id uuid, p_limit integer, p_cursor timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 504 (class 1255 OID 411976)
-- Name: get_home_feed_v2(uuid, integer, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_home_feed_v2(p_user_id uuid, p_limit integer DEFAULT 40, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, created_at timestamp with time zone, user_id uuid, event_type public.activity_event_type, media_item_id uuid, related_user_id uuid, payload jsonb, actor_profile jsonb, media_item jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  effective_limit integer := least(coalesce(p_limit, 40), 200);
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return query
  with base as (
    select e.*
    from public.activity_events e
    where (
      e.user_id = p_user_id
      or e.user_id in (select f.followed_id from public.follows f where f.follower_id = p_user_id)
    )
    and (
      p_cursor_created_at is null
      or (e.created_at, e.id) < (p_cursor_created_at, coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
    order by e.created_at desc, e.id desc
    limit effective_limit + 1
  )
  select
    b.id,
    b.created_at,
    b.user_id,
    b.event_type,
    coalesce(b.media_item_id, (case when b.title_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then b.title_id::uuid else null end)) as media_item_id,
    b.related_user_id,
    b.payload,
    jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url
    ) as actor_profile,
    jsonb_build_object(
      'id', mi.id,
      'kind', mi.kind,
      'tmdb_title', mi.tmdb_title,
      'tmdb_name', mi.tmdb_name,
      'tmdb_original_title', mi.tmdb_original_title,
      'tmdb_original_name', mi.tmdb_original_name,
      'tmdb_poster_path', mi.tmdb_poster_path,
      'tmdb_backdrop_path', mi.tmdb_backdrop_path,
      'tmdb_original_language', mi.tmdb_original_language,
      'tmdb_release_date', mi.tmdb_release_date,
      'tmdb_first_air_date', mi.tmdb_first_air_date,
      'omdb_title', mi.omdb_title,
      'omdb_year', mi.omdb_year,
      'omdb_poster', mi.omdb_poster,
      'omdb_rated', mi.omdb_rated,
      'omdb_imdb_rating', mi.omdb_imdb_rating,
      'omdb_rating_rotten_tomatoes', mi.omdb_rating_rotten_tomatoes,
      'omdb_imdb_id', mi.omdb_imdb_id,
      'tmdb_id', mi.tmdb_id
    ) as media_item
  from base b
  join public.profiles p on p.id = b.user_id
  left join public.media_items mi on mi.id = coalesce(b.media_item_id, (case when b.title_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then b.title_id::uuid else null end))
  order by b.created_at desc, b.id desc;
end;
$_$;


ALTER FUNCTION public.get_home_feed_v2(p_user_id uuid, p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_id uuid) OWNER TO postgres;

--
-- TOC entry 744 (class 1255 OID 446554)
-- Name: get_personalized_recommendations_v3(uuid, uuid, text, uuid, integer, boolean, numeric, numeric, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid DEFAULT NULL::uuid, p_section text DEFAULT 'discover'::text, p_seed_media_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_exclude_watched boolean DEFAULT true, p_quality_floor_imdb numeric DEFAULT 6.5, p_quality_floor_rt numeric DEFAULT 60.0, p_runtime_preference text DEFAULT 'any'::text, p_context jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(media_item_id uuid, score numeric, match_reason text, is_exploration boolean, diversity_rank integer, media_data jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'extensions'
    AS $$
DECLARE
  v_user_vector extensions.vector(1024);
  v_session_vector extensions.vector(1024);
  v_seed_vector extensions.vector(1024);

  v_seed_kind public.media_kind;
  v_current_hour integer;
  v_mmr_lambda numeric := 0.7;

  v_provider text;
  v_model text;
  v_dims int;
  v_task text;

  v_exploration_rate numeric := 0.15;

  w_user numeric := 0;
  w_session numeric := 0;
  w_seed numeric := 0;
  w_sum numeric := 0;
BEGIN
  -- Authorization: caller can only request their own recommendations
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Active embedding profile
  SELECT active_provider, active_model, active_dimensions, active_task
  INTO v_provider, v_model, v_dims, v_task
  FROM public.embedding_settings
  WHERE id = 1;

  IF v_provider IS NULL THEN
    v_provider := 'voyage';
    v_model := 'voyage-3-large';
    v_dims := 1024;
    v_task := 'swipe';
  END IF;

  IF v_dims IS DISTINCT FROM 1024 THEN
    RAISE EXCEPTION 'Unsupported embedding dimension %, expected 1024', v_dims;
  END IF;

  v_current_hour := EXTRACT(HOUR FROM NOW());

  -- Context-aware exploration rate
  v_exploration_rate := public.thompson_sample_exploration_rate(p_section, COALESCE(p_context, '{}'::jsonb));

  -- User vector (active profile)
  SELECT taste INTO v_user_vector
  FROM public.media_user_vectors
  WHERE user_id = p_user_id
    AND provider=v_provider AND model=v_model AND dimensions=v_dims AND task=v_task
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Session vector (active profile)
  SELECT taste INTO v_session_vector
  FROM public.media_session_vectors
  WHERE user_id = p_user_id
    AND (p_session_id IS NULL OR session_id = p_session_id)
    AND provider=v_provider AND model=v_model AND dimensions=v_dims AND task=v_task
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Seed embedding (active profile)
  IF p_seed_media_id IS NOT NULL THEN
    SELECT me.embedding, mi.kind
    INTO v_seed_vector, v_seed_kind
    FROM public.media_embeddings me
    JOIN public.media_items mi ON mi.id = me.media_item_id
    WHERE me.media_item_id = p_seed_media_id
      AND me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
    LIMIT 1;
  END IF;

  -- Dynamic weights for vector blending
  IF v_user_vector IS NOT NULL THEN w_user := 0.60; END IF;
  IF v_session_vector IS NOT NULL THEN w_session := 0.40; END IF;
  IF v_seed_vector IS NOT NULL THEN w_seed := 0.50; END IF;

  IF v_user_vector IS NOT NULL AND v_seed_vector IS NOT NULL THEN
    w_user := 0.45;
    w_seed := 0.30;
    w_session := CASE WHEN v_session_vector IS NOT NULL THEN 0.25 ELSE 0 END;
  END IF;

  w_sum := w_user + w_session + w_seed;
  IF w_sum > 0 THEN
    w_user := w_user / w_sum;
    w_session := w_session / w_sum;
    w_seed := w_seed / w_sum;
  END IF;

  -- ===============================================================
  -- SECTION: CONTINUE WATCHING
  -- ===============================================================
  IF p_section = 'continue' THEN
    RETURN QUERY
    WITH watching AS (
      SELECT le.title_id AS media_item_id, le.updated_at
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'watching'::public.library_status
      ORDER BY le.updated_at DESC
      LIMIT p_limit
    )
    SELECT
      w.media_item_id,
      (100 - ROW_NUMBER() OVER (ORDER BY w.updated_at DESC))::numeric AS score,
      'Continue watching'::text AS match_reason,
      false AS is_exploration,
      ROW_NUMBER() OVER (ORDER BY w.updated_at DESC)::integer AS diversity_rank,
      jsonb_build_object(
        'id', mi.id,
        'kind', mi.kind,
        'title', COALESCE(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'year', COALESCE(
          EXTRACT(YEAR FROM mi.tmdb_release_date),
          EXTRACT(YEAR FROM mi.tmdb_first_air_date),
          mi.omdb_year::integer
        ),
        'poster', COALESCE(mi.tmdb_poster_path, mi.omdb_poster),
        'backdrop', mi.tmdb_backdrop_path,
        'imdb_rating', mi.omdb_imdb_rating,
        'rt_rating', mi.omdb_rating_rotten_tomatoes,
        'runtime', mi.tmdb_runtime,
        'genres', (
          SELECT jsonb_agg(g.name ORDER BY g.name)
          FROM public.media_genres mg
          JOIN public.genres g ON g.id = mg.genre_id
          WHERE mg.media_item_id = mi.id
        )
      ) AS media_data
    FROM watching w
    JOIN public.media_items mi ON mi.id = w.media_item_id
    ORDER BY w.updated_at DESC;
    RETURN;
  END IF;

  -- Shared exclusions for non-continue sections
  -- (used via inline CTEs below)

  -- ===============================================================
  -- SECTION: TRENDING NOW (72h)
  -- ===============================================================
  IF p_section = 'trending' THEN
    RETURN QUERY
    WITH
    watched AS (
      SELECT le.title_id AS media_item_id
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'watched'::public.library_status
    ),
    rated AS (
      SELECT r.title_id AS media_item_id
      FROM public.ratings r
      WHERE r.user_id = p_user_id
    ),
    negative_items AS (
      SELECT DISTINCT media_item_id
      FROM public.media_events
      WHERE user_id = p_user_id
        AND event_type IN ('skip'::public.media_event_type, 'dislike'::public.media_event_type)
        AND created_at >= NOW() - INTERVAL '30 days'
      UNION
      SELECT DISTINCT le.title_id
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'dropped'::public.library_status
      UNION
      SELECT DISTINCT r.title_id
      FROM public.ratings r
      WHERE r.user_id = p_user_id
        AND r.rating <= 4.0
    ),
    recently_shown AS (
      SELECT DISTINCT ri.media_item_id
      FROM public.recommendation_impressions ri
      WHERE ri.user_id = p_user_id
        AND ri.section = p_section
        AND ri.created_at >= NOW() - INTERVAL '2 days'
    ),
    scored AS (
      SELECT
        t.media_item_id,
        (
          COALESCE((t.unique_users / 50.0) * 10, 0) +
          COALESCE((t.likes::numeric / GREATEST(t.impressions, 1)) * 20, 0) -
          COALESCE((t.dislikes::numeric / GREATEST(t.impressions, 1)) * 10, 0) +
          COALESCE((t.dwell_ms_sum::numeric / GREATEST(t.dwell_events, 1)) / 10000.0, 0) +
          COALESCE((mi.tmdb_popularity / 100.0) * 2, 0)
        ) AS trend_score,
        (random() < v_exploration_rate) AS is_exploration
      FROM public.media_item_trending_72h t
      JOIN public.media_items mi ON mi.id = t.media_item_id
      WHERE NOT EXISTS (SELECT 1 FROM negative_items ni WHERE ni.media_item_id = t.media_item_id)
        AND (NOT p_exclude_watched OR NOT EXISTS (SELECT 1 FROM watched w WHERE w.media_item_id = t.media_item_id))
        AND NOT EXISTS (SELECT 1 FROM rated rr WHERE rr.media_item_id = t.media_item_id)
        AND NOT EXISTS (SELECT 1 FROM recently_shown rs WHERE rs.media_item_id = t.media_item_id)
        AND (
          (mi.omdb_imdb_rating IS NOT NULL AND mi.omdb_imdb_rating >= p_quality_floor_imdb) OR
          (mi.omdb_rating_rotten_tomatoes IS NOT NULL AND mi.omdb_rating_rotten_tomatoes >= p_quality_floor_rt) OR
          (mi.omdb_imdb_rating IS NULL AND mi.omdb_rating_rotten_tomatoes IS NULL AND COALESCE(mi.tmdb_popularity,0) >= 50)
        )
    )
    SELECT
      s.media_item_id,
      s.trend_score::numeric AS score,
      CASE WHEN s.is_exploration THEN 'Trending (explore)' ELSE 'Trending now' END AS match_reason,
      s.is_exploration,
      ROW_NUMBER() OVER (ORDER BY s.trend_score DESC)::integer AS diversity_rank,
      jsonb_build_object(
        'id', mi.id,
        'kind', mi.kind,
        'title', COALESCE(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'year', COALESCE(
          EXTRACT(YEAR FROM mi.tmdb_release_date),
          EXTRACT(YEAR FROM mi.tmdb_first_air_date),
          mi.omdb_year::integer
        ),
        'poster', COALESCE(mi.tmdb_poster_path, mi.omdb_poster),
        'backdrop', mi.tmdb_backdrop_path,
        'imdb_rating', mi.omdb_imdb_rating,
        'rt_rating', mi.omdb_rating_rotten_tomatoes,
        'runtime', mi.tmdb_runtime,
        'genres', (
          SELECT jsonb_agg(g.name ORDER BY g.name)
          FROM public.media_genres mg
          JOIN public.genres g ON g.id = mg.genre_id
          WHERE mg.media_item_id = mi.id
        )
      ) AS media_data
    FROM scored s
    JOIN public.media_items mi ON mi.id = s.media_item_id
    ORDER BY s.trend_score DESC
    LIMIT p_limit;
    RETURN;
  END IF;

  -- ===============================================================
  -- SECTION: SIMILAR TO (seed item)
  -- ===============================================================
  IF p_section = 'similar_to' THEN
    IF v_seed_vector IS NULL THEN
      -- No seed embedding: return empty set rather than error
      RETURN;
    END IF;

    RETURN QUERY
    WITH
    watched AS (
      SELECT le.title_id AS media_item_id
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'watched'::public.library_status
    ),
    rated AS (
      SELECT r.title_id AS media_item_id
      FROM public.ratings r
      WHERE r.user_id = p_user_id
    ),
    negative_items AS (
      SELECT DISTINCT media_item_id
      FROM public.media_events
      WHERE user_id = p_user_id
        AND event_type IN ('skip'::public.media_event_type, 'dislike'::public.media_event_type)
        AND created_at >= NOW() - INTERVAL '30 days'
      UNION
      SELECT DISTINCT le.title_id
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'dropped'::public.library_status
      UNION
      SELECT DISTINCT r.title_id
      FROM public.ratings r
      WHERE r.user_id = p_user_id
        AND r.rating <= 4.0
    ),
    recently_shown AS (
      SELECT DISTINCT ri.media_item_id
      FROM public.recommendation_impressions ri
      WHERE ri.user_id = p_user_id
        AND ri.section = p_section
        AND ri.created_at >= NOW() - INTERVAL '3 days'
    )
    SELECT
      me.media_item_id,
      (GREATEST(0, 1 - (me.embedding <=> v_seed_vector)) * 100)::numeric AS score,
      'Similar to your selection'::text AS match_reason,
      false AS is_exploration,
      ROW_NUMBER() OVER (ORDER BY me.embedding <=> v_seed_vector)::integer AS diversity_rank,
      jsonb_build_object(
        'id', mi.id,
        'kind', mi.kind,
        'title', COALESCE(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'year', COALESCE(
          EXTRACT(YEAR FROM mi.tmdb_release_date),
          EXTRACT(YEAR FROM mi.tmdb_first_air_date),
          mi.omdb_year::integer
        ),
        'poster', COALESCE(mi.tmdb_poster_path, mi.omdb_poster),
        'backdrop', mi.tmdb_backdrop_path,
        'imdb_rating', mi.omdb_imdb_rating,
        'rt_rating', mi.omdb_rating_rotten_tomatoes,
        'runtime', mi.tmdb_runtime,
        'genres', (
          SELECT jsonb_agg(g.name ORDER BY g.name)
          FROM public.media_genres mg
          JOIN public.genres g ON g.id = mg.genre_id
          WHERE mg.media_item_id = mi.id
        )
      ) AS media_data
    FROM public.media_embeddings me
    JOIN public.media_items mi ON mi.id = me.media_item_id
    WHERE me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
      AND me.media_item_id <> p_seed_media_id
      AND (v_seed_kind IS NULL OR mi.kind = v_seed_kind)
      AND NOT EXISTS (SELECT 1 FROM negative_items ni WHERE ni.media_item_id = me.media_item_id)
      AND (NOT p_exclude_watched OR NOT EXISTS (SELECT 1 FROM watched w WHERE w.media_item_id = me.media_item_id))
      AND NOT EXISTS (SELECT 1 FROM rated rr WHERE rr.media_item_id = me.media_item_id)
      AND NOT EXISTS (SELECT 1 FROM recently_shown rs WHERE rs.media_item_id = me.media_item_id)
      AND (
        (mi.omdb_imdb_rating IS NOT NULL AND mi.omdb_imdb_rating >= p_quality_floor_imdb) OR
        (mi.omdb_rating_rotten_tomatoes IS NOT NULL AND mi.omdb_rating_rotten_tomatoes >= p_quality_floor_rt) OR
        (mi.omdb_imdb_rating IS NULL AND mi.omdb_rating_rotten_tomatoes IS NULL AND COALESCE(mi.tmdb_popularity,0) >= 50)
      )
    ORDER BY me.embedding <=> v_seed_vector
    LIMIT p_limit;
    RETURN;
  END IF;

  -- ===============================================================
  -- SECTION: DISCOVER (personalized)
  -- ===============================================================
  IF p_section = 'discover' THEN
    RETURN QUERY
    WITH
    watched AS (
      SELECT le.title_id AS media_item_id
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'watched'::public.library_status
    ),
    rated AS (
      SELECT r.title_id AS media_item_id
      FROM public.ratings r
      WHERE r.user_id = p_user_id
    ),
    recently_shown AS (
      -- Prevent rapid repeat exposures across sections
      SELECT ri.media_item_id
      FROM public.recommendation_impressions ri
      WHERE ri.user_id = p_user_id
        AND ri.created_at >= NOW() - INTERVAL '5 days'
      GROUP BY ri.media_item_id
      HAVING COUNT(*) >= 1
    ),
    overexposed AS (
      -- Hard cap repeated impressions for the same item
      SELECT ri.media_item_id
      FROM public.recommendation_impressions ri
      WHERE ri.user_id = p_user_id
        AND ri.created_at >= NOW() - INTERVAL '14 days'
      GROUP BY ri.media_item_id
      HAVING COUNT(*) >= 3
    ),
    seen_recent AS (
      -- Items the user already opened/engaged with recently (even if not rated/watched)
      SELECT DISTINCT e.media_item_id
      FROM public.media_events e
      WHERE e.user_id = p_user_id
        AND e.created_at >= NOW() - INTERVAL '30 days'
        AND e.event_type IN (
          'detail_open'::public.media_event_type,
          'dwell'::public.media_event_type,
          'like'::public.media_event_type,
          'watchlist'::public.media_event_type,
          'watchlist_add'::public.media_event_type,
          'rating'::public.media_event_type,
          'rating_set'::public.media_event_type
        )
    ),
    recent_session AS (
      SELECT
        media_item_id,
        event_type,
        created_at,
        ROW_NUMBER() OVER (ORDER BY created_at DESC) as recency_rank
      FROM public.media_events
      WHERE user_id = p_user_id
        AND created_at >= NOW() - INTERVAL '2 hours'
        AND event_type IN (
          'detail_open'::public.media_event_type,
          'dwell'::public.media_event_type,
          'like'::public.media_event_type,
          'watchlist'::public.media_event_type,
          'watchlist_add'::public.media_event_type,
          'rating'::public.media_event_type,
          'rating_set'::public.media_event_type
        )
      ORDER BY created_at DESC
      LIMIT 50
    ),
    session_based_candidates AS (
      SELECT
        me2.media_item_id,
        COUNT(*) as sequence_frequency,
        AVG(EXTRACT(EPOCH FROM (me2.created_at - me1.created_at)) / 60) as avg_time_gap_minutes
      FROM recent_session rs
      JOIN public.media_events me1
        ON me1.media_item_id = rs.media_item_id
       AND me1.event_type IN (
         'detail_open'::public.media_event_type,
         'dwell'::public.media_event_type,
         'like'::public.media_event_type,
         'watchlist'::public.media_event_type,
         'watchlist_add'::public.media_event_type,
         'rating'::public.media_event_type,
         'rating_set'::public.media_event_type
       )
      JOIN public.media_events me2
        ON me2.user_id = me1.user_id
       AND me2.created_at > me1.created_at
       AND me2.created_at <= me1.created_at + INTERVAL '30 minutes'
       AND me2.event_type IN (
         'detail_open'::public.media_event_type,
         'dwell'::public.media_event_type,
         'like'::public.media_event_type,
         'watchlist'::public.media_event_type,
         'watchlist_add'::public.media_event_type,
         'rating'::public.media_event_type,
         'rating_set'::public.media_event_type
       )
      WHERE me2.media_item_id NOT IN (SELECT media_item_id FROM recent_session)
      GROUP BY me2.media_item_id
      HAVING COUNT(*) >= 2
      ORDER BY sequence_frequency DESC, avg_time_gap_minutes ASC
      LIMIT 30
    ),
    friend_activity AS (
      SELECT
        e.media_item_id,
        COUNT(DISTINCT e.user_id) as friend_count,
        MAX(e.created_at) as last_friend_activity,
        ARRAY_AGG(p.username ORDER BY e.created_at DESC) FILTER (WHERE p.username IS NOT NULL) as friend_usernames
      FROM public.follows f
      JOIN public.media_events e ON e.user_id = f.followed_id
      LEFT JOIN public.profiles p ON p.id = e.user_id
      WHERE f.follower_id = p_user_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.blocked_users bu
          WHERE (bu.blocker_id = p_user_id AND bu.blocked_id = f.followed_id)
             OR (bu.blocker_id = f.followed_id AND bu.blocked_id = p_user_id)
        )
        AND e.created_at >= NOW() - INTERVAL '7 days'
        AND e.event_type IN (
          'like'::public.media_event_type,
          'watchlist'::public.media_event_type,
          'watchlist_add'::public.media_event_type,
          'rating'::public.media_event_type,
          'rating_set'::public.media_event_type
        )
      GROUP BY e.media_item_id
      HAVING COUNT(DISTINCT e.user_id) >= 2
      ORDER BY friend_count DESC, last_friend_activity DESC
      LIMIT 30
    ),
    user_genres AS (
      SELECT
        g.id as genre_id,
        g.name as genre_name,
        COUNT(*) AS genre_count,
        AVG(r.rating * EXP(-0.693 * EXTRACT(EPOCH FROM (NOW() - r.created_at)) / (6 * 30 * 24 * 3600))) as weighted_rating
      FROM public.ratings r
      JOIN public.media_genres mg ON mg.media_item_id = r.title_id
      JOIN public.genres g ON g.id = mg.genre_id
      WHERE r.user_id = p_user_id
      GROUP BY g.id, g.name
      HAVING AVG(r.rating) >= 7.0
      ORDER BY weighted_rating DESC
      LIMIT 5
    ),
    user_cluster_items AS (
      SELECT
        x.media_item_id,
        MAX(x.centroid_similarity) AS centroid_similarity
      FROM public.media_user_centroids uc
      CROSS JOIN LATERAL (
        SELECT
          me.media_item_id,
          GREATEST(0, 1 - (me.embedding <=> uc.taste)) as centroid_similarity
        FROM public.media_embeddings me
        WHERE me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
        ORDER BY me.embedding <=> uc.taste
        LIMIT 30
      ) x
      WHERE uc.user_id = p_user_id
        AND uc.provider=v_provider AND uc.model=v_model AND uc.dimensions=v_dims AND uc.task=v_task
      GROUP BY x.media_item_id
      ORDER BY centroid_similarity DESC
      LIMIT 50
    ),
    vector_user AS (
      SELECT me.media_item_id, GREATEST(0, 1 - (me.embedding <=> v_user_vector)) AS sim, 'user'::text AS src
      FROM public.media_embeddings me
      WHERE v_user_vector IS NOT NULL
        AND me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
      ORDER BY me.embedding <=> v_user_vector
      LIMIT 180
    ),
    vector_session AS (
      SELECT me.media_item_id, GREATEST(0, 1 - (me.embedding <=> v_session_vector)) AS sim, 'session'::text AS src
      FROM public.media_embeddings me
      WHERE v_session_vector IS NOT NULL
        AND me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
      ORDER BY me.embedding <=> v_session_vector
      LIMIT 120
    ),
    vector_seed AS (
      SELECT me.media_item_id, GREATEST(0, 1 - (me.embedding <=> v_seed_vector)) AS sim, 'seed'::text AS src
      FROM public.media_embeddings me
      WHERE v_seed_vector IS NOT NULL
        AND me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
      ORDER BY me.embedding <=> v_seed_vector
      LIMIT 140
    ),
    vector_raw AS (
      SELECT * FROM vector_user
      UNION ALL
      SELECT * FROM vector_session
      UNION ALL
      SELECT * FROM vector_seed
    ),
    vector_candidates AS (
      SELECT
        media_item_id,
        MAX(CASE WHEN src='user' THEN sim END)    AS sim_user,
        MAX(CASE WHEN src='session' THEN sim END) AS sim_session,
        MAX(CASE WHEN src='seed' THEN sim END)    AS sim_seed
      FROM vector_raw
      GROUP BY media_item_id
    ),
    vector_candidates_scored AS (
      SELECT
        vc.media_item_id,
        (COALESCE(vc.sim_user, 0) * w_user) +
        (COALESCE(vc.sim_session, 0) * w_session) +
        (COALESCE(vc.sim_seed, 0) * w_seed) AS vector_score
      FROM vector_candidates vc
      WHERE (w_user + w_session + w_seed) > 0
      ORDER BY vector_score DESC
      LIMIT 140
    ),
    similar_users AS (
      SELECT
        r2.user_id,
        MAX(r2.created_at) as last_overlap
      FROM public.ratings r1
      JOIN public.ratings r2 ON r2.title_id = r1.title_id
      WHERE r1.user_id = p_user_id
        AND r2.user_id <> p_user_id
        AND ABS(r1.rating - r2.rating) <= 1.0
      GROUP BY r2.user_id
      ORDER BY last_overlap DESC
      LIMIT 20
    ),
    collab_candidates AS (
      SELECT
        r.title_id as media_item_id,
        AVG(r.rating * EXP(-0.693 * EXTRACT(EPOCH FROM (NOW() - r.created_at)) / (3 * 30 * 24 * 3600))) as weighted_avg_rating,
        COUNT(*) as similar_user_count
      FROM public.ratings r
      JOIN similar_users su ON su.user_id = r.user_id
      WHERE r.title_id NOT IN (SELECT media_item_id FROM rated)
      GROUP BY r.title_id
      HAVING AVG(r.rating) >= 7.0 AND COUNT(*) >= 2
      ORDER BY weighted_avg_rating DESC
      LIMIT 50
    ),
    negative_items AS (
      SELECT DISTINCT media_item_id
      FROM public.media_events
      WHERE user_id = p_user_id
        AND event_type IN ('skip'::public.media_event_type, 'dislike'::public.media_event_type)
        AND created_at >= NOW() - INTERVAL '30 days'
      UNION
      SELECT DISTINCT le.title_id
      FROM public.library_entries le
      WHERE le.user_id = p_user_id
        AND le.status = 'dropped'::public.library_status
      UNION
      SELECT DISTINCT r.title_id
      FROM public.ratings r
      WHERE r.user_id = p_user_id
        AND r.rating <= 4.0
    ),
    popular_candidates AS (
      SELECT
        mi.id AS media_item_id,
        COALESCE(mi.tmdb_popularity, 0) AS popularity
      FROM public.media_items mi
      ORDER BY mi.tmdb_popularity DESC NULLS LAST
      LIMIT 200
    ),
    combined_scores AS (
      SELECT
        COALESCE(vcs.media_item_id, cc.media_item_id, uci.media_item_id, sbc.media_item_id, fa.media_item_id, t.media_item_id, pc.media_item_id) AS media_item_id,
        (
          COALESCE(vcs.vector_score * 25, 0) +
          COALESCE((sbc.sequence_frequency / 10.0) * 20, 0) +
          COALESCE((cc.weighted_avg_rating / 10.0) * 15, 0) +
          COALESCE((fa.friend_count / 5.0) * 15, 0) +
          COALESCE(uci.centroid_similarity * 100, 0) +
          COALESCE((t.trend_score / 100.0) * 6, 0) +
          COALESCE((pc.popularity / 100.0) * 4, 0) +
          COALESCE(
            (SELECT COUNT(*) * 3
             FROM user_genres ug
             JOIN public.media_genres mg ON mg.genre_id = ug.genre_id
             WHERE mg.media_item_id = COALESCE(vcs.media_item_id, cc.media_item_id, uci.media_item_id, sbc.media_item_id, fa.media_item_id, t.media_item_id, pc.media_item_id)
            ), 0
          )
        ) AS base_score,
        CASE
          WHEN sbc.sequence_frequency >= 5 THEN 'Frequently viewed after your recent activity'
          WHEN fa.friend_count >= 3 THEN 'Popular among friends you follow'
          WHEN vcs.vector_score > 0.72 THEN 'Matches your taste profile'
          WHEN cc.similar_user_count >= 3 THEN 'Loved by users with similar taste'
          WHEN uci.centroid_similarity > 0.12 THEN 'Recommended based on your viewing clusters'
          WHEN pc.popularity IS NOT NULL THEN 'Popular right now'
          ELSE 'Recommended for you'
        END AS reason,
        fa.friend_usernames,
        RANDOM() AS random_val
      FROM vector_candidates_scored vcs
      FULL OUTER JOIN collab_candidates cc ON cc.media_item_id = vcs.media_item_id
      FULL OUTER JOIN user_cluster_items uci ON uci.media_item_id = COALESCE(vcs.media_item_id, cc.media_item_id)
      FULL OUTER JOIN session_based_candidates sbc ON sbc.media_item_id = COALESCE(vcs.media_item_id, cc.media_item_id, uci.media_item_id)
      FULL OUTER JOIN friend_activity fa ON fa.media_item_id = COALESCE(vcs.media_item_id, cc.media_item_id, uci.media_item_id, sbc.media_item_id)
      FULL OUTER JOIN public.media_item_trending_72h t ON t.media_item_id = COALESCE(vcs.media_item_id, cc.media_item_id, uci.media_item_id, sbc.media_item_id, fa.media_item_id)
      FULL OUTER JOIN popular_candidates pc ON pc.media_item_id = COALESCE(vcs.media_item_id, cc.media_item_id, uci.media_item_id, sbc.media_item_id, fa.media_item_id, t.media_item_id)
    ),
    filtered_candidates AS (
      SELECT
        cs.media_item_id,
        cs.base_score +
        CASE
          WHEN mi.tmdb_release_date >= (CURRENT_DATE - INTERVAL '90 days') THEN cs.base_score * 0.15
          WHEN mi.tmdb_first_air_date >= (CURRENT_DATE - INTERVAL '90 days') THEN cs.base_score * 0.15
          ELSE 0
        END +
        COALESCE(mi.omdb_imdb_rating, 0) * 0.3 +
        COALESCE(mi.omdb_rating_rotten_tomatoes / 10.0, 0) * 0.2 +
        CASE
          WHEN cs.random_val < v_exploration_rate THEN 5
          ELSE 0
        END +
        CASE
          WHEN v_current_hour BETWEEN 6 AND 12 AND mi.tmdb_runtime <= 120 THEN 5
          WHEN v_current_hour BETWEEN 18 AND 23 THEN 3
          ELSE 0
        END AS final_score,
        cs.reason,
        cs.friend_usernames,
        (cs.random_val < v_exploration_rate) AS is_exploration,
        me.embedding,
        (
          SELECT g.name
          FROM public.media_genres mg
          JOIN public.genres g ON g.id = mg.genre_id
          WHERE mg.media_item_id = mi.id
          ORDER BY g.name
          LIMIT 1
        ) AS primary_genre
      FROM combined_scores cs
      JOIN public.media_items mi ON mi.id = cs.media_item_id
      LEFT JOIN public.media_embeddings me
        ON me.media_item_id = mi.id
       AND me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
      WHERE cs.base_score > 0
        AND NOT EXISTS (SELECT 1 FROM negative_items ni WHERE ni.media_item_id = cs.media_item_id)
        AND (NOT p_exclude_watched OR NOT EXISTS (SELECT 1 FROM watched w WHERE w.media_item_id = cs.media_item_id))
        AND NOT EXISTS (SELECT 1 FROM rated rr WHERE rr.media_item_id = cs.media_item_id)
        AND NOT EXISTS (SELECT 1 FROM recently_shown rs WHERE rs.media_item_id = cs.media_item_id)
        AND NOT EXISTS (SELECT 1 FROM overexposed ox WHERE ox.media_item_id = cs.media_item_id)
        AND NOT EXISTS (SELECT 1 FROM seen_recent sr WHERE sr.media_item_id = cs.media_item_id)
        AND (
          (mi.omdb_imdb_rating IS NOT NULL AND mi.omdb_imdb_rating >= p_quality_floor_imdb) OR
          (mi.omdb_rating_rotten_tomatoes IS NOT NULL AND mi.omdb_rating_rotten_tomatoes >= p_quality_floor_rt) OR
          (mi.omdb_imdb_rating IS NULL AND mi.omdb_rating_rotten_tomatoes IS NULL AND cs.base_score >= 20)
        )
        AND (
          p_runtime_preference = 'any' OR
          (p_runtime_preference = 'quick' AND mi.tmdb_runtime <= 90) OR
          (p_runtime_preference = 'marathon' AND (mi.kind = 'series' OR mi.tmdb_runtime >= 120))
        )
      ORDER BY final_score DESC
      LIMIT p_limit * 4
    ),
    candidate_pool AS (
      SELECT
        media_item_id,
        final_score,
        reason,
        friend_usernames,
        is_exploration,
        embedding,
        primary_genre
      FROM filtered_candidates
      ORDER BY final_score DESC
      LIMIT 250
    ),
    mmr_seed AS (
      SELECT
        ARRAY[cp.media_item_id]::uuid[] AS selected_ids,
        cp.media_item_id,
        cp.final_score,
        cp.reason,
        cp.friend_usernames,
        cp.is_exploration,
        cp.embedding,
        cp.primary_genre,
        cp.final_score::numeric AS mmr_score,
        1 AS mmr_rank
      FROM candidate_pool cp
      ORDER BY cp.final_score DESC
      LIMIT 1
    ),
    mmr_recursive AS (
      SELECT * FROM mmr_seed
      UNION ALL
      SELECT
        r.selected_ids || c.media_item_id,
        c.media_item_id,
        c.final_score,
        c.reason,
        c.friend_usernames,
        c.is_exploration,
        c.embedding,
        c.primary_genre,
        c.mmr_obj::numeric AS mmr_score,
        r.mmr_rank + 1 AS mmr_rank
      FROM mmr_recursive r
      JOIN LATERAL (
        SELECT
          cp.*,
          (
            v_mmr_lambda * cp.final_score -
            (1 - v_mmr_lambda) * COALESCE((
              SELECT MAX(1 - (cp.embedding <=> cp2.embedding))
              FROM candidate_pool cp2
              WHERE cp2.media_item_id = ANY(r.selected_ids)
                AND cp.embedding IS NOT NULL
                AND cp2.embedding IS NOT NULL
            ), 0)
          ) AS mmr_obj
        FROM candidate_pool cp
        WHERE NOT (cp.media_item_id = ANY(r.selected_ids))
        ORDER BY mmr_obj DESC
        LIMIT 1
      ) c ON TRUE
      WHERE r.mmr_rank < LEAST(p_limit, 40)
    ),
    mmr_results AS (
      SELECT
        media_item_id,
        final_score,
        mmr_score,
        reason,
        friend_usernames,
        is_exploration,
        primary_genre,
        mmr_rank
      FROM mmr_recursive
    ),
    genre_interleave AS (
      SELECT
        mr.media_item_id,
        mr.mmr_score,
        mr.reason,
        mr.friend_usernames,
        mr.is_exploration,
        mr.mmr_rank,
        ROW_NUMBER() OVER (PARTITION BY mr.primary_genre ORDER BY mr.mmr_rank) AS genre_rank
      FROM mmr_results mr
    )
    SELECT
      gi.media_item_id,
      gi.mmr_score::numeric AS score,
      CASE
        WHEN gi.friend_usernames IS NOT NULL AND array_length(gi.friend_usernames, 1) > 0
          THEN gi.reason || ' (' || array_to_string(gi.friend_usernames[1:2], ', ') || ')'
        WHEN gi.is_exploration THEN 'Exploring new territory for you'
        ELSE gi.reason
      END AS match_reason,
      gi.is_exploration,
      ROW_NUMBER() OVER (ORDER BY gi.genre_rank ASC, gi.mmr_rank ASC)::integer AS diversity_rank,
      jsonb_build_object(
        'id', mi.id,
        'kind', mi.kind,
        'title', COALESCE(mi.tmdb_title, mi.tmdb_name, mi.omdb_title),
        'year', COALESCE(
          EXTRACT(YEAR FROM mi.tmdb_release_date),
          EXTRACT(YEAR FROM mi.tmdb_first_air_date),
          mi.omdb_year::integer
        ),
        'poster', COALESCE(mi.tmdb_poster_path, mi.omdb_poster),
        'backdrop', mi.tmdb_backdrop_path,
        'imdb_rating', mi.omdb_imdb_rating,
        'rt_rating', mi.omdb_rating_rotten_tomatoes,
        'runtime', mi.tmdb_runtime,
        'genres', (
          SELECT jsonb_agg(g.name ORDER BY g.name)
          FROM public.media_genres mg
          JOIN public.genres g ON g.id = mg.genre_id
          WHERE mg.media_item_id = mi.id
        )
      ) AS media_data
    FROM genre_interleave gi
    JOIN public.media_items mi ON mi.id = gi.media_item_id
    ORDER BY gi.genre_rank ASC, gi.mmr_rank ASC
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Unknown section: empty result (client should handle)
  RETURN;
END;
$$;


ALTER FUNCTION public.get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb) OWNER TO postgres;

--
-- TOC entry 6023 (class 0 OID 0)
-- Dependencies: 744
-- Name: FUNCTION get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb) IS 'Production-grade recommendation engine V3 with cutting-edge features:
- Real-time session-based sequential recommendations
- Graph-based social recommendations (friend activity)
- Thompson Sampling for dynamic exploration
- MMR (Maximal Marginal Relevance) for diversity
- Context-aware filtering (time of day, runtime preferences)
- Temporal decay for all signals
- Negative feedback integration
- Quality filtering and recency boost
Performance: <150ms p50, <300ms p95 with materialized views.';


--
-- TOC entry 518 (class 1255 OID 446624)
-- Name: get_recommendation_ctr(text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_recommendation_ctr(p_section text, p_context jsonb DEFAULT '{}'::jsonb, p_days integer DEFAULT 7) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_impressions integer;
  v_clicks integer;
BEGIN
  SELECT 
    COUNT(DISTINCT ri.id),
    COUNT(DISTINCT CASE WHEN rint.interaction_type = 'click' THEN rint.id END)
  INTO v_impressions, v_clicks
  FROM public.recommendation_impressions ri
  LEFT JOIN public.recommendation_interactions rint ON rint.impression_id = ri.id
  WHERE ri.section = p_section
    AND ri.context_features @> COALESCE(p_context, '{}'::jsonb)
    AND ri.created_at >= NOW() - (p_days || ' days')::interval;
  
  IF v_impressions = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN v_clicks::numeric / v_impressions::numeric;
END;
$$;


ALTER FUNCTION public.get_recommendation_ctr(p_section text, p_context jsonb, p_days integer) OWNER TO postgres;

--
-- TOC entry 536 (class 1255 OID 445552)
-- Name: handle_auth_user_updated(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_auth_user_updated() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if (old.email <> new.email) or (old.email is null and new.email is not null) then
    update public.profiles
    set email = new.email,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.handle_auth_user_updated() OWNER TO postgres;

--
-- TOC entry 804 (class 1255 OID 19184)
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  base_username  text;
  final_username text;
begin
  -- Take the part before @ as a base username (or "user" fallback)
  base_username := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');

  -- Make it unique-ish by appending first 8 chars of the user id
  final_username := base_username || '_' || substr(new.id::text, 1, 8);

  -- Insert or update profile for this user
  insert into public.profiles (user_id, username, display_name, email)
  values (new.id, final_username, base_username, new.email)
  on conflict (user_id) do update
    set username     = excluded.username,
        display_name = excluded.display_name,
        email        = excluded.email;

  return new;
end;
$$;


ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;

--
-- TOC entry 650 (class 1255 OID 20284)
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  base_username  text;
  final_username text;
begin
  base_username := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
  final_username := base_username || '_' || substr(new.id::text, 1, 8);

  insert into public.profiles (id, username, display_name, email)
  values (new.id, final_username, base_username, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  -- These rows are REQUIRED for RLS visibility via profiles_public policies.
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_swipe_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- TOC entry 750 (class 1255 OID 457249)
-- Name: increment_recommendation_impressions_performance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_recommendation_impressions_performance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.recommendation_performance (
    section,
    context_features,
    impressions,
    clicks,
    watches,
    positive_ratings,
    total_watch_time_seconds
  )
  VALUES (
    NEW.section,
    COALESCE(NEW.context_features, '{}'::jsonb),
    1, 0, 0, 0, 0
  )
  ON CONFLICT (section, context_features) DO UPDATE
  SET
    impressions = public.recommendation_performance.impressions + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.increment_recommendation_impressions_performance() OWNER TO postgres;

--
-- TOC entry 623 (class 1255 OID 137966)
-- Name: invoke_media_backfill_daily(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invoke_media_backfill_daily() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'net'
    AS $$
declare
  project_url text;
  anon_key text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'anon_key';

  request_id := net.http_post(
    url := project_url || '/functions/v1/media-smart-backfill',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'limit', 1000,
      'concurrency', 6,
      'only_needed', true,
      'use_cache', true,
      'include_omdb', true,
      'dedupe_scan', true,
      'delete_duplicates', true,
      'attach_imdb_from_tmdb', true,
      'no_api', false,
      'force_cache_fill', false,
      'refresh_cache', false,
      'request_delay_ms', 200
    ),
    timeout_milliseconds := 120000
  );

  return request_id;
end;
$$;


ALTER FUNCTION public.invoke_media_backfill_daily() OWNER TO postgres;

--
-- TOC entry 819 (class 1255 OID 147914)
-- Name: invoke_media_embed_backfill_edge_with_anon_key(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invoke_media_embed_backfill_edge_with_anon_key() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'net', 'vault'
    AS $$
declare
  v_project_url text;
  v_anon_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into v_anon_key
  from vault.decrypted_secrets
  where name = 'anon_key'
  limit 1;

  if v_project_url is null then
    raise exception 'Vault secret "project_url" is missing';
  end if;

  if v_anon_key is null then
    raise exception 'Vault secret "anon_key" is missing';
  end if;

  -- POST the function
  select net.http_post(
    url := v_project_url || '/functions/v1/media-embed-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'limit', 120,
      'batchSize', 32,
      'completenessMin', 0.70
    )
  ) into v_request_id;

  -- optional: you can inspect v_request_id in net._http_response
end;
$$;


ALTER FUNCTION public.invoke_media_embed_backfill_edge_with_anon_key() OWNER TO postgres;

--
-- TOC entry 534 (class 1255 OID 285568)
-- Name: invoke_media_embed_backfill_voyage_edge_with_anon_key(integer, boolean, text, text, integer, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invoke_media_embed_backfill_voyage_edge_with_anon_key(batch_size integer DEFAULT 32, reembed boolean DEFAULT false, kind text DEFAULT NULL::text, task text DEFAULT 'swipe'::text, dimensions integer DEFAULT 1024, model text DEFAULT 'voyage-3-large'::text, use_saved_cursor boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'net', 'vault', 'cron'
    AS $$
DECLARE
  v_project_url text;
  v_anon_key text;
  v_url text;
  v_headers jsonb;
  v_body jsonb;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'anon_key'
  LIMIT 1;

  IF v_project_url IS NULL OR length(v_project_url) = 0 THEN
    RAISE EXCEPTION 'Vault secret "project_url" not found (or empty)';
  END IF;

  IF v_anon_key IS NULL OR length(v_anon_key) = 0 THEN
    RAISE EXCEPTION 'Vault secret "anon_key" not found (or empty)';
  END IF;

  v_url := rtrim(v_project_url, '/') || '/functions/v1/media-embed-backfill';

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', v_anon_key,
    'Authorization', 'Bearer ' || v_anon_key
  );

  v_body := jsonb_build_object(
    'provider', 'voyage',
    'model', model,
    'dimensions', dimensions,
    'task', task,
    'batchSize', batch_size,
    'reembed', reembed,
    'useSavedCursor', use_saved_cursor,
    'kind', kind
  );

  PERFORM net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_body
  );
END;
$$;


ALTER FUNCTION public.invoke_media_embed_backfill_voyage_edge_with_anon_key(batch_size integer, reembed boolean, kind text, task text, dimensions integer, model text, use_saved_cursor boolean) OWNER TO postgres;

--
-- TOC entry 754 (class 1255 OID 147678)
-- Name: invoke_media_trending_refresh_with_anon_key(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.invoke_media_trending_refresh_with_anon_key() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'net', 'vault'
    AS $$
declare
  v_project_url text;
  v_anon_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into v_anon_key
  from vault.decrypted_secrets
  where name = 'anon_key'
  limit 1;

  if v_project_url is null then
    raise exception 'Missing Vault secret "project_url"';
  end if;

  if v_anon_key is null then
    raise exception 'Missing Vault secret "anon_key"';
  end if;

  v_request_id := net.http_post(
    url := v_project_url || '/functions/v1/media-trending-refresh',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'lookbackDays', 14,
      'halfLifeHours', 72,
      'completenessMin', 0.75
    ),
    timeout_milliseconds := 60000
  );

  return v_request_id;
end;
$$;


ALTER FUNCTION public.invoke_media_trending_refresh_with_anon_key() OWNER TO postgres;

--
-- TOC entry 520 (class 1255 OID 41790)
-- Name: is_blocked(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_blocked(a uuid, b uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.blocked_users bu
    where (bu.blocker_id = a and bu.blocked_id = b)
       or (bu.blocker_id = b and bu.blocked_id = a)
  );
$$;


ALTER FUNCTION public.is_blocked(a uuid, b uuid) OWNER TO postgres;

--
-- TOC entry 505 (class 1255 OID 34350)
-- Name: is_conversation_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_conversation_member(conv_id uuid, uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = conv_id
      and user_id = uid
  );
$$;


ALTER FUNCTION public.is_conversation_member(conv_id uuid, uid uuid) OWNER TO postgres;

--
-- TOC entry 659 (class 1255 OID 41791)
-- Name: is_follower(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_follower(target uuid, candidate uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.follows f
    where f.followed_id = target
      and f.follower_id = candidate
  );
$$;


ALTER FUNCTION public.is_follower(target uuid, candidate uuid) OWNER TO postgres;

--
-- TOC entry 856 (class 1255 OID 41789)
-- Name: is_service_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_service_role() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select auth.role() = 'service_role';
$$;


ALTER FUNCTION public.is_service_role() OWNER TO postgres;

--
-- TOC entry 494 (class 1255 OID 53406)
-- Name: mark_conversation_read(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_last_message_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.message_read_receipts (
    conversation_id, user_id, last_read_message_id, last_read_at
  )
  VALUES (p_conversation_id, auth.uid(), p_last_message_id, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at;
END;
$$;


ALTER FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_last_message_id uuid) OWNER TO postgres;

--
-- TOC entry 569 (class 1255 OID 53407)
-- Name: mark_notifications_read(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_notifications_read() RETURNS void
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND is_read = false;
$$;


ALTER FUNCTION public.mark_notifications_read() OWNER TO postgres;

--
-- TOC entry 609 (class 1255 OID 148238)
-- Name: match_media_embeddings(text, integer, numeric, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_media_embeddings(query_embedding text, match_count integer DEFAULT 600, completeness_min numeric DEFAULT 0.80, kind_filter text DEFAULT NULL::text, year_min integer DEFAULT NULL::integer, year_max integer DEFAULT NULL::integer) RETURNS TABLE(media_item_id uuid, similarity double precision)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  with q as (
    select (query_embedding::vector(1024)) as v
  )
  select
    me.media_item_id,
    1 - (me.embedding <=> q.v) as similarity
  from public.media_embeddings me
  join public.media_items mi on mi.id = me.media_item_id
  cross join q
  where coalesce(mi.completeness, 0) >= completeness_min
    and (kind_filter is null or mi.kind::text = kind_filter)
    and (
      year_min is null
      or coalesce(
          extract(year from coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date))::int,
          year_min
        ) >= year_min
    )
    and (
      year_max is null
      or coalesce(
          extract(year from coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date))::int,
          year_max
        ) <= year_max
    )
  order by me.embedding <=> q.v
  limit match_count;
$$;


ALTER FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, year_min integer, year_max integer) OWNER TO postgres;

--
-- TOC entry 566 (class 1255 OID 457251)
-- Name: match_media_embeddings(text, integer, numeric, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_media_embeddings(query_embedding text, match_count integer DEFAULT 600, completeness_min numeric DEFAULT 0.75, kind_filter text DEFAULT NULL::text, genre_filter text DEFAULT NULL::text, year_min integer DEFAULT NULL::integer, year_max integer DEFAULT NULL::integer) RETURNS TABLE(media_item_id uuid, similarity double precision)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  qv extensions.vector(1024);
  v_provider text;
  v_model text;
  v_dims int;
  v_task text;
BEGIN
  -- Resolve active embedding profile
  SELECT active_provider, active_model, active_dimensions, active_task
  INTO v_provider, v_model, v_dims, v_task
  FROM public.embedding_settings
  WHERE id = 1;

  IF v_dims IS DISTINCT FROM 1024 THEN
    RAISE EXCEPTION 'Unsupported embedding dimension %, expected 1024', v_dims;
  END IF;

  -- Parse input vector defensively
  BEGIN
    qv := (query_embedding::extensions.vector(1024));
  EXCEPTION WHEN others THEN
    -- Bad input: return empty set instead of throwing
    RETURN;
  END;

  RETURN QUERY
  SELECT
    me.media_item_id,
    1 - (me.embedding <=> qv) AS similarity
  FROM public.media_embeddings me
  JOIN public.media_items mi ON mi.id = me.media_item_id
  WHERE me.provider=v_provider AND me.model=v_model AND me.dimensions=v_dims AND me.task=v_task
    AND COALESCE(mi.completeness, 0) >= completeness_min
    AND (kind_filter IS NULL OR mi.kind::text = kind_filter)
    AND (
      genre_filter IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.media_genres mg
        JOIN public.genres g ON g.id = mg.genre_id
        WHERE mg.media_item_id = mi.id
          AND lower(g.name) = lower(genre_filter)
      )
    )
    AND (
      year_min IS NULL
      OR COALESCE(
          EXTRACT(YEAR FROM COALESCE(mi.tmdb_release_date, mi.tmdb_first_air_date))::int,
          year_min
        ) >= year_min
    )
    AND (
      year_max IS NULL
      OR COALESCE(
          EXTRACT(YEAR FROM COALESCE(mi.tmdb_release_date, mi.tmdb_first_air_date))::int,
          year_max
        ) <= year_max
    )
  ORDER BY me.embedding <=> qv
  LIMIT match_count;
END;
$$;


ALTER FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, genre_filter text, year_min integer, year_max integer) OWNER TO postgres;

--
-- TOC entry 622 (class 1255 OID 135426)
-- Name: media_items_ensure_columns(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_items_ensure_columns(flat jsonb) RETURNS TABLE(added_column text, added_type text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  k text;
  v jsonb;
  coltype text;
begin
  if flat is null then
    return;
  end if;

  for k, v in
    select key, value from jsonb_each(flat)
  loop
    if k !~ '^(omdb|tmdb)_[a-z0-9_]{1,60}$' then
      continue;
    end if;

    coltype := case jsonb_typeof(v)
      when 'string'  then 'text'
      when 'number'  then 'numeric'
      when 'boolean' then 'boolean'
      else 'jsonb'
    end;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'media_items'
        and column_name  = k
    ) then
      execute format('alter table public.media_items add column %I %s', k, coltype);
      added_column := k;
      added_type   := coltype;
      return next;
    end if;
  end loop;

  return;
end $_$;


ALTER FUNCTION public.media_items_ensure_columns(flat jsonb) OWNER TO postgres;

--
-- TOC entry 671 (class 1255 OID 141196)
-- Name: media_items_promote_kind(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_items_promote_kind() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.kind is null then
    new.kind := 'other'::public.media_kind;
  end if;

  -- Only promote if we have at least one id (so it won't violate constraints)
  if new.kind = 'other'::public.media_kind
     and (
       new.tmdb_id is not null
       or (new.omdb_imdb_id is not null and new.omdb_imdb_id <> '')
     )
  then
    -- Prefer TMDb
    if new.tmdb_media_type = 'tv' then
      new.kind := 'series'::public.media_kind;
    elsif new.tmdb_media_type = 'movie' then
      new.kind := 'movie'::public.media_kind;

    -- Fall back to OMDb
    elsif new.omdb_type = 'series' then
      new.kind := 'series'::public.media_kind;
    elsif new.omdb_type = 'movie' then
      new.kind := 'movie'::public.media_kind;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.media_items_promote_kind() OWNER TO postgres;

--
-- TOC entry 762 (class 1255 OID 296060)
-- Name: media_refresh_user_centroids_v1(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_refresh_user_centroids_v1(p_user_id uuid DEFAULT auth.uid(), p_k integer DEFAULT 3, p_max_items integer DEFAULT 60) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_provider text;
  v_model text;
  v_dims int;
  v_task text;

  k int := greatest(1, least(5, coalesce(p_k, 3)));
  n int := greatest(5, least(200, coalesce(p_max_items, 60)));

  ex1 uuid;
  ex2 uuid;
  ex3 uuid;
begin
  if p_user_id is null then
    return;
  end if;

  select active_provider, active_model, active_dimensions, active_task
    into v_provider, v_model, v_dims, v_task
  from public.embedding_settings
  where id = 1;

  -- Strong positives (with embeddings) in last 180d, grouped by media_item_id with recency ordering.
  with likes as (
    select
      e.media_item_id,
      max(e.created_at) as last_at
    from public.media_events e
    join public.media_embeddings me
      on me.media_item_id = e.media_item_id
     and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    where e.user_id = p_user_id
      and e.created_at > now() - interval '180 days'
      and (
        e.event_type::text = 'like'
        or (e.event_type::text = 'watchlist' and e.in_watchlist = true)
        or (e.event_type::text = 'rating' and e.rating_0_10 >= 7)
        or (e.event_type::text = 'dwell' and e.dwell_ms >= 12000)
      )
    group by e.media_item_id
    order by last_at desc
    limit n
  )
  select l.media_item_id into ex1
  from likes l
  order by l.last_at desc
  limit 1;

  if ex1 is null then
    delete from public.media_user_centroids
    where user_id=p_user_id and provider=v_provider and model=v_model and dimensions=v_dims and task=v_task;
    return;
  end if;

  -- exemplar 2 = farthest from exemplar 1, within strong positives only
  with likes as (
    select
      e.media_item_id,
      max(e.created_at) as last_at
    from public.media_events e
    join public.media_embeddings me
      on me.media_item_id = e.media_item_id
     and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    where e.user_id = p_user_id
      and e.created_at > now() - interval '180 days'
      and (
        e.event_type::text = 'like'
        or (e.event_type::text = 'watchlist' and e.in_watchlist = true)
        or (e.event_type::text = 'rating' and e.rating_0_10 >= 7)
        or (e.event_type::text = 'dwell' and e.dwell_ms >= 12000)
      )
    group by e.media_item_id
    order by last_at desc
    limit n
  ),
  cand as (
    select l.media_item_id,
           (me.embedding <=> me1.embedding) as d1
    from likes l
    join public.media_embeddings me
      on me.media_item_id=l.media_item_id
     and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    join public.media_embeddings me1
      on me1.media_item_id=ex1
     and me1.provider=v_provider and me1.model=v_model and me1.dimensions=v_dims and me1.task=v_task
    where l.media_item_id <> ex1
    order by d1 desc
    limit 1
  )
  select media_item_id into ex2 from cand;

  if k >= 3 and ex2 is not null then
    -- exemplar 3 = farthest from both (maximize min distance), within strong positives only
    with likes as (
      select
        e.media_item_id,
        max(e.created_at) as last_at
      from public.media_events e
      join public.media_embeddings me
        on me.media_item_id = e.media_item_id
       and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
      where e.user_id = p_user_id
        and e.created_at > now() - interval '180 days'
        and (
          e.event_type::text = 'like'
          or (e.event_type::text = 'watchlist' and e.in_watchlist = true)
          or (e.event_type::text = 'rating' and e.rating_0_10 >= 7)
          or (e.event_type::text = 'dwell' and e.dwell_ms >= 12000)
        )
      group by e.media_item_id
      order by last_at desc
      limit n
    ),
    cand as (
      select l.media_item_id,
             least(
               (me.embedding <=> me1.embedding),
               (me.embedding <=> me2.embedding)
             ) as dmin
      from likes l
      join public.media_embeddings me
        on me.media_item_id=l.media_item_id
       and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
      join public.media_embeddings me1
        on me1.media_item_id=ex1
       and me1.provider=v_provider and me1.model=v_model and me1.dimensions=v_dims and me1.task=v_task
      join public.media_embeddings me2
        on me2.media_item_id=ex2
       and me2.provider=v_provider and me2.model=v_model and me2.dimensions=v_dims and me2.task=v_task
      where l.media_item_id not in (ex1, ex2)
      order by dmin desc
      limit 1
    )
    select media_item_id into ex3 from cand;
  end if;

  -- upsert centroid rows (store exemplar embedding as "taste")
  insert into public.media_user_centroids(user_id, centroid, exemplar_media_item_id, taste, provider, model, dimensions, task, updated_at)
  select p_user_id, 1, ex1, me.embedding, v_provider, v_model, v_dims, v_task, now()
  from public.media_embeddings me
  where me.media_item_id=ex1 and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
  on conflict (user_id, centroid, provider, model, dimensions, task) do update
    set exemplar_media_item_id=excluded.exemplar_media_item_id,
        taste=excluded.taste,
        updated_at=excluded.updated_at;

  if k >= 2 and ex2 is not null then
    insert into public.media_user_centroids(user_id, centroid, exemplar_media_item_id, taste, provider, model, dimensions, task, updated_at)
    select p_user_id, 2, ex2, me.embedding, v_provider, v_model, v_dims, v_task, now()
    from public.media_embeddings me
    where me.media_item_id=ex2 and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    on conflict (user_id, centroid, provider, model, dimensions, task) do update
      set exemplar_media_item_id=excluded.exemplar_media_item_id,
          taste=excluded.taste,
          updated_at=excluded.updated_at;
  end if;

  if k >= 3 and ex3 is not null then
    insert into public.media_user_centroids(user_id, centroid, exemplar_media_item_id, taste, provider, model, dimensions, task, updated_at)
    select p_user_id, 3, ex3, me.embedding, v_provider, v_model, v_dims, v_task, now()
    from public.media_embeddings me
    where me.media_item_id=ex3 and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    on conflict (user_id, centroid, provider, model, dimensions, task) do update
      set exemplar_media_item_id=excluded.exemplar_media_item_id,
          taste=excluded.taste,
          updated_at=excluded.updated_at;
  end if;

  delete from public.media_user_centroids
  where user_id=p_user_id
    and provider=v_provider and model=v_model and dimensions=v_dims and task=v_task
    and centroid > k;
end $$;


ALTER FUNCTION public.media_refresh_user_centroids_v1(p_user_id uuid, p_k integer, p_max_items integer) OWNER TO postgres;

--
-- TOC entry 679 (class 1255 OID 153116)
-- Name: media_swipe_brain_health_v1(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_swipe_brain_health_v1(p_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_user_id uuid;
  v_items bigint;
  v_emb bigint;
  v_user_has boolean;
  v_sess_has boolean;
  v_events_24h bigint;
  v_feedback bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select count(*) into v_items from public.media_items;

  select count(*) into v_emb from public.media_embeddings;

  select exists(
    select 1 from public.media_user_vectors
    where user_id = v_user_id and taste is not null
  ) into v_user_has;

  select exists(
    select 1 from public.media_session_vectors
    where user_id = v_user_id and session_id = p_session_id and taste is not null
  ) into v_sess_has;

  select count(*) into v_events_24h
  from public.media_events
  where user_id = v_user_id and created_at > now() - interval '24 hours';

  select count(*) into v_feedback
  from public.media_feedback
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'session_id', p_session_id,
    'counts', jsonb_build_object(
      'media_items', v_items,
      'media_embeddings', v_emb,
      'media_events_last_24h', v_events_24h,
      'media_feedback_rows', v_feedback
    ),
    'taste', jsonb_build_object(
      'has_user_vector', v_user_has,
      'has_session_vector', v_sess_has
    )
  );
end;
$$;


ALTER FUNCTION public.media_swipe_brain_health_v1(p_session_id uuid) OWNER TO postgres;

--
-- TOC entry 815 (class 1255 OID 295576)
-- Name: media_swipe_deck_v2(uuid, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_swipe_deck_v2(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) RETURNS TABLE(media_item_id uuid, title text, overview text, kind text, release_date date, first_air_date date, omdb_runtime text, poster_path text, backdrop_path text, vote_average numeric, vote_count integer, popularity numeric, completeness numeric, source text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
#variable_conflict use_column

declare
  v_user_id uuid := auth.uid();

  v_provider text;
  v_model text;
  v_dims int;
  v_task text;

  -- vectors
  v_session_vec vector;
  v_user_vec vector;

  v_session_updated timestamptz;
  v_session_age_seconds double precision := 1e9;
  v_session_weight double precision := 0.0; -- session intent weight (decays with age)

  v_limit int := greatest(1, least(120, coalesce(p_limit, 60)));
  v_mode text := lower(coalesce(p_mode, 'for_you'));
  v_kind_filter text := nullif(lower(coalesce(p_kind_filter, '')), '');
  v_seed text := coalesce(nullif(p_seed, ''), gen_random_uuid()::text);

  -- diversity caps
  v_genre_cap int := greatest(2, ceil(v_limit * 0.33)::int);
  v_collection_cap int := 2;

  -- explanation helper
  v_recent_like_id uuid;
  v_recent_like_title text;

  -- LTR weights (renamed from "w" to avoid ambiguity with any SQL column aliases)
  v_weights jsonb;
  v_intercept double precision := 0.0;
begin
  if v_user_id is null then return; end if;

  select active_provider, active_model, active_dimensions, active_task
    into v_provider, v_model, v_dims, v_task
  from public.embedding_settings
  where id = 1;

  -- load active model weights (optional table; if absent, weights remain empty)
  begin
    select m.weights, m.intercept
      into v_weights, v_intercept
    from public.media_rank_models m
    where m.model_name='swipe_deck' and m.is_active=true
    order by m.version desc
    limit 1;
  exception when undefined_table then
    v_weights := '{}'::jsonb;
    v_intercept := 0.0;
  end;

  if v_weights is null then
    v_weights := '{}'::jsonb;
  end if;

  -- session vector (if exists)
  select sv.taste, sv.updated_at
    into v_session_vec, v_session_updated
  from public.media_session_vectors sv
  where sv.user_id=v_user_id
    and sv.session_id=p_session_id
    and sv.provider=v_provider and sv.model=v_model and sv.dimensions=v_dims and sv.task=v_task
  order by sv.updated_at desc
  limit 1;

  if v_session_updated is not null then
    v_session_age_seconds := extract(epoch from (now() - v_session_updated));
    -- session half-life ~45 minutes
    v_session_weight := exp(-v_session_age_seconds / (45*60.0));
  end if;

  -- long-term user vector
  select uv.taste
    into v_user_vec
  from public.media_user_vectors uv
  where uv.user_id=v_user_id
    and uv.provider=v_provider and uv.model=v_model and uv.dimensions=v_dims and uv.task=v_task
  order by uv.updated_at desc
  limit 1;

  -- most recent strong positive for explanation
  select e.media_item_id
    into v_recent_like_id
  from public.media_events e
  where e.user_id=v_user_id
    and e.created_at > now() - interval '30 days'
    and (
      e.event_type::text='like'
      or (e.event_type::text='watchlist' and e.in_watchlist=true)
      or (e.event_type::text='rating' and e.rating_0_10>=7)
      or (e.event_type::text='dwell' and e.dwell_ms>=12000)
    )
  order by e.created_at desc
  limit 1;

  if v_recent_like_id is not null then
    select coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title)
      into v_recent_like_title
    from public.media_items mi
    where mi.id=v_recent_like_id;
  end if;

  -- Candidate pool temp tables
  create temporary table if not exists _cand (
    media_item_id uuid primary key,
    source text not null,
    raw_score double precision not null,
    norm_score double precision not null,
    novelty double precision not null,
    neg_ema double precision not null,
    friend_sim double precision not null,
    jit double precision not null,
    final_score double precision not null,
    primary_genre text,
    collection_id text,
    embedding vector
  ) on commit drop;
  truncate table _cand;

  create temporary table if not exists _take (
    media_item_id uuid primary key,
    source text not null,
    final_score double precision not null,
    embedding vector,
    primary_genre text,
    collection_id text
  ) on commit drop;
  truncate table _take;

  create temporary table if not exists _picked (
    pos int primary key,
    media_item_id uuid not null,
    source text not null,
    rank_score double precision not null
  ) on commit drop;
  truncate table _picked;

  create temporary table if not exists _genre_counts (
    genre text primary key,
    cnt int not null
  ) on commit drop;
  truncate table _genre_counts;

  create temporary table if not exists _collection_counts (
    collection_id text primary key,
    cnt int not null
  ) on commit drop;
  truncate table _collection_counts;

  -- Fill _cand
  with
  params as (
    select
      v_mode as mode,
      v_kind_filter as kind_filter,
      v_seed as seed,
      (v_user_vec is not null) as has_user_vec,
      (v_session_vec is not null) as has_session_vec
  ),
  blocked as (
    select mf.media_item_id
    from public.media_feedback mf
    where mf.user_id=v_user_id
      and (
        mf.last_action::text='dislike'
        or coalesce(mf.negative_ema,0) >= 0.95
        or (mf.last_impression_at is not null and mf.last_impression_at > now() - interval '6 hours')
      )
  ),
  cents as (
    select centroid, exemplar_media_item_id, taste
    from public.media_user_centroids
    where user_id=v_user_id
      and provider=v_provider and model=v_model and dimensions=v_dims and task=v_task
    order by centroid asc
  ),
  for_you_raw as (
    select
      e.media_item_id,
      max(
        greatest(
          case when v_session_vec is not null then (-(e.embedding <=> v_session_vec)) * v_session_weight else -1e9 end,
          case when v_user_vec is not null then (-(e.embedding <=> v_user_vec)) else -1e9 end,
          coalesce((select max(-(e.embedding <=> c.taste)) from cents c), -1e9)
        )
      ) as raw_score,
      'for_you'::text as source
    from public.media_embeddings e
    join params p on true
    where e.provider=v_provider and e.model=v_model and e.dimensions=v_dims and e.task=v_task
      and (p.has_user_vec or p.has_session_vec or exists(select 1 from cents))
      and not exists (select 1 from blocked b where b.media_item_id=e.media_item_id)
    group by e.media_item_id
    order by raw_score desc
    limit (v_limit * 10)
  ),
  trending_raw as (
    select
      t.media_item_id,
      t.score_72h as raw_score,
      'trending'::text as source
    from public.media_trending_scores t
    where not exists (select 1 from blocked b where b.media_item_id=t.media_item_id)
    order by t.score_72h desc
    limit (v_limit * 8)
  ),
  friend_sims as (
    select
      f.followed_id as friend_id,
      case
        when v_user_vec is null then 1.0
        else (
          select greatest(0.0, -(fv.taste <=> v_user_vec))
          from public.media_user_vectors fv
          where fv.user_id=f.followed_id
            and fv.provider=v_provider and fv.model=v_model and fv.dimensions=v_dims and fv.task=v_task
          limit 1
        )
      end as sim
    from public.follows f
    where f.follower_id=v_user_id
  ),
  friends_raw as (
    select
      e.media_item_id,
      sum(
        fs.sim * (
          case
            when e.event_type::text='like' then 2.0
            when e.event_type::text='watchlist' and e.in_watchlist=true then 1.6
            when e.event_type::text='rating' and e.rating_0_10>=7 then 1.2
            when e.event_type::text='dwell' and e.dwell_ms>=12000 then 0.8
            else 0.0
          end
        )
        * exp(- extract(epoch from (now()-e.created_at)) / (7*24*3600.0))
      ) as raw_score,
      'friends'::text as source
    from public.media_events e
    join friend_sims fs on fs.friend_id=e.user_id
    where e.created_at > now() - interval '45 days'
      and e.event_type::text in ('like','watchlist','rating','dwell')
      and not exists (select 1 from blocked b where b.media_item_id=e.media_item_id)
    group by e.media_item_id
    order by raw_score desc
    limit (v_limit * 8)
  ),
  pool as (
    select * from for_you_raw
    union all select * from trending_raw
    union all select * from friends_raw
  ),
  joined as (
    select
      p.media_item_id,
      p.source,
      p.raw_score,
      mi.kind::text as kind,
      mi.completeness,
      mi.tmdb_belongs_to_collection,
      coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title, 'Untitled') as title,
      coalesce(mi.tmdb_overview, mi.omdb_plot, '') as overview
    from pool p
    join public.media_items mi on mi.id=p.media_item_id
    join params pr on true
    where (pr.kind_filter is null or lower(mi.kind::text)=pr.kind_filter)
      and coalesce(mi.completeness,0) >= 0.70
  ),
  enriched as (
    select
      j.*,
      me.embedding,
      (select min(g.slug)
       from public.media_genres tg
       join public.genres g on g.id=tg.genre_id
       where tg.media_item_id=j.media_item_id
      ) as primary_genre,
      (j.tmdb_belongs_to_collection ->> 'id') as collection_id
    from joined j
    left join public.media_embeddings me
      on me.media_item_id=j.media_item_id
     and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
  ),
  with_feedback as (
    select
      e.*,
      coalesce(mf.impressions_7d,0) as impressions_7d,
      coalesce(mf.negative_ema,0) as negative_ema,
      mf.last_impression_at
    from enriched e
    left join public.media_feedback mf
      on mf.user_id=v_user_id and mf.media_item_id=e.media_item_id
  ),
  normed as (
    select
      wf.*,
      (1.0 - percent_rank() over (partition by wf.source order by wf.raw_score desc)) as norm_score,
      (
        0.12 * ln(1.0 + wf.impressions_7d::double precision)
        + case when wf.last_impression_at is null then 0.0
               when wf.last_impression_at > now() - interval '24 hours' then 0.08
               when wf.last_impression_at > now() - interval '3 days' then 0.04
               else 0.0 end
      ) as novelty
    from with_feedback wf
  ),
  jittered as (
    select
      n.*,
      (
        (((hashtext((select seed from params) || n.media_item_id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0
      ) as jit
    from normed n
  ),
  scored as (
    select
      j.*,
      case when j.source='friends' then j.norm_score else 0.0 end as friend_sim,
      (
        v_intercept
        + (coalesce((v_weights->>'w_relevance')::double precision, 1.0) * j.norm_score)
        + (case j.source
             when 'for_you' then coalesce((v_weights->>'w_source_for_you')::double precision, 0.0)
             when 'trending' then coalesce((v_weights->>'w_source_trending')::double precision, 0.0)
             else coalesce((v_weights->>'w_source_friends')::double precision, 0.0)
           end)
        + (coalesce((v_weights->>'w_novelty')::double precision, -0.25) * j.novelty)
        + (coalesce((v_weights->>'w_neg_ema')::double precision, -0.30) * j.negative_ema)
        + (coalesce((v_weights->>'w_friend_sim')::double precision, 0.10) * (case when j.source='friends' then j.norm_score else 0.0 end))
        + (coalesce((v_weights->>'w_jitter')::double precision, 0.03) * j.jit)
      ) as final_score
    from jittered j
  )

  , deduped as (
    -- Deduplicate by media_item_id BEFORE inserting into _cand.
    -- Without this, INSERT ... ON CONFLICT DO UPDATE can attempt to update the same row twice
    -- when the candidate appears in multiple sources (for_you/trending/friends).
    select distinct on (s.media_item_id)
      s.*
    from scored s
    order by
      s.media_item_id,
      s.final_score desc,
      case s.source
        when 'for_you' then 1
        when 'friends' then 2
        else 3
      end
  )

  insert into _cand(media_item_id, source, raw_score, norm_score, novelty, neg_ema, friend_sim, jit, final_score, primary_genre, collection_id, embedding)
  select
    s.media_item_id,
    s.source,
    s.raw_score,
    s.norm_score,
    s.novelty,
    s.negative_ema,
    s.friend_sim,
    s.jit,
    s.final_score,
    s.primary_genre,
    s.collection_id,
    s.embedding
  from deduped s
  on conflict (media_item_id) do update
    set final_score=excluded.final_score,
        source=excluded.source,
        raw_score=excluded.raw_score,
        norm_score=excluded.norm_score,
        novelty=excluded.novelty,
        neg_ema=excluded.neg_ema,
        friend_sim=excluded.friend_sim,
        jit=excluded.jit,
        primary_genre=excluded.primary_genre,
        collection_id=excluded.collection_id,
        embedding=excluded.embedding;

  -- Quotas (with exploration even for for_you)
  with q as (
    select
      case
        when v_mode='for_you' then ceil(v_limit*0.85)::int
        when v_mode='trending' then 0
        when v_mode='friends' then 0
        when v_mode='combined' then ceil(v_limit*0.60)::int
        else ceil(v_limit*0.60)::int
      end as q_fy,
      case
        when v_mode='for_you' then (v_limit - ceil(v_limit*0.85)::int)
        when v_mode='trending' then v_limit
        when v_mode='friends' then 0
        when v_mode='combined' then ceil(v_limit*0.27)::int
        else ceil(v_limit*0.27)::int
      end as q_tr,
      case
        when v_mode='friends' then v_limit
        when v_mode='combined' then (v_limit - ceil(v_limit*0.60)::int - ceil(v_limit*0.27)::int)
        else 0
      end as q_fr
  ),
  ranked as (
    select c.*, row_number() over (partition by c.source order by c.final_score desc) as rn
    from _cand c
  ),
  take_fy as (
    select * from ranked where source='for_you' and rn <= (select q_fy from q)
  ),
  take_tr as (
    select * from ranked where source='trending' and rn <= (select q_tr from q)
      and media_item_id not in (select media_item_id from take_fy)
  ),
  take_fr as (
    select * from ranked where source='friends' and rn <= (select q_fr from q)
      and media_item_id not in (select media_item_id from take_fy)
      and media_item_id not in (select media_item_id from take_tr)
  ),
  base as (
    select * from take_fy
    union all select * from take_tr
    union all select * from take_fr
  ),
  refill as (
    select r.*
    from ranked r
    where r.media_item_id not in (select media_item_id from base)
    order by r.final_score desc
    limit greatest(0, v_limit - (select count(*) from base))
  ),
  chosen as (
    select * from base
    union all select * from refill
  )
  insert into _take(media_item_id, source, final_score, embedding, primary_genre, collection_id)
  select media_item_id, source, final_score, embedding, primary_genre, collection_id
  from chosen
  on conflict (media_item_id) do nothing;

  -- Diversity selection (genre + collection caps)
  for i in 1..v_limit loop
    with cand as (
      select
        t.*,
        coalesce(gc.cnt, 0) as g_cnt,
        coalesce(cc.cnt, 0) as c_cnt
      from _take t
      left join _genre_counts gc on gc.genre = t.primary_genre
      left join _collection_counts cc on cc.collection_id = t.collection_id
      where t.media_item_id not in (select media_item_id from _picked)
        and (t.primary_genre is null or coalesce(gc.cnt,0) < v_genre_cap)
        and (t.collection_id is null or coalesce(cc.cnt,0) < v_collection_cap)
      order by t.final_score desc
      limit 1
    )
    insert into _picked(pos, media_item_id, source, rank_score)
    select i, media_item_id, source, final_score
    from cand
    on conflict (pos) do nothing;

    if not found then
      exit;
    end if;

    insert into _genre_counts(genre, cnt)
    select t.primary_genre, 1
    from _take t
    join _picked p on p.pos=i and p.media_item_id=t.media_item_id
    where t.primary_genre is not null
    on conflict (genre) do update set cnt=_genre_counts.cnt+1;

    insert into _collection_counts(collection_id, cnt)
    select t.collection_id, 1
    from _take t
    join _picked p on p.pos=i and p.media_item_id=t.media_item_id
    where t.collection_id is not null
    on conflict (collection_id) do update set cnt=_collection_counts.cnt+1;
  end loop;

  -- Persist explanations + rank score (best-effort)
  insert into public.media_feedback(user_id, media_item_id, last_rank_score, last_why, updated_at)
  select
    v_user_id,
    p.media_item_id,
    p.rank_score,
    case p.source
      when 'for_you' then
        case when v_recent_like_title is not null then 'Because you liked ' || v_recent_like_title else 'Picked for you' end
      when 'friends' then 'Popular with friends'
      else 'Trending now'
    end,
    now()
  from _picked p
  on conflict (user_id, media_item_id) do update
    set last_rank_score=excluded.last_rank_score,
        last_why=excluded.last_why,
        updated_at=excluded.updated_at;

  -- Return rows in chosen order
  return query
  select
    mi.id as media_item_id,
    coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title, 'Untitled') as title,
    coalesce(mi.tmdb_overview, mi.omdb_plot, '') as overview,
    mi.kind::text as kind,
    mi.tmdb_release_date as release_date,
    mi.tmdb_first_air_date as first_air_date,
    mi.omdb_runtime,
    mi.tmdb_poster_path as poster_path,
    mi.tmdb_backdrop_path as backdrop_path,
    mi.tmdb_vote_average as vote_average,
    mi.tmdb_vote_count as vote_count,
    mi.tmdb_popularity as popularity,
    mi.completeness,
    p.source
  from _picked p
  join public.media_items mi on mi.id=p.media_item_id
  order by p.pos asc;

end $$;


ALTER FUNCTION public.media_swipe_deck_v2(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) OWNER TO postgres;

--
-- TOC entry 741 (class 1255 OID 316424)
-- Name: media_swipe_deck_v3(uuid, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_swipe_deck_v3(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) RETURNS TABLE(media_item_id uuid, title text, overview text, kind text, release_date date, first_air_date date, omdb_runtime text, poster_path text, backdrop_path text, vote_average numeric, vote_count integer, popularity numeric, completeness numeric, source text, why text, friend_ids uuid[])
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();

  v_provider text;
  v_model text;
  v_dims int;
  v_task text;

  v_mode text := lower(coalesce(p_mode, 'combined'));
  v_kind_filter text := nullif(lower(coalesce(p_kind_filter, '')), '');

  v_limit int := greatest(1, least(120, coalesce(p_limit, 60)));

  -- Seed: allow caller seed; fallback to stable daily seed (user_id + YYYY-MM-DD)
  v_seed text := coalesce(
    nullif(p_seed, ''),
    ('daily:' || v_user_id::text || ':' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD'))
  );

  -- vectors
  v_session_vec vector;
  v_user_vec vector;
  v_has_vec boolean := false;

  -- session recency weight
  v_session_updated timestamptz;
  v_session_age_seconds double precision := 1e9;
  v_session_weight double precision := 0.0;

  -- diversity caps (soft constraints)
  v_genre_cap int := greatest(2, ceil(v_limit * 0.35)::int);
  v_collection_cap int := 2;

  -- why helpers
  v_recent_like_id uuid;
  v_recent_like_title text;

  -- cold-start detection
  v_has_any_events boolean := false;
begin
  if v_user_id is null then
    return;
  end if;

  -- Active embedding profile
  select active_provider, active_model, active_dimensions, active_task
    into v_provider, v_model, v_dims, v_task
  from public.embedding_settings
  where id = 1;

  -- Any events?
  select exists(
    select 1 from public.media_events e
    where e.user_id = v_user_id
    limit 1
  ) into v_has_any_events;

  -- session vector
  select sv.taste, sv.updated_at
    into v_session_vec, v_session_updated
  from public.media_session_vectors sv
  where sv.user_id=v_user_id
    and sv.session_id=p_session_id
    and sv.provider=v_provider and sv.model=v_model and sv.dimensions=v_dims and sv.task=v_task
  order by sv.updated_at desc
  limit 1;

  if v_session_updated is not null then
    v_session_age_seconds := extract(epoch from (now() - v_session_updated));
    -- half-life ~45 minutes
    v_session_weight := exp(-v_session_age_seconds / (45*60.0));
  end if;

  -- user vector
  select uv.taste
    into v_user_vec
  from public.media_user_vectors uv
  where uv.user_id=v_user_id
    and uv.provider=v_provider and uv.model=v_model and uv.dimensions=v_dims and uv.task=v_task
  order by uv.updated_at desc
  limit 1;

  v_has_vec := (v_user_vec is not null) or (v_session_vec is not null)
               or exists(
                 select 1 from public.media_user_centroids c
                 where c.user_id=v_user_id
                   and c.provider=v_provider and c.model=v_model and c.dimensions=v_dims and c.task=v_task
               );

  -- v3.7.1: relaxed "recent positive" for explanations
  select e.media_item_id
    into v_recent_like_id
  from public.media_events e
  where e.user_id=v_user_id
    and e.created_at > now() - interval '30 days'
    and (
      e.event_type::text='like'
      or (e.event_type::text='watchlist' and e.in_watchlist=true)
      or (e.event_type::text='rating' and e.rating_0_10>=7)
      or (e.event_type::text='dwell' and e.dwell_ms>=6000)   -- was 12000
      or (e.event_type::text='detail_open')                  -- NEW
    )
  order by e.created_at desc
  limit 1;

  if v_recent_like_id is not null then
    select coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title)
      into v_recent_like_title
    from public.media_items mi
    where mi.id=v_recent_like_id;
  end if;

  ---------------------------------------------------------------------------
  -- temp tables
  ---------------------------------------------------------------------------
  create temporary table if not exists _cand (
    media_item_id uuid primary key,
    source text not null,
    score double precision not null,
    jit double precision not null,
    final_score double precision not null,
    primary_genre text,
    collection_id text,
    friend_ids uuid[],
    anchor_media_id uuid,
    anchor_title text
  ) on commit drop;
  truncate table _cand;

  create temporary table if not exists _take (
    media_item_id uuid primary key,
    source text not null,
    final_score double precision not null,
    primary_genre text,
    collection_id text,
    friend_ids uuid[],
    anchor_title text
  ) on commit drop;
  truncate table _take;

  create temporary table if not exists _picked (
    pos int primary key,
    media_item_id uuid not null,
    source text not null,
    final_score double precision not null,
    friend_ids uuid[],
    anchor_title text
  ) on commit drop;
  truncate table _picked;

  create temporary table if not exists _seen24h (media_item_id uuid primary key) on commit drop;
  truncate table _seen24h;

  insert into _seen24h(media_item_id)
  select x.media_item_id
  from (
    select mf.media_item_id
    from public.media_feedback mf
    where mf.user_id = v_user_id
      and mf.last_impression_at is not null
      and mf.last_impression_at > now() - interval '24 hours'

    union

    select e.media_item_id
    from public.media_events e
    where e.user_id = v_user_id
      and e.created_at > now() - interval '24 hours'
      and e.event_type in (
        'impression'::public.media_event_type,
        'dwell'::public.media_event_type,
        'skip'::public.media_event_type,
        'detail_open'::public.media_event_type,
        'detail_close'::public.media_event_type,
        'like'::public.media_event_type,
        'dislike'::public.media_event_type
      )
  ) x
  on conflict (media_item_id) do nothing;

  create temporary table if not exists _blocked (media_item_id uuid primary key) on commit drop;
  truncate table _blocked;

  -- block only strong negatives
  insert into _blocked(media_item_id)
  select x.media_item_id
  from (
    select mf.media_item_id
    from public.media_feedback mf
    where mf.user_id = v_user_id
      and (
        mf.last_action::text = 'dislike'
        or coalesce(mf.negative_ema,0) >= 0.95
      )

    union

    select e.media_item_id
    from public.media_events e
    where e.user_id = v_user_id
      and e.created_at > now() - interval '365 days'
      and (
        e.event_type = 'dislike'::public.media_event_type
        or (e.event_type::text='rating' and e.rating_0_10 is not null and e.rating_0_10 <= 3)
      )
  ) x
  on conflict (media_item_id) do nothing;

  create temporary table if not exists _served30m (media_item_id uuid primary key) on commit drop;
  truncate table _served30m;

  insert into _served30m(media_item_id)
  select ms.media_item_id
  from public.media_served ms
  where ms.user_id = v_user_id
    and ms.served_at > now() - interval '30 minutes'
  on conflict (media_item_id) do nothing;

  ---------------------------------------------------------------------------
  -- Candidate construction (v3.7.1)
  ---------------------------------------------------------------------------
  with
  params as (
    select v_mode as mode, v_kind_filter as kind_filter, v_seed as seed, v_has_vec as has_vec
  ),

  cents as (
    select taste
    from public.media_user_centroids c
    where c.user_id=v_user_id
      and c.provider=v_provider and c.model=v_model and c.dimensions=v_dims and c.task=v_task
    order by c.centroid asc
    limit 3
  ),

  -- relaxed POS anchors (adds detail_open + lower dwell threshold)
  pos_anchors as (
    select
      e.media_item_id as anchor_id,
      me.embedding as anchor_emb,
      e.created_at
    from public.media_events e
    join public.media_embeddings me on me.media_item_id = e.media_item_id
    where e.user_id = v_user_id
      and e.created_at > now() - interval '120 days'
      and (
        e.event_type::text='like'
        or (e.event_type::text='watchlist' and e.in_watchlist=true)
        or (e.event_type::text='rating' and e.rating_0_10>=7)
        or (e.event_type::text='dwell' and e.dwell_ms>=6000)   -- was 12000
        or (e.event_type::text='detail_open')                  -- NEW
      )
      and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
      and not exists (select 1 from _blocked b where b.media_item_id = e.media_item_id)
    order by e.created_at desc
    limit 10
  ),

  anchor_neighbors_raw as (
    select
      n.media_item_id,
      n.anchor_id,
      n.sim
    from pos_anchors a
    cross join lateral (
      select
        a.anchor_id,
        me2.media_item_id,
        (1 - (me2.embedding <=> a.anchor_emb))::double precision as sim
      from public.media_embeddings me2
      where me2.provider=v_provider and me2.model=v_model and me2.dimensions=v_dims and me2.task=v_task
        and me2.media_item_id <> a.anchor_id
        and not exists (select 1 from _blocked b where b.media_item_id = me2.media_item_id)
      order by me2.embedding <=> a.anchor_emb
      limit (v_limit * 20)
    ) n
  ),

  anchor_neighbors as (
    select
      r.media_item_id,
      max(r.sim) as score,
      (array_agg(r.anchor_id order by r.sim desc))[1] as best_anchor_id
    from anchor_neighbors_raw r
    group by r.media_item_id
    order by score desc
    limit (v_limit * 60)
  ),

  anchor_neighbors_labeled as (
    select
      an.media_item_id,
      an.score,
      an.best_anchor_id as anchor_media_id,
      coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title) as anchor_title
    from anchor_neighbors an
    left join public.media_items mi on mi.id = an.best_anchor_id
  ),

  -- centroid/session/user fallback (only if anchors empty)
  for_you_centroid as (
    select
      e.media_item_id,
      max(
        greatest(
          case when v_session_vec is not null then (1 - (e.embedding <=> v_session_vec)) * v_session_weight else -1e9 end,
          case when v_user_vec is not null then (1 - (e.embedding <=> v_user_vec)) else -1e9 end,
          coalesce((select max(1 - (e.embedding <=> c.taste)) from cents c), -1e9)
        )
      ) as score
    from public.media_embeddings e, params p
    where p.has_vec
      and e.provider=v_provider and e.model=v_model and e.dimensions=v_dims and e.task=v_task
      and not exists (select 1 from _blocked b where b.media_item_id=e.media_item_id)
    group by e.media_item_id
    order by score desc
    limit (v_limit * 30)
  ),

  -- cold-start for_you (learning): only if user has no events AND no vectors
  for_you_learning as (
    select
      mi.id as media_item_id,
      (
        coalesce(mi.tmdb_popularity,0)::double precision * 0.65
        + coalesce(mi.tmdb_vote_average,0)::double precision * 8.0
        + 0.15 * (
          (((hashtext(v_seed || mi.id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0
        )
      ) as score
    from public.media_items mi
    where (not v_has_any_events)
      and (not v_has_vec)
      and coalesce(mi.completeness,1.0) >= 0.25
      and (v_kind_filter is null or lower(mi.kind::text)=v_kind_filter)
      and mi.id not in (select media_item_id from _blocked)
    order by score desc
    limit (v_limit * 50)
  ),

  -- Trending vs Popular
  trending_recent as (
    select
      t.media_item_id,
      (t.score_72h * exp(-extract(epoch from (now() - t.computed_at)) / (18*3600.0)))::double precision as score
    from public.media_trending_scores t
    join public.media_items mi on mi.id=t.media_item_id
    where not exists (select 1 from _blocked b where b.media_item_id=t.media_item_id)
      and coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date) >= ((now()::date - interval '6 months')::date)
    order by score desc
    limit (v_limit * 30)
  ),

  popular_catalog as (
    select
      t.media_item_id,
      (t.score_72h * exp(-extract(epoch from (now() - t.computed_at)) / (24*3600.0)) * 0.55)::double precision as score
    from public.media_trending_scores t
    join public.media_items mi on mi.id=t.media_item_id
    where not exists (select 1 from _blocked b where b.media_item_id=t.media_item_id)
      and coalesce(mi.tmdb_release_date, mi.tmdb_first_air_date) < ((now()::date - interval '6 months')::date)
    order by score desc
    limit (v_limit * 10)
  ),

  -- Friends
  friend_events as (
    select
      e.media_item_id,
      e.user_id as friend_id,
      e.created_at,
      case
        when e.event_type::text='like' then 2.0
        when e.event_type::text='watchlist' and e.in_watchlist=true then 1.6
        when e.event_type::text='rating' and e.rating_0_10>=7 then 1.2
        when e.event_type::text='dwell' and e.dwell_ms>=6000 then 0.8
        else 0.0
      end as w
    from public.follows f
    join public.media_events e on e.user_id=f.followed_id
    where f.follower_id=v_user_id
      and e.created_at > now() - interval '45 days'
      and e.event_type::text in ('like','watchlist','rating','dwell')
  ),

  friends as (
    select
      fe.media_item_id,
      sum(fe.w * exp(-extract(epoch from (now()-fe.created_at))/(7*24*3600.0)))::double precision as score,
      array_agg(distinct fe.friend_id) as friend_ids
    from friend_events fe
    where fe.w > 0
      and not exists (select 1 from _blocked b where b.media_item_id=fe.media_item_id)
    group by fe.media_item_id
    order by score desc
    limit (v_limit * 30)
  ),

  -- For-you pool (anchors first; centroid fallback if anchors empty; learning fallback if totally cold)
  for_you_pool as (
    select
      anl.media_item_id, anl.score, 'for_you'::text as source,
      null::uuid[] as friend_ids, anl.anchor_media_id, anl.anchor_title
    from anchor_neighbors_labeled anl

    union all

    select
      fy.media_item_id, fy.score, 'for_you'::text as source,
      null::uuid[] as friend_ids, null::uuid, null::text
    from for_you_centroid fy
    where not exists (select 1 from anchor_neighbors_labeled)

    union all

    select
      fyl.media_item_id, fyl.score, 'for_you'::text as source,
      null::uuid[] as friend_ids, null::uuid, null::text
    from for_you_learning fyl
    where not exists (select 1 from anchor_neighbors_labeled)
      and not exists (select 1 from for_you_centroid)
  ),

  pool as (
    select * from for_you_pool
    union all select media_item_id, score, 'trending'::text, null::uuid[], null::uuid, null::text from trending_recent
    union all select media_item_id, score, 'popular'::text,  null::uuid[], null::uuid, null::text from popular_catalog
    union all select media_item_id, score, 'friends'::text,  friend_ids,  null::uuid, null::text from friends
  ),

  joined as (
    select
      p.media_item_id,
      p.score,
      p.source,
      p.friend_ids,
      p.anchor_media_id,
      p.anchor_title,
      mi.kind::text as kind,
      mi.completeness,
      (mi.tmdb_belongs_to_collection ->> 'id') as collection_id,
      (select min(g.slug)
       from public.media_genres tg
       join public.genres g on g.id=tg.genre_id
       where tg.media_item_id = p.media_item_id
      ) as primary_genre
    from pool p
    join public.media_items mi on mi.id=p.media_item_id
    where (v_kind_filter is null or lower(mi.kind::text)=v_kind_filter)
      and coalesce(mi.completeness,1.0) >= 0.20
  ),

  cand_emb as (
    select
      j.*,
      me.embedding as emb
    from joined j
    left join public.media_embeddings me
      on me.media_item_id = j.media_item_id
     and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
  ),

  -- NEGATIVE anchors
  neg_anchors as (
    select
      e.media_item_id as neg_anchor_id,
      me.embedding as neg_anchor_emb
    from public.media_events e
    join public.media_embeddings me on me.media_item_id = e.media_item_id
    where e.user_id = v_user_id
      and e.created_at > now() - interval '180 days'
      and (
        e.event_type = 'dislike'::public.media_event_type
        or (e.event_type::text='rating' and e.rating_0_10 is not null and e.rating_0_10 <= 3)
      )
      and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
    order by e.created_at desc
    limit 12
  ),

  neg_sim as (
    select
      ce.media_item_id,
      max( (1 - (ce.emb <=> na.neg_anchor_emb))::double precision ) as neg_sim_max
    from cand_emb ce
    cross join neg_anchors na
    where ce.emb is not null
    group by ce.media_item_id
  ),

  session_sim as (
    select
      ce.media_item_id,
      (1 - (ce.emb <=> v_session_vec))::double precision as sess_sim
    from cand_emb ce
    where ce.emb is not null
      and v_session_vec is not null
  ),

  with_fb as (
    select
      ce.*,
      coalesce(mf.impressions_7d,0) as impressions_7d,
      coalesce(mf.negative_ema,0) as negative_ema,
      mf.last_impression_at,
      coalesce(ns.neg_sim_max, 0.0) as neg_sim_max,
      coalesce(ss.sess_sim, 0.0) as sess_sim
    from cand_emb ce
    left join public.media_feedback mf
      on mf.user_id=v_user_id and mf.media_item_id=ce.media_item_id
    left join neg_sim ns on ns.media_item_id = ce.media_item_id
    left join session_sim ss on ss.media_item_id = ce.media_item_id
  ),

  normed as (
    select
      wf.*,
      case
        when wf.source='for_you' and (select has_vec from params) then
          greatest(0.0, least(1.0, (wf.score + 1.0) / 2.0))
        else
          (1.0 - percent_rank() over (partition by wf.source order by wf.score desc))
      end as rel,
      (
        0.06 * ln(1.0 + wf.impressions_7d::double precision)
        + case
            when wf.last_impression_at is null then 0.0
            when wf.last_impression_at > now() - interval '24 hours' then 0.05
            when wf.last_impression_at > now() - interval '3 days' then 0.02
            else 0.0
          end
      ) as novelty,
      (
        (((hashtext(v_seed || wf.media_item_id::text))::bigint % 100000 + 100000) % 100000)::double precision / 100000.0
      ) as jit,
      (0.06 * exp(-wf.impressions_7d::double precision / 2.0)) as explore
    from with_fb wf
  ),

  scored as (
    select
      n.*,
      (
        1.12 * n.rel
        + n.explore
        - 0.18 * n.novelty
        - 0.35 * n.negative_ema
        - 0.55 * greatest(0.0, n.neg_sim_max)
        + 0.18 * greatest(0.0, n.sess_sim) * v_session_weight
        + 0.02 * n.jit
        + case n.source
            when 'for_you' then 0.06
            when 'friends' then 0.04 + (0.01 * least(coalesce(cardinality(n.friend_ids),0), 5))
            when 'trending' then 0.03
            when 'popular' then 0.015
            else 0.015
          end
      ) as final_score
    from normed n
    where coalesce(n.neg_sim_max, 0.0) < 0.70
  ),

  deduped as (
    select distinct on (s.media_item_id)
      s.media_item_id,
      s.source,
      s.score,
      s.jit,
      s.final_score,
      s.primary_genre,
      s.collection_id,
      s.friend_ids,
      s.anchor_media_id,
      s.anchor_title
    from scored s
    order by
      s.media_item_id,
      s.final_score desc,
      case s.source when 'for_you' then 1 when 'friends' then 2 when 'trending' then 3 when 'popular' then 4 else 5 end
  )

  insert into _cand(media_item_id, source, score, jit, final_score, primary_genre, collection_id, friend_ids, anchor_media_id, anchor_title)
  select
    d.media_item_id, d.source, d.score, d.jit, d.final_score, d.primary_genre, d.collection_id, d.friend_ids, d.anchor_media_id, d.anchor_title
  from deduped d
  on conflict (media_item_id) do update
    set source=excluded.source,
        score=excluded.score,
        jit=excluded.jit,
        final_score=excluded.final_score,
        primary_genre=excluded.primary_genre,
        collection_id=excluded.collection_id,
        friend_ids=excluded.friend_ids,
        anchor_media_id=excluded.anchor_media_id,
        anchor_title=excluded.anchor_title;

  ---------------------------------------------------------------------------
  -- QUOTAS + seen filtering
  ---------------------------------------------------------------------------
  declare
    q_fy int;
    q_tr int;
    q_fr int;
    need_more int;
  begin
    if v_mode='for_you' then
      q_fy := ceil(v_limit*0.80)::int;
      q_tr := v_limit - q_fy;
      q_fr := 0;
    elsif v_mode='trending' then
      q_fy := 0; q_tr := v_limit; q_fr := 0;
    elsif v_mode='friends' then
      q_fy := 0; q_tr := 0; q_fr := v_limit;
    else
      if v_has_vec then
        q_fy := ceil(v_limit*0.60)::int;
        q_tr := ceil(v_limit*0.25)::int;
        q_fr := v_limit - q_fy - q_tr;
      else
        q_fy := ceil(v_limit*0.50)::int;  -- v3.7.1: push more for_you early
        q_tr := ceil(v_limit*0.30)::int;
        q_fr := v_limit - q_fy - q_tr;
      end if;
    end if;

    with ranked as (
      select c.*,
             row_number() over (partition by c.source order by c.final_score desc) as rn
      from _cand c
      where c.media_item_id not in (select media_item_id from _seen24h)
        and c.media_item_id not in (select media_item_id from _served30m)
    ),
    take1 as (
      select * from ranked where source='for_you' and rn <= q_fy
      union all
      select * from ranked where source in ('trending','popular') and rn <= q_tr
      union all
      select * from ranked where source='friends' and rn <= q_fr
    ),
    base as (
      select distinct on (media_item_id) * from take1
      order by media_item_id, final_score desc
    ),
    refill as (
      select r.*
      from ranked r
      where r.media_item_id not in (select media_item_id from base)
      order by r.final_score desc
      limit greatest(0, v_limit - (select count(*) from base))
    ),
    chosen as (
      select * from base
      union all
      select * from refill
    )
    insert into _take(media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
    select media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title
    from chosen
    on conflict (media_item_id) do update
      set source=excluded.source,
          final_score=excluded.final_score,
          primary_genre=excluded.primary_genre,
          collection_id=excluded.collection_id,
          friend_ids=excluded.friend_ids,
          anchor_title=excluded.anchor_title;

    select greatest(0, v_limit - (select count(*) from _take)) into need_more;
    if need_more > 0 then
      insert into _take(media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
      select c.media_item_id, c.source, c.final_score, c.primary_genre, c.collection_id, c.friend_ids, c.anchor_title
      from _cand c
      where c.media_item_id not in (select media_item_id from _take)
        and c.media_item_id not in (select media_item_id from _served30m)
      order by c.final_score desc
      limit need_more
      on conflict (media_item_id) do nothing;
    end if;

    select greatest(0, v_limit - (select count(*) from _take)) into need_more;
    if need_more > 0 then
      insert into _take(media_item_id, source, final_score, primary_genre, collection_id, friend_ids, anchor_title)
      select c.media_item_id, c.source, c.final_score, c.primary_genre, c.collection_id, c.friend_ids, c.anchor_title
      from _cand c
      where c.media_item_id not in (select media_item_id from _take)
      order by (c.final_score + (0.01 * c.jit)) desc
      limit need_more
      on conflict (media_item_id) do nothing;
    end if;
  end;

  ---------------------------------------------------------------------------
  -- Final diversity-aware picking (genre + collection caps)
  ---------------------------------------------------------------------------
  truncate table _picked;

  with recursive r as (
    select * from (
      select
        1 as pos,
        t.media_item_id,
        t.source,
        t.final_score,
        t.friend_ids,
        t.anchor_title,
        array[t.media_item_id] as picked_ids,
        case when t.primary_genre is null then '{}'::jsonb else jsonb_build_object(t.primary_genre, 1) end as g_counts,
        case when t.collection_id is null then '{}'::jsonb else jsonb_build_object(t.collection_id::text, 1) end as c_counts
      from _take t
      order by t.final_score desc
      limit 1
    ) seed

    union all

    select
      r.pos + 1,
      nxt.media_item_id,
      nxt.source,
      nxt.final_score,
      nxt.friend_ids,
      nxt.anchor_title,
      r.picked_ids || nxt.media_item_id,
      case
        when nxt.primary_genre is null then r.g_counts
        else jsonb_set(
          r.g_counts,
          array[nxt.primary_genre],
          to_jsonb(coalesce((r.g_counts ->> nxt.primary_genre)::int, 0) + 1),
          true
        )
      end as g_counts,
      case
        when nxt.collection_id is null then r.c_counts
        else jsonb_set(
          r.c_counts,
          array[nxt.collection_id::text],
          to_jsonb(coalesce((r.c_counts ->> nxt.collection_id::text)::int, 0) + 1),
          true
        )
      end as c_counts
    from r
    join lateral (
      select *
      from (
        select t2.*, 1 as pri
        from _take t2
        where t2.media_item_id <> all(r.picked_ids)
          and (t2.primary_genre is null or coalesce((r.g_counts ->> t2.primary_genre)::int, 0) < v_genre_cap)
          and (t2.collection_id is null or coalesce((r.c_counts ->> t2.collection_id::text)::int, 0) < v_collection_cap)

        union all

        select t2.*, 2 as pri
        from _take t2
        where t2.media_item_id <> all(r.picked_ids)
      ) q
      order by q.pri asc, q.final_score desc
      limit 1
    ) nxt on true
    where r.pos < v_limit
  )
  insert into _picked(pos, media_item_id, source, final_score, friend_ids, anchor_title)
  select pos, media_item_id, source, final_score, friend_ids, anchor_title
  from r
  on conflict (pos) do nothing;

  ---------------------------------------------------------------------------
  -- Mark served items
  ---------------------------------------------------------------------------
  insert into public.media_served(user_id, media_item_id, served_at)
  select v_user_id, p.media_item_id, now()
  from (select distinct media_item_id from _picked) p
  on conflict (user_id, media_item_id) do update
    set served_at = excluded.served_at;

  ---------------------------------------------------------------------------
  -- Return payload
  ---------------------------------------------------------------------------
  return query
  select
    mi.id as media_item_id,
    coalesce(mi.tmdb_title, mi.tmdb_name, mi.omdb_title, 'Untitled') as title,
    coalesce(mi.tmdb_overview, mi.omdb_plot, '') as overview,
    mi.kind::text as kind,
    mi.tmdb_release_date as release_date,
    mi.tmdb_first_air_date as first_air_date,
    mi.omdb_runtime,
    mi.tmdb_poster_path as poster_path,
    mi.tmdb_backdrop_path as backdrop_path,
    mi.tmdb_vote_average as vote_average,
    mi.tmdb_vote_count as vote_count,
    mi.tmdb_popularity as popularity,
    mi.completeness,
    p.source,
    case p.source
      when 'for_you' then
        case
          when p.anchor_title is not null then 'Matched for you · because you liked ' || p.anchor_title
          when v_recent_like_title is not null then 'Matched for you · because you liked ' || v_recent_like_title
          else 'For you · learning your taste'
        end
      when 'friends' then 'Friends’ picks'
      when 'popular' then 'Popular'
      when 'trending' then 'Trending now'
      else 'Trending now'
    end as why,
    coalesce(p.friend_ids, '{}'::uuid[])
  from _picked p
  join public.media_items mi on mi.id=p.media_item_id
  order by p.pos asc;

end $$;


ALTER FUNCTION public.media_swipe_deck_v3(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) OWNER TO postgres;

--
-- TOC entry 854 (class 1255 OID 429223)
-- Name: media_swipe_deck_v3_typed(uuid, integer, text, text[], integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_swipe_deck_v3_typed(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text[], p_seed integer) RETURNS TABLE(media_item_id uuid, title text, overview text, kind text, release_date date, first_air_date date, omdb_runtime text, poster_path text, backdrop_path text, vote_average numeric, vote_count integer, popularity numeric, completeness numeric, source text, why text, friend_ids uuid[])
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  select *
  from public.media_swipe_deck_v3(
    p_session_id,
    p_limit,
    p_mode,
    case
      when p_kind_filter is null then null
      else array_to_string(p_kind_filter, ',')
    end,
    p_seed::text
  );
$$;


ALTER FUNCTION public.media_swipe_deck_v3_typed(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text[], p_seed integer) OWNER TO postgres;

--
-- TOC entry 820 (class 1255 OID 152801)
-- Name: media_update_taste_vectors_v1(uuid, uuid, public.media_event_type, integer, numeric, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.media_update_taste_vectors_v1(p_session_id uuid, p_media_item_id uuid, p_event_type public.media_event_type, p_dwell_ms integer DEFAULT NULL::integer, p_rating_0_10 numeric DEFAULT NULL::numeric, p_in_watchlist boolean DEFAULT NULL::boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_user_id uuid;
  v_emb extensions.vector(1024);
  v_weight double precision := 0.0;

  v_alpha_session double precision := 0.12; -- faster adaptation
  v_alpha_user double precision := 0.03;    -- slower adaptation

  v_provider text;
  v_model text;
  v_dims int;
  v_task text;

  v_new_session extensions.vector(1024);
  v_new_user extensions.vector(1024);
  v_old_session extensions.vector(1024);
  v_old_user extensions.vector(1024);
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  -- Ignore impressions (noise)
  if p_event_type = 'impression'::public.media_event_type then
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'impression');
  end if;

  -- Load active embedding settings (single-row)
  select active_provider, active_model, active_dimensions, active_task
    into v_provider, v_model, v_dims, v_task
  from public.embedding_settings
  where id = 1;

  -- Map event -> weight (bounded updates)
  if p_event_type = 'like'::public.media_event_type then
    v_weight := 1.0;
  elsif p_event_type = 'dislike'::public.media_event_type then
    v_weight := -1.0;
  elsif p_event_type = 'skip'::public.media_event_type then
    v_weight := -0.25;
  elsif p_event_type in ('watchlist'::public.media_event_type, 'watchlist_add'::public.media_event_type, 'watchlist_remove'::public.media_event_type) then
    -- Support both legacy (watchlist + boolean) and split event types.
    if p_event_type = 'watchlist_remove'::public.media_event_type then
      v_weight := -0.20;
    else
      -- watchlist OR watchlist_add
      if p_in_watchlist is true or p_event_type = 'watchlist_add'::public.media_event_type then v_weight := 0.60; else v_weight := -0.20; end if;
    end if;
  elsif p_event_type in ('rating'::public.media_event_type, 'rating_set'::public.media_event_type) then
    if p_rating_0_10 is null then
      return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'rating_missing');
    end if;
    v_weight := greatest(-1.0, least(1.0, ((p_rating_0_10::double precision - 5.0) / 5.0))) * 0.80;
  elsif p_event_type = 'dwell'::public.media_event_type then
    if p_dwell_ms is null then
      return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'dwell_missing');
    end if;
    if p_dwell_ms >= 20000 then v_weight := 0.50;
    elsif p_dwell_ms >= 12000 then v_weight := 0.35;
    elsif p_dwell_ms >= 5000 then v_weight := 0.20;
    elsif p_dwell_ms >= 2000 then v_weight := 0.10;
    else v_weight := 0.0;
    end if;
  else
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'unsupported_event_for_taste');
  end if;

  if v_weight = 0.0 then
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'zero_weight');
  end if;

  -- Load the item's embedding for the active model/task.
  select me.embedding
    into v_emb
  from public.media_embeddings me
  where me.media_item_id = p_media_item_id
    and me.provider=v_provider and me.model=v_model and me.dimensions=v_dims and me.task=v_task
  order by me.updated_at desc nulls last
  limit 1;

  if v_emb is null then
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'missing_embedding');
  end if;

  -- SESSION vector (active model/task)
  select sv.taste
    into v_old_session
  from public.media_session_vectors sv
  where sv.user_id = v_user_id
    and sv.session_id = p_session_id
    and sv.provider=v_provider and sv.model=v_model and sv.dimensions=v_dims and sv.task=v_task
  limit 1;

  if v_old_session is null then
    v_new_session := extensions.l2_normalize(v_emb * (v_weight::float4));
  else
    v_new_session := extensions.l2_normalize(
      (v_old_session * (1.0 - v_alpha_session)::float4)
      + (v_emb * (v_alpha_session * v_weight)::float4)
    );
  end if;

  insert into public.media_session_vectors (session_id, user_id, taste, updated_at, provider, model, dimensions, task)
  values (p_session_id, v_user_id, v_new_session, now(), v_provider, v_model, v_dims, v_task)
  on conflict (user_id, session_id, provider, model, dimensions, task) do update
    set taste = excluded.taste,
        updated_at = excluded.updated_at;

  -- USER vector (active model/task)
  select uv.taste
    into v_old_user
  from public.media_user_vectors uv
  where uv.user_id = v_user_id
    and uv.provider=v_provider and uv.model=v_model and uv.dimensions=v_dims and uv.task=v_task
  limit 1;

  if v_old_user is null then
    v_new_user := extensions.l2_normalize(v_emb * ((v_weight::float4) * 0.50));
  else
    v_new_user := extensions.l2_normalize(
      (v_old_user * (1.0 - v_alpha_user)::float4)
      + (v_emb * (v_alpha_user * v_weight)::float4)
    );
  end if;

  insert into public.media_user_vectors (user_id, taste, updated_at, provider, model, dimensions, task)
  values (v_user_id, v_new_user, now(), v_provider, v_model, v_dims, v_task)
  on conflict (user_id, provider, model, dimensions, task) do update
    set taste = excluded.taste,
        updated_at = excluded.updated_at;

  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION public.media_update_taste_vectors_v1(p_session_id uuid, p_media_item_id uuid, p_event_type public.media_event_type, p_dwell_ms integer, p_rating_0_10 numeric, p_in_watchlist boolean) OWNER TO postgres;

--
-- TOC entry 749 (class 1255 OID 422742)
-- Name: messages_set_sender_id_v1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.messages_set_sender_id_v1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
begin
  -- Ensure user_id is present (if the column exists). Most of your code uses user_id.
  begin
    if new.user_id is null then
      new.user_id := auth.uid();
    end if;
  exception
    when undefined_column then
      -- user_id column doesn't exist in this schema; ignore.
      null;
  end;

  -- Ensure sender_id is present.
  if new.sender_id is null then
    new.sender_id := coalesce(auth.uid(), new.user_id);
  end if;

  -- Keep them consistent if both exist.
  begin
    if new.user_id is not null and new.sender_id <> new.user_id then
      new.sender_id := new.user_id;
    end if;
  exception
    when undefined_column then
      null;
  end;

  return new;
end;
$$;


ALTER FUNCTION public.messages_set_sender_id_v1() OWNER TO postgres;

--
-- TOC entry 605 (class 1255 OID 384889)
-- Name: prevent_message_conversation_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_message_conversation_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
begin
  if new.conversation_id <> old.conversation_id then
    raise exception 'conversation_id_change_not_allowed';
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.prevent_message_conversation_change() OWNER TO postgres;

--
-- TOC entry 526 (class 1255 OID 295956)
-- Name: refresh_media_feedback_impressions_7d_v1(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_media_feedback_impressions_7d_v1(p_user_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  -- Step 1: zero out for target user(s)
  update public.media_feedback mf
  set impressions_7d = 0,
      updated_at = now()
  where (p_user_id is null or mf.user_id = p_user_id);

  -- Step 2: write actual counts for items that have impressions in last 7 days
  with counts as (
    select
      e.user_id,
      e.media_item_id,
      count(*)::int as impressions_7d
    from public.media_events e
    where e.event_type::text = 'impression'
      and e.created_at > now() - interval '7 days'
      and (p_user_id is null or e.user_id = p_user_id)
    group by e.user_id, e.media_item_id
  )
  update public.media_feedback mf
  set impressions_7d = c.impressions_7d,
      updated_at = now()
  from counts c
  where mf.user_id = c.user_id
    and mf.media_item_id = c.media_item_id;

end $$;


ALTER FUNCTION public.refresh_media_feedback_impressions_7d_v1(p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 835 (class 1255 OID 147554)
-- Name: refresh_media_trending_scores(integer, integer, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_media_trending_scores(lookback_days integer DEFAULT 14, half_life_hours integer DEFAULT 72, completeness_min numeric DEFAULT 0.75) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
with params as (
  select
    greatest(1, least(60, lookback_days))::int as lookback_days,
    greatest(1, least(720, half_life_hours))::float8 as half_life_hours,
    greatest(0, least(1, completeness_min))::numeric as completeness_min
),
d as (
  select
    mid.media_item_id,
    mid.day,
    mid.likes, mid.dislikes, mid.skips,
    mid.watchlist_events,
    mid.unique_users,
    mid.dwell_ms_sum,
    extract(epoch from (now() at time zone 'utc') - (mid.day::timestamptz)) / 3600.0 as age_hours
  from public.media_item_daily mid, params p
  where mid.day >= ((now() at time zone 'utc')::date - (p.lookback_days||' days')::interval)::date
),
scored as (
  select
    d.media_item_id,
    sum(
      (
        3.0*d.likes +
        2.0*d.watchlist_events +
        0.8*d.unique_users +
        0.00005*d.dwell_ms_sum -
        2.0*d.dislikes -
        0.5*d.skips
      )
      * power(2.0, -d.age_hours / (select half_life_hours from params))
    ) as score
  from d
  group by d.media_item_id
),
filtered as (
  select s.media_item_id, s.score
  from scored s
  join public.media_items mi on mi.id = s.media_item_id
  where coalesce(mi.completeness, 0) >= (select completeness_min from params)
)
insert into public.media_trending_scores(media_item_id, score_72h, computed_at)
select media_item_id, score::float8, now()
from filtered
on conflict (media_item_id) do update
  set score_72h = excluded.score_72h,
      computed_at = excluded.computed_at;
$$;


ALTER FUNCTION public.refresh_media_trending_scores(lookback_days integer, half_life_hours integer, completeness_min numeric) OWNER TO postgres;

--
-- TOC entry 696 (class 1255 OID 154215)
-- Name: reset_media_embed_backfill_cursor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_media_embed_backfill_cursor() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.media_job_state (job_name, cursor)
  values ('media-embed-backfill', null)
  on conflict (job_name) do update set cursor = null, updated_at = now();
$$;


ALTER FUNCTION public.reset_media_embed_backfill_cursor() OWNER TO postgres;

--
-- TOC entry 725 (class 1255 OID 285830)
-- Name: set_active_embedding_profile(text, text, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only admins may change global embedding profile
  IF NOT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- This schema stores vectors as vector(1024). Prevent config drift.
  IF p_dimensions IS DISTINCT FROM 1024 THEN
    RAISE EXCEPTION 'Unsupported embedding dimension %, expected 1024', p_dimensions;
  END IF;

  UPDATE public.embedding_settings
  SET
    active_provider = p_provider,
    active_model = p_model,
    active_dimensions = p_dimensions,
    active_task = p_task,
    updated_at = now()
  WHERE id = 1;
END;
$$;


ALTER FUNCTION public.set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text) OWNER TO postgres;

--
-- TOC entry 586 (class 1255 OID 291584)
-- Name: set_media_rerank_cache_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_media_rerank_cache_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_media_rerank_cache_updated_at() OWNER TO postgres;

--
-- TOC entry 688 (class 1255 OID 32553)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- TOC entry 663 (class 1255 OID 384879)
-- Name: sync_profiles_public(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_profiles_public() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
begin
  insert into public.profiles_public (
    id,
    username,
    display_name,
    avatar_url,
    avatar_path,
    bio,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.username,
    new.display_name,
    new.avatar_url,
    new.avatar_url,
    new.bio,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set username     = excluded.username,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        avatar_path  = excluded.avatar_path,
        bio          = excluded.bio,
        updated_at   = now();

  return new;
end;
$$;


ALTER FUNCTION public.sync_profiles_public() OWNER TO postgres;

--
-- TOC entry 728 (class 1255 OID 293491)
-- Name: sync_title_genres_for_media_item(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_title_genres_for_media_item(p_title_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tmdb_genre_ids int[];
  v_omdb_genre text;
begin
  delete from public.media_genres tg where tg.media_item_id = p_title_id;

  select
    mi.tmdb_genre_ids::int[],
    mi.omdb_genre
  into v_tmdb_genre_ids, v_omdb_genre
  from public.media_items mi
  where mi.id = p_title_id;

  -- Prefer matching by genre id when tmdb_genre_ids aligns with public.genres.id.
  if v_tmdb_genre_ids is not null then
    insert into public.media_genres(media_item_id, genre_id)
    select distinct p_title_id, g.id
    from public.genres g
    where g.id = any(v_tmdb_genre_ids::bigint[]);
  end if;

  -- Fallback: match by genre name parsed from OMDb "Genre" string.
  if v_omdb_genre is not null and btrim(v_omdb_genre) <> '' then
    insert into public.media_genres(media_item_id, genre_id)
    select distinct p_title_id, g.id
    from public.genres g
    join lateral (
      select btrim(x) as name
      from unnest(string_to_array(v_omdb_genre, ',')) as x
    ) n on lower(n.name) = lower(g.name)
    on conflict do nothing;
  end if;
end;
$$;


ALTER FUNCTION public.sync_title_genres_for_media_item(p_title_id uuid) OWNER TO postgres;

--
-- TOC entry 598 (class 1255 OID 446625)
-- Name: thompson_sample_exploration_rate(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.thompson_sample_exploration_rate(p_section text, p_context jsonb DEFAULT '{}'::jsonb) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_alpha numeric;
  v_beta numeric;
  v_mean numeric;
  v_var numeric;
  v_std numeric;
  u1 numeric;
  u2 numeric;
  z numeric;
  v_sample numeric;
BEGIN
  /*
    context_features @> p_context can match multiple rows.
    Pick the most specific match (highest number of keys), falling back to priors.
  */
  SELECT
    COALESCE(clicks, 0) + 1,
    GREATEST(COALESCE(impressions, 0) - COALESCE(clicks, 0), 0) + 1
  INTO v_alpha, v_beta
  FROM public.recommendation_performance
  WHERE section = p_section
    AND context_features @> COALESCE(p_context, '{}'::jsonb)
  ORDER BY jsonb_object_length(context_features) DESC
  LIMIT 1;

  IF v_alpha IS NULL THEN
    v_alpha := 1;
    v_beta := 1;
  END IF;

  v_mean := v_alpha / (v_alpha + v_beta);
  v_var := (v_alpha * v_beta) / (((v_alpha + v_beta)^2) * (v_alpha + v_beta + 1));
  v_std := SQRT(GREATEST(v_var, 0));

  -- Box–Muller transform for ~N(0,1)
  u1 := GREATEST(random(), 1e-12);
  u2 := random();
  z := SQRT(-2 * LN(u1)) * COS(2 * PI() * u2);

  v_sample := v_mean + v_std * z;

  -- Clamp to keep experience stable
  RETURN GREATEST(0.03, LEAST(0.30, v_sample));
END;
$$;


ALTER FUNCTION public.thompson_sample_exploration_rate(p_section text, p_context jsonb) OWNER TO postgres;

--
-- TOC entry 716 (class 1255 OID 53405)
-- Name: toggle_follow(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.toggle_follow(p_target_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.follows
    WHERE follower_id = auth.uid()
      AND followed_id = p_target_user_id
  ) THEN
    DELETE FROM public.follows
    WHERE follower_id = auth.uid()
      AND followed_id = p_target_user_id;
  ELSE
    INSERT INTO public.follows (follower_id, followed_id)
    VALUES (auth.uid(), p_target_user_id);
  END IF;
END;
$$;


ALTER FUNCTION public.toggle_follow(p_target_user_id uuid) OWNER TO postgres;

--
-- TOC entry 641 (class 1255 OID 392385)
-- Name: touch_conversation_updated_at(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_conversation_updated_at(_conversation_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  update public.conversations
  set updated_at = now()
  where id = _conversation_id;
$$;


ALTER FUNCTION public.touch_conversation_updated_at(_conversation_id uuid) OWNER TO postgres;

--
-- TOC entry 699 (class 1255 OID 446506)
-- Name: trg_audit_media_items_delete_func(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_audit_media_items_delete_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.admin_audit_log (admin_id, action, target_id, target_type, details)
  values (auth.uid(), 'DELETE_MEDIA_ITEM', old.id, 'MEDIA_ITEM', jsonb_build_object('title', coalesce(old.tmdb_title, old.omdb_title), 'imdb_id', old.omdb_imdb_id));
  return old;
end;
$$;


ALTER FUNCTION public.trg_audit_media_items_delete_func() OWNER TO postgres;

--
-- TOC entry 702 (class 1255 OID 446504)
-- Name: trg_audit_profiles_delete_func(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_audit_profiles_delete_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.admin_audit_log (admin_id, action, target_id, target_type, details)
  values (auth.uid(), 'DELETE_PROFILE', old.id, 'PROFILE', jsonb_build_object('username', old.username, 'email', old.email));
  return old;
end;
$$;


ALTER FUNCTION public.trg_audit_profiles_delete_func() OWNER TO postgres;

--
-- TOC entry 496 (class 1255 OID 445554)
-- Name: trg_media_items_fts_sync(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_media_items_fts_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.tmdb_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.tmdb_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.omdb_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.tmdb_original_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.tmdb_original_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.tmdb_tagline, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.tmdb_overview, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(new.omdb_plot, '')), 'D');
  return new;
end;
$$;


ALTER FUNCTION public.trg_media_items_fts_sync() OWNER TO postgres;

--
-- TOC entry 695 (class 1255 OID 446622)
-- Name: update_recommendation_performance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_recommendation_performance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_is_positive_rate boolean := false;
BEGIN
  -- If we can't resolve the impression, don't break writes.
  IF NEW.impression_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Treat "positive rating" robustly for either a 0-5 or 0-10 scale:
  --  - if <= 5, positive is >= 4
  --  - if > 5, positive is >= 7
  IF NEW.interaction_type = 'rate' AND NEW.interaction_value IS NOT NULL THEN
    v_is_positive_rate :=
      (NEW.interaction_value <= 5 AND NEW.interaction_value >= 4)
      OR
      (NEW.interaction_value > 5 AND NEW.interaction_value >= 7);
  END IF;

  WITH impression_context AS (
    SELECT
      section,
      COALESCE(context_features, '{}'::jsonb) AS context_features
    FROM public.recommendation_impressions
    WHERE id = NEW.impression_id
    LIMIT 1
  )
  INSERT INTO public.recommendation_performance (
    section,
    context_features,
    impressions,
    clicks,
    watches,
    positive_ratings,
    total_watch_time_seconds
  )
  SELECT
    ic.section,
    ic.context_features,
    0,
    CASE WHEN NEW.interaction_type = 'click' THEN 1 ELSE 0 END,
    CASE WHEN NEW.interaction_type = 'watch' THEN 1 ELSE 0 END,
    CASE WHEN v_is_positive_rate THEN 1 ELSE 0 END,
    CASE WHEN NEW.interaction_type = 'watch' THEN COALESCE(NEW.interaction_value::bigint, 0) ELSE 0 END
  FROM impression_context ic
  ON CONFLICT (section, context_features) DO UPDATE
  SET
    clicks = public.recommendation_performance.clicks + EXCLUDED.clicks,
    watches = public.recommendation_performance.watches + EXCLUDED.watches,
    positive_ratings = public.recommendation_performance.positive_ratings + EXCLUDED.positive_ratings,
    total_watch_time_seconds = public.recommendation_performance.total_watch_time_seconds + EXCLUDED.total_watch_time_seconds,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_recommendation_performance() OWNER TO postgres;

--
-- TOC entry 800 (class 1255 OID 361182)
-- Name: validate_message_insert_v1(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_message_insert_v1() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
declare
  body_json jsonb;
  t text;
begin
  if new.attachment_url is not null then
    if new.attachment_url ~* '^https?://' then
      raise exception 'External attachment URLs are not allowed';
    end if;
    if position('..' in new.attachment_url) > 0 then
      raise exception 'Invalid attachment path';
    end if;
  end if;

  if new.body is not null then
    begin
      -- Works for both text and jsonb columns.
      body_json := new.body::jsonb;
    exception when others then
      if pg_column_size(new.body) > 16000 then
        raise exception 'Message too large';
      end if;
      return new;
    end;

    t := coalesce(body_json->>'type', '');
    if t = 'system' then
      raise exception 'Cannot insert system messages from client';
    end if;
    if (body_json ? 'deleted') or (body_json ? 'deletedAt') or (body_json ? 'editedAt') then
      raise exception 'Cannot set edit/delete fields on insert';
    end if;
    if pg_column_size(new.body) > 16000 then
      raise exception 'Message too large';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.validate_message_insert_v1() OWNER TO postgres;

--
-- TOC entry 529 (class 1255 OID 17387)
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- TOC entry 705 (class 1255 OID 17466)
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- TOC entry 521 (class 1255 OID 17399)
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- TOC entry 644 (class 1255 OID 17159)
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- TOC entry 630 (class 1255 OID 17154)
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- TOC entry 779 (class 1255 OID 17395)
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- TOC entry 678 (class 1255 OID 17406)
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- TOC entry 784 (class 1255 OID 17153)
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- TOC entry 724 (class 1255 OID 17465)
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- TOC entry 723 (class 1255 OID 17151)
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- TOC entry 530 (class 1255 OID 17376)
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- TOC entry 789 (class 1255 OID 17459)
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- TOC entry 626 (class 1255 OID 17277)
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION storage.add_prefixes(_bucket_id text, _name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 588 (class 1255 OID 17200)
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- TOC entry 667 (class 1255 OID 17319)
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) OWNER TO supabase_storage_admin;

--
-- TOC entry 731 (class 1255 OID 17278)
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION storage.delete_prefix(_bucket_id text, _name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 537 (class 1255 OID 17281)
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION storage.delete_prefix_hierarchy_trigger() OWNER TO supabase_storage_admin;

--
-- TOC entry 600 (class 1255 OID 17298)
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- TOC entry 785 (class 1255 OID 17163)
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 703 (class 1255 OID 17162)
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 500 (class 1255 OID 17161)
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 637 (class 1255 OID 17259)
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION storage.get_level(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 533 (class 1255 OID 17275)
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION storage.get_prefix(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 575 (class 1255 OID 17276)
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION storage.get_prefixes(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 662 (class 1255 OID 17296)
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- TOC entry 828 (class 1255 OID 17242)
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- TOC entry 546 (class 1255 OID 17205)
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text) OWNER TO supabase_storage_admin;

--
-- TOC entry 570 (class 1255 OID 17318)
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) OWNER TO supabase_storage_admin;

--
-- TOC entry 631 (class 1255 OID 17320)
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.objects_delete_cleanup() OWNER TO supabase_storage_admin;

--
-- TOC entry 613 (class 1255 OID 17280)
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.objects_insert_prefix_trigger() OWNER TO supabase_storage_admin;

--
-- TOC entry 771 (class 1255 OID 17321)
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.objects_update_cleanup() OWNER TO supabase_storage_admin;

--
-- TOC entry 543 (class 1255 OID 17326)
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.objects_update_level_trigger() OWNER TO supabase_storage_admin;

--
-- TOC entry 483 (class 1255 OID 17297)
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.objects_update_prefix_trigger() OWNER TO supabase_storage_admin;

--
-- TOC entry 658 (class 1255 OID 17258)
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- TOC entry 547 (class 1255 OID 17322)
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.prefixes_delete_cleanup() OWNER TO supabase_storage_admin;

--
-- TOC entry 683 (class 1255 OID 17279)
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.prefixes_insert_trigger() OWNER TO supabase_storage_admin;

--
-- TOC entry 778 (class 1255 OID 17189)
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- TOC entry 769 (class 1255 OID 17294)
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- TOC entry 827 (class 1255 OID 17293)
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- TOC entry 665 (class 1255 OID 17317)
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- TOC entry 701 (class 1255 OID 17190)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

--
-- TOC entry 363 (class 1259 OID 16525)
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- TOC entry 6087 (class 0 OID 0)
-- Dependencies: 363
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- TOC entry 380 (class 1259 OID 16929)
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- TOC entry 6089 (class 0 OID 0)
-- Dependencies: 380
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- TOC entry 371 (class 1259 OID 16727)
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- TOC entry 6091 (class 0 OID 0)
-- Dependencies: 371
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- TOC entry 6092 (class 0 OID 0)
-- Dependencies: 371
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- TOC entry 362 (class 1259 OID 16518)
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- TOC entry 6094 (class 0 OID 0)
-- Dependencies: 362
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- TOC entry 375 (class 1259 OID 16816)
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- TOC entry 6096 (class 0 OID 0)
-- Dependencies: 375
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- TOC entry 374 (class 1259 OID 16804)
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- TOC entry 6098 (class 0 OID 0)
-- Dependencies: 374
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- TOC entry 373 (class 1259 OID 16791)
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- TOC entry 6100 (class 0 OID 0)
-- Dependencies: 373
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- TOC entry 6101 (class 0 OID 0)
-- Dependencies: 373
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- TOC entry 383 (class 1259 OID 17041)
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- TOC entry 440 (class 1259 OID 107893)
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- TOC entry 6104 (class 0 OID 0)
-- Dependencies: 440
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- TOC entry 382 (class 1259 OID 17011)
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- TOC entry 384 (class 1259 OID 17074)
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- TOC entry 381 (class 1259 OID 16979)
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- TOC entry 361 (class 1259 OID 16507)
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- TOC entry 6109 (class 0 OID 0)
-- Dependencies: 361
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- TOC entry 360 (class 1259 OID 16506)
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- TOC entry 6111 (class 0 OID 0)
-- Dependencies: 360
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- TOC entry 378 (class 1259 OID 16858)
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- TOC entry 6113 (class 0 OID 0)
-- Dependencies: 378
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- TOC entry 379 (class 1259 OID 16876)
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- TOC entry 6115 (class 0 OID 0)
-- Dependencies: 379
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- TOC entry 364 (class 1259 OID 16533)
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- TOC entry 6117 (class 0 OID 0)
-- Dependencies: 364
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- TOC entry 372 (class 1259 OID 16757)
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- TOC entry 6119 (class 0 OID 0)
-- Dependencies: 372
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- TOC entry 6120 (class 0 OID 0)
-- Dependencies: 372
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- TOC entry 6121 (class 0 OID 0)
-- Dependencies: 372
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- TOC entry 6122 (class 0 OID 0)
-- Dependencies: 372
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- TOC entry 377 (class 1259 OID 16843)
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- TOC entry 6124 (class 0 OID 0)
-- Dependencies: 377
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- TOC entry 376 (class 1259 OID 16834)
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- TOC entry 6126 (class 0 OID 0)
-- Dependencies: 376
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- TOC entry 6127 (class 0 OID 0)
-- Dependencies: 376
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- TOC entry 359 (class 1259 OID 16495)
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- TOC entry 6129 (class 0 OID 0)
-- Dependencies: 359
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- TOC entry 6130 (class 0 OID 0)
-- Dependencies: 359
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- TOC entry 457 (class 1259 OID 285049)
-- Name: embedding_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.embedding_settings (
    id integer NOT NULL,
    active_provider text DEFAULT 'voyage'::text NOT NULL,
    active_model text DEFAULT 'voyage-3-large'::text NOT NULL,
    active_dimensions integer DEFAULT 1024 NOT NULL,
    active_task text DEFAULT 'swipe'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rerank_swipe_enabled boolean DEFAULT false NOT NULL,
    rerank_search_enabled boolean DEFAULT false NOT NULL,
    rerank_top_k integer DEFAULT 50 NOT NULL,
    CONSTRAINT embedding_settings_id_check CHECK ((id = 1))
);


ALTER TABLE public.embedding_settings OWNER TO postgres;

--
-- TOC entry 458 (class 1259 OID 286546)
-- Name: active_embedding_profile; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.active_embedding_profile WITH (security_invoker='true') AS
 SELECT active_provider AS provider,
    active_model AS model,
    active_dimensions AS dimensions,
    active_task AS task
   FROM public.embedding_settings es
  WHERE (id = 1);


ALTER VIEW public.active_embedding_profile OWNER TO postgres;

--
-- TOC entry 463 (class 1259 OID 287121)
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_user_id uuid NOT NULL,
    action text NOT NULL,
    target text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.admin_audit_log OWNER TO postgres;

--
-- TOC entry 474 (class 1259 OID 355945)
-- Name: admin_costs_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_costs_settings (
    id integer NOT NULL,
    total_daily_budget bigint,
    by_provider_budget jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_costs_settings OWNER TO postgres;

--
-- TOC entry 465 (class 1259 OID 287154)
-- Name: admin_cron_registry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_cron_registry (
    jobname text NOT NULL,
    schedule text NOT NULL,
    command text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_cron_registry OWNER TO postgres;

--
-- TOC entry 462 (class 1259 OID 287112)
-- Name: app_admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_admins (
    user_id uuid NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_admins OWNER TO postgres;

--
-- TOC entry 425 (class 1259 OID 35398)
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_users (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blocked_users OWNER TO postgres;

--
-- TOC entry 409 (class 1259 OID 35080)
-- Name: comment_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_likes (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comment_likes OWNER TO postgres;

--
-- TOC entry 404 (class 1259 OID 34945)
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    review_id uuid,
    parent_comment_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_body_not_empty_chk CHECK ((TRIM(BOTH FROM body) <> ''::text))
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- TOC entry 413 (class 1259 OID 35154)
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.participant_role DEFAULT 'member'::public.participant_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.conversation_participants REPLICA IDENTITY FULL;


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- TOC entry 412 (class 1259 OID 35138)
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_group boolean DEFAULT false NOT NULL,
    title text,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    direct_participant_ids uuid[],
    CONSTRAINT direct_conversations_require_pair CHECK ((is_group OR ((direct_participant_ids IS NOT NULL) AND (array_length(direct_participant_ids, 1) = 2))))
);

ALTER TABLE ONLY public.conversations REPLICA IDENTITY FULL;


ALTER TABLE public.conversations OWNER TO postgres;

--
-- TOC entry 407 (class 1259 OID 35041)
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    followed_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follows OWNER TO postgres;

--
-- TOC entry 420 (class 1259 OID 35300)
-- Name: genres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.genres (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text NOT NULL
);


ALTER TABLE public.genres OWNER TO postgres;

--
-- TOC entry 419 (class 1259 OID 35299)
-- Name: genres_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.genres_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.genres_id_seq OWNER TO postgres;

--
-- TOC entry 6151 (class 0 OID 0)
-- Dependencies: 419
-- Name: genres_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.genres_id_seq OWNED BY public.genres.id;


--
-- TOC entry 464 (class 1259 OID 287132)
-- Name: job_run_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_run_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    job_name text NOT NULL,
    provider text,
    model text,
    ok boolean DEFAULT false NOT NULL,
    scanned integer,
    embedded integer,
    skipped_existing integer,
    total_tokens bigint DEFAULT 0,
    error_code text,
    error_message text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.job_run_log OWNER TO postgres;

--
-- TOC entry 402 (class 1259 OID 34893)
-- Name: library_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.library_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title_id uuid NOT NULL,
    content_type public.content_type NOT NULL,
    status public.library_status DEFAULT 'want_to_watch'::public.library_status NOT NULL,
    notes text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.library_entries OWNER TO postgres;

--
-- TOC entry 406 (class 1259 OID 34994)
-- Name: list_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid NOT NULL,
    title_id uuid NOT NULL,
    content_type public.content_type NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.list_items OWNER TO postgres;

--
-- TOC entry 405 (class 1259 OID 34973)
-- Name: lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lists OWNER TO postgres;

--
-- TOC entry 441 (class 1259 OID 135411)
-- Name: media_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind public.media_kind DEFAULT 'other'::public.media_kind NOT NULL,
    omdb_raw jsonb,
    tmdb_raw jsonb,
    omdb_title text,
    omdb_year text,
    omdb_rated text,
    omdb_released text,
    omdb_runtime text,
    omdb_genre text,
    omdb_director text,
    omdb_writer text,
    omdb_actors text,
    omdb_plot text,
    omdb_language text,
    omdb_country text,
    omdb_awards text,
    omdb_poster text,
    omdb_metascore text,
    omdb_imdb_rating numeric,
    omdb_imdb_votes text,
    omdb_imdb_id text,
    omdb_type text,
    omdb_dvd text,
    omdb_box_office text,
    omdb_production text,
    omdb_website text,
    omdb_total_seasons integer,
    omdb_response boolean,
    omdb_rating_internet_movie_database text,
    omdb_rating_rotten_tomatoes text,
    omdb_rating_metacritic text,
    tmdb_id bigint,
    tmdb_adult boolean,
    tmdb_backdrop_path text,
    tmdb_genre_ids integer[],
    tmdb_original_language text,
    tmdb_original_title text,
    tmdb_overview text,
    tmdb_popularity numeric,
    tmdb_poster_path text,
    tmdb_release_date date,
    tmdb_title text,
    tmdb_video boolean,
    tmdb_vote_average numeric,
    tmdb_vote_count integer,
    tmdb_name text,
    tmdb_original_name text,
    tmdb_first_air_date date,
    tmdb_media_type text,
    tmdb_origin_country text[],
    tmdb_fetched_at timestamp with time zone,
    tmdb_status text,
    tmdb_error text,
    omdb_fetched_at timestamp with time zone,
    omdb_status text,
    omdb_error text,
    filled_count integer,
    missing_count integer,
    completeness numeric,
    omdb_ratings jsonb,
    tmdb_budget bigint,
    tmdb_revenue bigint,
    tmdb_runtime integer,
    tmdb_tagline text,
    tmdb_homepage text,
    tmdb_imdb_id text,
    tmdb_genres jsonb,
    tmdb_spoken_languages jsonb,
    tmdb_production_companies jsonb,
    tmdb_production_countries jsonb,
    tmdb_belongs_to_collection jsonb,
    tmdb_source text,
    tmdb_release_status text,
    tmdb_origin_country_raw jsonb,
    search_vector tsvector,
    CONSTRAINT media_items_external_id_required_chk CHECK (((kind = 'other'::public.media_kind) OR (tmdb_id IS NOT NULL) OR ((omdb_imdb_id IS NOT NULL) AND (omdb_imdb_id <> ''::text)))),
    CONSTRAINT media_items_imdb_id_format_chk CHECK (((omdb_imdb_id IS NULL) OR (omdb_imdb_id ~ '^tt[0-9]{7,10}$'::text))),
    CONSTRAINT media_items_omdb_imdb_id_not_empty_chk CHECK (((omdb_imdb_id IS NULL) OR (omdb_imdb_id <> ''::text))),
    CONSTRAINT media_items_tmdb_id_positive_chk CHECK (((tmdb_id IS NULL) OR (tmdb_id > 0)))
);


ALTER TABLE public.media_items OWNER TO postgres;

--
-- TOC entry 444 (class 1259 OID 146828)
-- Name: media_catalog; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.media_catalog WITH (security_invoker='true') AS
 SELECT id AS media_item_id,
    kind,
    COALESCE(tmdb_title, tmdb_name, omdb_title) AS title,
    COALESCE(tmdb_overview, omdb_plot) AS overview,
    COALESCE(omdb_poster, tmdb_poster_path) AS poster_ref,
    tmdb_backdrop_path AS backdrop_ref,
    (EXTRACT(year FROM COALESCE(tmdb_release_date, tmdb_first_air_date)))::integer AS release_year,
        CASE
            WHEN (omdb_runtime ~ '^[0-9]+'::text) THEN (regexp_replace(omdb_runtime, '[^0-9].*$'::text, ''::text))::integer
            ELSE NULL::integer
        END AS runtime_minutes,
    tmdb_genre_ids AS tmdb_genre_ids_raw,
    tmdb_original_language,
    omdb_language,
    omdb_country,
    tmdb_popularity,
    tmdb_vote_average,
    tmdb_vote_count,
    omdb_imdb_rating,
    completeness,
    tmdb_status,
    omdb_status
   FROM public.media_items mi;


ALTER VIEW public.media_catalog OWNER TO postgres;

--
-- TOC entry 445 (class 1259 OID 146833)
-- Name: media_embeddings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_embeddings (
    media_item_id uuid NOT NULL,
    embedding extensions.vector(1024) NOT NULL,
    model text DEFAULT 'jina-embeddings-v3'::text NOT NULL,
    task text DEFAULT 'retrieval.passage'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'jina'::text NOT NULL,
    dimensions integer DEFAULT 1024 NOT NULL
);


ALTER TABLE public.media_embeddings OWNER TO postgres;

--
-- TOC entry 459 (class 1259 OID 286550)
-- Name: media_embeddings_active; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.media_embeddings_active WITH (security_invoker='true') AS
 SELECT me.media_item_id,
    me.embedding,
    me.model,
    me.task,
    me.updated_at,
    me.provider,
    me.dimensions
   FROM (public.media_embeddings me
     JOIN public.active_embedding_profile p ON (((me.provider = p.provider) AND (me.model = p.model) AND (me.dimensions = p.dimensions) AND (me.task = p.task))));


ALTER VIEW public.media_embeddings_active OWNER TO postgres;

--
-- TOC entry 446 (class 1259 OID 146873)
-- Name: media_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    deck_id uuid,
    "position" integer,
    media_item_id uuid NOT NULL,
    event_type public.media_event_type NOT NULL,
    source text,
    dwell_ms integer,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_event_id uuid,
    rating_0_10 numeric,
    in_watchlist boolean,
    event_day date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,
    dedupe_key text NOT NULL,
    CONSTRAINT media_events_dedupe_key_len CHECK (((char_length(dedupe_key) >= 3) AND (char_length(dedupe_key) <= 256)))
);


ALTER TABLE public.media_events OWNER TO postgres;

--
-- TOC entry 447 (class 1259 OID 146895)
-- Name: media_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_feedback (
    user_id uuid NOT NULL,
    media_item_id uuid NOT NULL,
    last_action public.media_event_type,
    last_action_at timestamp with time zone DEFAULT now() NOT NULL,
    rating_0_10 numeric,
    in_watchlist boolean,
    last_dwell_ms integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_impression_at timestamp with time zone,
    impressions_7d integer DEFAULT 0 NOT NULL,
    seen_count_total integer DEFAULT 0 NOT NULL,
    last_dwell_at timestamp with time zone,
    dwell_ms_ema double precision DEFAULT 0 NOT NULL,
    positive_ema double precision DEFAULT 0 NOT NULL,
    negative_ema double precision DEFAULT 0 NOT NULL,
    last_why text,
    last_rank_score double precision
);


ALTER TABLE public.media_feedback OWNER TO postgres;

--
-- TOC entry 473 (class 1259 OID 351751)
-- Name: media_genres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_genres (
    media_item_id uuid NOT NULL,
    genre_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_genres OWNER TO postgres;

--
-- TOC entry 452 (class 1259 OID 150305)
-- Name: media_item_daily; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_item_daily (
    day date NOT NULL,
    media_item_id uuid NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    dwell_events integer DEFAULT 0 NOT NULL,
    dwell_ms_sum bigint DEFAULT 0 NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    dislikes integer DEFAULT 0 NOT NULL,
    skips integer DEFAULT 0 NOT NULL,
    watchlist_events integer DEFAULT 0 NOT NULL,
    rating_events integer DEFAULT 0 NOT NULL,
    unique_users integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_item_daily OWNER TO postgres;

--
-- TOC entry 453 (class 1259 OID 150327)
-- Name: media_item_daily_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_item_daily_users (
    day date NOT NULL,
    media_item_id uuid NOT NULL,
    user_id uuid NOT NULL
);


ALTER TABLE public.media_item_daily_users OWNER TO postgres;

--
-- TOC entry 454 (class 1259 OID 150340)
-- Name: media_item_trending_72h; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.media_item_trending_72h WITH (security_invoker='true') AS
 SELECT media_item_id,
    sum(likes) AS likes,
    sum(skips) AS skips,
    sum(dislikes) AS dislikes,
    sum(impressions) AS impressions,
    sum(dwell_events) AS dwell_events,
    sum(dwell_ms_sum) AS dwell_ms_sum,
    sum(unique_users) AS unique_users,
    max(updated_at) AS updated_at,
    (((((((ln(((1 + sum(unique_users)))::double precision) * (20.0)::double precision) + (((sum(likes))::numeric * 3.0))::double precision) + (((sum(dwell_events))::numeric * 0.5))::double precision) + (((sum(dwell_ms_sum) / 60000.0) * 0.3))::double precision) - (((sum(dislikes))::numeric * 2.0))::double precision) - (((sum(skips))::numeric * 1.0))::double precision) + (((sum(impressions))::numeric * 0.02))::double precision) AS trend_score
   FROM public.media_item_daily mid
  WHERE (day >= (((now() AT TIME ZONE 'utc'::text))::date - 3))
  GROUP BY media_item_id;


ALTER VIEW public.media_item_trending_72h OWNER TO postgres;

--
-- TOC entry 455 (class 1259 OID 154206)
-- Name: media_job_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_job_state (
    job_name text NOT NULL,
    cursor uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.media_job_state FORCE ROW LEVEL SECURITY;


ALTER TABLE public.media_job_state OWNER TO postgres;

--
-- TOC entry 6167 (class 0 OID 0)
-- Dependencies: 455
-- Name: TABLE media_job_state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.media_job_state IS 'Stores cursors for background jobs (e.g. media-embed-backfill auto pagination).';


--
-- TOC entry 6168 (class 0 OID 0)
-- Dependencies: 455
-- Name: COLUMN media_job_state.cursor; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.media_job_state.cursor IS 'Opaque pagination cursor (media_items.id) used by the job. NULL means start or finished.';


--
-- TOC entry 471 (class 1259 OID 295881)
-- Name: media_rank_feature_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_rank_feature_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    deck_id uuid,
    media_item_id uuid NOT NULL,
    "position" integer,
    mode text,
    kind_filter text,
    source text,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    label jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.media_rank_feature_log OWNER TO postgres;

--
-- TOC entry 470 (class 1259 OID 295869)
-- Name: media_rank_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_rank_models (
    model_name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    intercept double precision DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_rank_models OWNER TO postgres;

--
-- TOC entry 467 (class 1259 OID 291572)
-- Name: media_rerank_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_rerank_cache (
    key text NOT NULL,
    user_id uuid NOT NULL,
    order_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_rerank_cache OWNER TO postgres;

--
-- TOC entry 472 (class 1259 OID 325903)
-- Name: media_served; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_served (
    user_id uuid NOT NULL,
    media_item_id uuid NOT NULL,
    served_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_served OWNER TO postgres;

--
-- TOC entry 449 (class 1259 OID 146927)
-- Name: media_session_vectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_session_vectors (
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    taste extensions.vector(1024),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'jina'::text NOT NULL,
    model text DEFAULT 'jina-embeddings-v3'::text NOT NULL,
    dimensions integer DEFAULT 1024 NOT NULL,
    task text DEFAULT 'retrieval.passage'::text NOT NULL
);


ALTER TABLE public.media_session_vectors OWNER TO postgres;

--
-- TOC entry 461 (class 1259 OID 286558)
-- Name: media_session_vectors_active; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.media_session_vectors_active WITH (security_invoker='true') AS
 SELECT sv.user_id,
    sv.session_id,
    sv.taste,
    sv.updated_at,
    sv.provider,
    sv.model,
    sv.dimensions,
    sv.task
   FROM (public.media_session_vectors sv
     JOIN public.active_embedding_profile p ON (((sv.provider = p.provider) AND (sv.model = p.model) AND (sv.dimensions = p.dimensions) AND (sv.task = p.task))));


ALTER VIEW public.media_session_vectors_active OWNER TO postgres;

--
-- TOC entry 450 (class 1259 OID 146940)
-- Name: media_trending_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_trending_scores (
    media_item_id uuid NOT NULL,
    score_72h double precision NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_trending_scores OWNER TO postgres;

--
-- TOC entry 469 (class 1259 OID 295826)
-- Name: media_user_centroids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_user_centroids (
    user_id uuid NOT NULL,
    centroid smallint NOT NULL,
    exemplar_media_item_id uuid NOT NULL,
    taste extensions.vector,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'jina'::text NOT NULL,
    model text DEFAULT 'jina-embeddings-v3'::text NOT NULL,
    dimensions integer DEFAULT 1024 NOT NULL,
    task text DEFAULT 'retrieval.passage'::text NOT NULL
);


ALTER TABLE public.media_user_centroids OWNER TO postgres;

--
-- TOC entry 448 (class 1259 OID 146914)
-- Name: media_user_vectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_user_vectors (
    user_id uuid NOT NULL,
    taste extensions.vector(1024),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'jina'::text NOT NULL,
    model text DEFAULT 'jina-embeddings-v3'::text NOT NULL,
    dimensions integer DEFAULT 1024 NOT NULL,
    task text DEFAULT 'retrieval.passage'::text NOT NULL
);


ALTER TABLE public.media_user_vectors OWNER TO postgres;

--
-- TOC entry 460 (class 1259 OID 286554)
-- Name: media_user_vectors_active; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.media_user_vectors_active WITH (security_invoker='true') AS
 SELECT uv.user_id,
    uv.taste,
    uv.updated_at,
    uv.provider,
    uv.model,
    uv.dimensions,
    uv.task
   FROM (public.media_user_vectors uv
     JOIN public.active_embedding_profile p ON (((uv.provider = p.provider) AND (uv.model = p.model) AND (uv.dimensions = p.dimensions) AND (uv.task = p.task))));


ALTER VIEW public.media_user_vectors_active OWNER TO postgres;

--
-- TOC entry 416 (class 1259 OID 35227)
-- Name: message_delivery_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_delivery_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_delivery_receipts OWNER TO postgres;

--
-- TOC entry 415 (class 1259 OID 35201)
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL
);


ALTER TABLE public.message_reactions OWNER TO postgres;

--
-- TOC entry 417 (class 1259 OID 35253)
-- Name: message_read_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_read_receipts (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_message_id uuid,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_read_receipts OWNER TO postgres;

--
-- TOC entry 414 (class 1259 OID 35180)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    body jsonb NOT NULL,
    attachment_url text,
    message_type public.message_type DEFAULT 'text'::public.message_type NOT NULL,
    text text,
    client_id text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    sender_id uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT messages_body_size_chk CHECK ((pg_column_size(body) <= 65536)),
    CONSTRAINT messages_meta_size_check CHECK (((meta IS NULL) OR (pg_column_size(meta) <= 16384))),
    CONSTRAINT messages_meta_size_chk CHECK (((meta IS NULL) OR (pg_column_size(meta) <= 16384))),
    CONSTRAINT messages_sender_matches_user_chk CHECK ((sender_id = user_id))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 428 (class 1259 OID 48649)
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    email_activity boolean DEFAULT true NOT NULL,
    email_recommendations boolean DEFAULT true NOT NULL,
    in_app_social boolean DEFAULT true NOT NULL,
    in_app_system boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- TOC entry 411 (class 1259 OID 35120)
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    data jsonb,
    is_read boolean DEFAULT false NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- TOC entry 443 (class 1259 OID 137055)
-- Name: omdb_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.omdb_cache (
    kind public.media_kind,
    imdb_id text NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    raw jsonb NOT NULL,
    CONSTRAINT omdb_cache_imdb_id_format_chk CHECK ((imdb_id ~ '^tt[0-9]{7,8}$'::text))
);


ALTER TABLE public.omdb_cache OWNER TO postgres;

--
-- TOC entry 422 (class 1259 OID 35323)
-- Name: people; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.people (
    id bigint NOT NULL,
    name text NOT NULL,
    tmdb_id bigint,
    imdb_id text
);


ALTER TABLE public.people OWNER TO postgres;

--
-- TOC entry 421 (class 1259 OID 35322)
-- Name: people_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.people_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.people_id_seq OWNER TO postgres;

--
-- TOC entry 6188 (class 0 OID 0)
-- Dependencies: 421
-- Name: people_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.people_id_seq OWNED BY public.people.id;


--
-- TOC entry 400 (class 1259 OID 24610)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    display_name text,
    email text,
    avatar_url text,
    bio text,
    CONSTRAINT profiles_username_format_chk CHECK (((username IS NULL) OR (username ~ '^[a-z0-9_]{3,30}$'::text)))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 477 (class 1259 OID 384867)
-- Name: profiles_public; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles_public (
    id uuid NOT NULL,
    username text,
    display_name text,
    avatar_path text,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    avatar_url text,
    bio text
);


ALTER TABLE public.profiles_public OWNER TO postgres;

--
-- TOC entry 401 (class 1259 OID 34868)
-- Name: ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title_id uuid NOT NULL,
    content_type public.content_type NOT NULL,
    rating numeric(2,1) NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ratings_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (10)::numeric) AND (((rating * (2)::numeric) % (1)::numeric) = (0)::numeric)))
);


ALTER TABLE public.ratings OWNER TO postgres;

--
-- TOC entry 479 (class 1259 OID 446558)
-- Name: recommendation_impressions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recommendation_impressions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid,
    section text NOT NULL,
    media_item_id uuid NOT NULL,
    score numeric,
    rank integer,
    is_exploration boolean DEFAULT false,
    context_features jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recommendation_impressions OWNER TO postgres;

--
-- TOC entry 6193 (class 0 OID 0)
-- Dependencies: 479
-- Name: TABLE recommendation_impressions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.recommendation_impressions IS 'Tracks which recommendations were shown to users for A/B testing and performance analysis.';


--
-- TOC entry 480 (class 1259 OID 446581)
-- Name: recommendation_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recommendation_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    impression_id uuid,
    user_id uuid NOT NULL,
    media_item_id uuid NOT NULL,
    interaction_type text NOT NULL,
    interaction_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_interactions_type_chk CHECK ((interaction_type = ANY (ARRAY['click'::text, 'watch'::text, 'rate'::text, 'save'::text, 'dismiss'::text])))
);


ALTER TABLE public.recommendation_interactions OWNER TO postgres;

--
-- TOC entry 6195 (class 0 OID 0)
-- Dependencies: 480
-- Name: TABLE recommendation_interactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.recommendation_interactions IS 'Tracks user interactions with recommendations (clicks, watches, ratings) for CTR and engagement metrics.';


--
-- TOC entry 481 (class 1259 OID 446607)
-- Name: recommendation_performance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recommendation_performance (
    section text NOT NULL,
    context_features jsonb DEFAULT '{}'::jsonb NOT NULL,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    watches integer DEFAULT 0,
    positive_ratings integer DEFAULT 0,
    total_watch_time_seconds bigint DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recommendation_performance OWNER TO postgres;

--
-- TOC entry 6197 (class 0 OID 0)
-- Dependencies: 481
-- Name: TABLE recommendation_performance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.recommendation_performance IS 'Aggregated performance metrics per section for Thompson Sampling and optimization.';


--
-- TOC entry 427 (class 1259 OID 35432)
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    reason text,
    status public.report_status DEFAULT 'open'::public.report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    notes text
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- TOC entry 408 (class 1259 OID 35059)
-- Name: review_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.review_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL
);


ALTER TABLE public.review_reactions OWNER TO postgres;

--
-- TOC entry 403 (class 1259 OID 34918)
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title_id uuid NOT NULL,
    content_type public.content_type NOT NULL,
    rating numeric(2,1),
    headline text,
    body text,
    spoiler boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (10)::numeric) AND (((rating * (2)::numeric) % (1)::numeric) = (0)::numeric)))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- TOC entry 442 (class 1259 OID 136524)
-- Name: tmdb_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tmdb_cache (
    kind public.media_kind NOT NULL,
    tmdb_id bigint NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    raw jsonb NOT NULL,
    CONSTRAINT tmdb_cache_tmdb_id_positive_chk CHECK ((tmdb_id > 0))
);


ALTER TABLE public.tmdb_cache OWNER TO postgres;

--
-- TOC entry 426 (class 1259 OID 35416)
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    push_notifications boolean DEFAULT true NOT NULL,
    privacy_profile public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    privacy_activity public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    privacy_lists public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- TOC entry 418 (class 1259 OID 35281)
-- Name: user_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_stats (
    user_id uuid NOT NULL,
    followers_count integer DEFAULT 0,
    following_count integer DEFAULT 0,
    ratings_count integer DEFAULT 0,
    reviews_count integer DEFAULT 0,
    watchlist_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    lists_count integer DEFAULT 0,
    messages_sent_count integer DEFAULT 0,
    last_active_at timestamp with time zone
);


ALTER TABLE public.user_stats OWNER TO postgres;

--
-- TOC entry 451 (class 1259 OID 146951)
-- Name: user_swipe_prefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_swipe_prefs (
    user_id uuid NOT NULL,
    year_min integer DEFAULT 1980,
    year_max integer DEFAULT EXTRACT(year FROM now()),
    runtime_min integer DEFAULT 30,
    runtime_max integer DEFAULT 240,
    completeness_min numeric DEFAULT 0.80
);


ALTER TABLE public.user_swipe_prefs OWNER TO postgres;

--
-- TOC entry 423 (class 1259 OID 35364)
-- Name: user_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_tags OWNER TO postgres;

--
-- TOC entry 424 (class 1259 OID 35380)
-- Name: user_title_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_title_tags (
    user_id uuid NOT NULL,
    title_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_title_tags OWNER TO postgres;

--
-- TOC entry 397 (class 1259 OID 17469)
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- TOC entry 456 (class 1259 OID 155039)
-- Name: messages_2025_12_20; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_20 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_20 OWNER TO supabase_admin;

--
-- TOC entry 466 (class 1259 OID 287360)
-- Name: messages_2025_12_21; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_21 OWNER TO supabase_admin;

--
-- TOC entry 468 (class 1259 OID 293905)
-- Name: messages_2025_12_22; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_22 OWNER TO supabase_admin;

--
-- TOC entry 475 (class 1259 OID 359522)
-- Name: messages_2025_12_23; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_23 OWNER TO supabase_admin;

--
-- TOC entry 476 (class 1259 OID 359534)
-- Name: messages_2025_12_24; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_24 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_24 OWNER TO supabase_admin;

--
-- TOC entry 478 (class 1259 OID 427400)
-- Name: messages_2025_12_25; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_25 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_25 OWNER TO supabase_admin;

--
-- TOC entry 482 (class 1259 OID 463837)
-- Name: messages_2025_12_26; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2025_12_26 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2025_12_26 OWNER TO supabase_admin;

--
-- TOC entry 385 (class 1259 OID 17116)
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- TOC entry 388 (class 1259 OID 17139)
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- TOC entry 387 (class 1259 OID 17138)
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 365 (class 1259 OID 16546)
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- TOC entry 6219 (class 0 OID 0)
-- Dependencies: 365
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- TOC entry 393 (class 1259 OID 17306)
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- TOC entry 394 (class 1259 OID 17333)
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- TOC entry 367 (class 1259 OID 16588)
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- TOC entry 366 (class 1259 OID 16561)
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- TOC entry 6223 (class 0 OID 0)
-- Dependencies: 366
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- TOC entry 392 (class 1259 OID 17260)
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE storage.prefixes OWNER TO supabase_storage_admin;

--
-- TOC entry 390 (class 1259 OID 17207)
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- TOC entry 391 (class 1259 OID 17221)
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- TOC entry 395 (class 1259 OID 17343)
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- TOC entry 398 (class 1259 OID 20107)
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- TOC entry 399 (class 1259 OID 20114)
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


ALTER TABLE supabase_migrations.seed_files OWNER TO postgres;

--
-- TOC entry 4446 (class 0 OID 0)
-- Name: messages_2025_12_20; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_20 FOR VALUES FROM ('2025-12-20 00:00:00') TO ('2025-12-21 00:00:00');


--
-- TOC entry 4447 (class 0 OID 0)
-- Name: messages_2025_12_21; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_21 FOR VALUES FROM ('2025-12-21 00:00:00') TO ('2025-12-22 00:00:00');


--
-- TOC entry 4448 (class 0 OID 0)
-- Name: messages_2025_12_22; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_22 FOR VALUES FROM ('2025-12-22 00:00:00') TO ('2025-12-23 00:00:00');


--
-- TOC entry 4449 (class 0 OID 0)
-- Name: messages_2025_12_23; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_23 FOR VALUES FROM ('2025-12-23 00:00:00') TO ('2025-12-24 00:00:00');


--
-- TOC entry 4450 (class 0 OID 0)
-- Name: messages_2025_12_24; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_24 FOR VALUES FROM ('2025-12-24 00:00:00') TO ('2025-12-25 00:00:00');


--
-- TOC entry 4451 (class 0 OID 0)
-- Name: messages_2025_12_25; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_25 FOR VALUES FROM ('2025-12-25 00:00:00') TO ('2025-12-26 00:00:00');


--
-- TOC entry 4452 (class 0 OID 0)
-- Name: messages_2025_12_26; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_26 FOR VALUES FROM ('2025-12-26 00:00:00') TO ('2025-12-27 00:00:00');


--
-- TOC entry 4462 (class 2604 OID 16510)
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- TOC entry 4576 (class 2604 OID 457070)
-- Name: genres id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres ALTER COLUMN id SET DEFAULT nextval('public.genres_id_seq'::regclass);


--
-- TOC entry 4577 (class 2604 OID 457071)
-- Name: people id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people ALTER COLUMN id SET DEFAULT nextval('public.people_id_seq'::regclass);


--
-- TOC entry 4850 (class 2606 OID 16829)
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- TOC entry 4804 (class 2606 OID 16531)
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 4873 (class 2606 OID 16935)
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- TOC entry 4828 (class 2606 OID 16953)
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- TOC entry 4830 (class 2606 OID 16963)
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- TOC entry 4802 (class 2606 OID 16524)
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- TOC entry 4852 (class 2606 OID 16822)
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- TOC entry 4848 (class 2606 OID 16810)
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- TOC entry 4840 (class 2606 OID 17003)
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- TOC entry 4842 (class 2606 OID 16797)
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- TOC entry 4886 (class 2606 OID 17062)
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- TOC entry 4888 (class 2606 OID 17060)
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- TOC entry 4890 (class 2606 OID 17058)
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- TOC entry 5073 (class 2606 OID 107899)
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- TOC entry 4883 (class 2606 OID 17022)
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- TOC entry 4894 (class 2606 OID 17084)
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- TOC entry 4896 (class 2606 OID 17086)
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- TOC entry 4877 (class 2606 OID 16988)
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4796 (class 2606 OID 16514)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4799 (class 2606 OID 16740)
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- TOC entry 4862 (class 2606 OID 16869)
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- TOC entry 4864 (class 2606 OID 16867)
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4869 (class 2606 OID 16883)
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- TOC entry 4807 (class 2606 OID 16537)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- TOC entry 4835 (class 2606 OID 16761)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4859 (class 2606 OID 16850)
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- TOC entry 4854 (class 2606 OID 16841)
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4789 (class 2606 OID 16923)
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- TOC entry 4791 (class 2606 OID 16501)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4985 (class 2606 OID 35104)
-- Name: activity_events activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5164 (class 2606 OID 287130)
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5205 (class 2606 OID 355953)
-- Name: admin_costs_settings admin_costs_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_costs_settings
    ADD CONSTRAINT admin_costs_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5171 (class 2606 OID 287161)
-- Name: admin_cron_registry admin_cron_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_cron_registry
    ADD CONSTRAINT admin_cron_registry_pkey PRIMARY KEY (jobname);


--
-- TOC entry 5161 (class 2606 OID 287120)
-- Name: app_admins app_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_admins
    ADD CONSTRAINT app_admins_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5056 (class 2606 OID 35403)
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (blocker_id, blocked_id);


--
-- TOC entry 4980 (class 2606 OID 35085)
-- Name: comment_likes comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_pkey PRIMARY KEY (comment_id, user_id);


--
-- TOC entry 4953 (class 2606 OID 34954)
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- TOC entry 5002 (class 2606 OID 35162)
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- TOC entry 4995 (class 2606 OID 55423)
-- Name: conversations conversations_direct_participant_ids_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_direct_participant_ids_key UNIQUE (direct_participant_ids);


--
-- TOC entry 4997 (class 2606 OID 35144)
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- TOC entry 5159 (class 2606 OID 285061)
-- Name: embedding_settings embedding_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embedding_settings
    ADD CONSTRAINT embedding_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4971 (class 2606 OID 35046)
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followed_id);


--
-- TOC entry 5038 (class 2606 OID 35309)
-- Name: genres genres_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_name_key UNIQUE (name);


--
-- TOC entry 5040 (class 2606 OID 35307)
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);


--
-- TOC entry 5042 (class 2606 OID 35311)
-- Name: genres genres_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_slug_key UNIQUE (slug);


--
-- TOC entry 5168 (class 2606 OID 287143)
-- Name: job_run_log job_run_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_run_log
    ADD CONSTRAINT job_run_log_pkey PRIMARY KEY (id);


--
-- TOC entry 4943 (class 2606 OID 34915)
-- Name: library_entries library_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.library_entries
    ADD CONSTRAINT library_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 4967 (class 2606 OID 35016)
-- Name: list_items list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.list_items
    ADD CONSTRAINT list_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4960 (class 2606 OID 34990)
-- Name: lists lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lists
    ADD CONSTRAINT lists_pkey PRIMARY KEY (id);


--
-- TOC entry 5109 (class 2606 OID 285191)
-- Name: media_embeddings media_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_embeddings
    ADD CONSTRAINT media_embeddings_pkey PRIMARY KEY (media_item_id, provider, model, dimensions, task);


--
-- TOC entry 5119 (class 2606 OID 146881)
-- Name: media_events media_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_events
    ADD CONSTRAINT media_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5128 (class 2606 OID 146902)
-- Name: media_feedback media_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_feedback
    ADD CONSTRAINT media_feedback_pkey PRIMARY KEY (user_id, media_item_id);


--
-- TOC entry 5203 (class 2606 OID 351756)
-- Name: media_genres media_genres_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_genres
    ADD CONSTRAINT media_genres_pkey PRIMARY KEY (media_item_id, genre_id);


--
-- TOC entry 5148 (class 2606 OID 150319)
-- Name: media_item_daily media_item_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_item_daily
    ADD CONSTRAINT media_item_daily_pkey PRIMARY KEY (day, media_item_id);


--
-- TOC entry 5151 (class 2606 OID 150331)
-- Name: media_item_daily_users media_item_daily_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_item_daily_users
    ADD CONSTRAINT media_item_daily_users_pkey PRIMARY KEY (day, media_item_id, user_id);


--
-- TOC entry 5087 (class 2606 OID 135421)
-- Name: media_items media_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5153 (class 2606 OID 154213)
-- Name: media_job_state media_job_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_job_state
    ADD CONSTRAINT media_job_state_pkey PRIMARY KEY (job_name);


--
-- TOC entry 5192 (class 2606 OID 295891)
-- Name: media_rank_feature_log media_rank_feature_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_rank_feature_log
    ADD CONSTRAINT media_rank_feature_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5188 (class 2606 OID 295880)
-- Name: media_rank_models media_rank_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_rank_models
    ADD CONSTRAINT media_rank_models_pkey PRIMARY KEY (model_name, version);


--
-- TOC entry 5177 (class 2606 OID 291582)
-- Name: media_rerank_cache media_rerank_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_rerank_cache
    ADD CONSTRAINT media_rerank_cache_pkey PRIMARY KEY (key);


--
-- TOC entry 5198 (class 2606 OID 325908)
-- Name: media_served media_served_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_served
    ADD CONSTRAINT media_served_pkey PRIMARY KEY (user_id, media_item_id);


--
-- TOC entry 5138 (class 2606 OID 285203)
-- Name: media_session_vectors media_session_vectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_session_vectors
    ADD CONSTRAINT media_session_vectors_pkey PRIMARY KEY (user_id, session_id, provider, model, dimensions, task);


--
-- TOC entry 5141 (class 2606 OID 146945)
-- Name: media_trending_scores media_trending_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_trending_scores
    ADD CONSTRAINT media_trending_scores_pkey PRIMARY KEY (media_item_id);


--
-- TOC entry 5185 (class 2606 OID 295857)
-- Name: media_user_centroids media_user_centroids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_user_centroids
    ADD CONSTRAINT media_user_centroids_pkey PRIMARY KEY (user_id, centroid, provider, model, dimensions, task);


--
-- TOC entry 5134 (class 2606 OID 285197)
-- Name: media_user_vectors media_user_vectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_user_vectors
    ADD CONSTRAINT media_user_vectors_pkey PRIMARY KEY (user_id, provider, model, dimensions, task);


--
-- TOC entry 5024 (class 2606 OID 35234)
-- Name: message_delivery_receipts message_delivery_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_delivery_receipts
    ADD CONSTRAINT message_delivery_receipts_pkey PRIMARY KEY (id);


--
-- TOC entry 5026 (class 2606 OID 130623)
-- Name: message_delivery_receipts message_delivery_receipts_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_delivery_receipts
    ADD CONSTRAINT message_delivery_receipts_unique UNIQUE (conversation_id, message_id, user_id);


--
-- TOC entry 5014 (class 2606 OID 35207)
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- TOC entry 5016 (class 2606 OID 35521)
-- Name: message_reactions message_reactions_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, emoji);


--
-- TOC entry 5033 (class 2606 OID 35258)
-- Name: message_read_receipts message_read_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_pkey PRIMARY KEY (conversation_id, user_id);


--
-- TOC entry 5008 (class 2606 OID 35186)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 5064 (class 2606 OID 48658)
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4992 (class 2606 OID 35126)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5103 (class 2606 OID 137062)
-- Name: omdb_cache omdb_cache_new_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.omdb_cache
    ADD CONSTRAINT omdb_cache_new_pk PRIMARY KEY (imdb_id);


--
-- TOC entry 5044 (class 2606 OID 35330)
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- TOC entry 4928 (class 2606 OID 24616)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 5213 (class 2606 OID 384875)
-- Name: profiles_public profiles_public_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles_public
    ADD CONSTRAINT profiles_public_pkey PRIMARY KEY (id);


--
-- TOC entry 4930 (class 2606 OID 24623)
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- TOC entry 4935 (class 2606 OID 34890)
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- TOC entry 5220 (class 2606 OID 446567)
-- Name: recommendation_impressions recommendation_impressions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_impressions
    ADD CONSTRAINT recommendation_impressions_pkey PRIMARY KEY (id);


--
-- TOC entry 5228 (class 2606 OID 446589)
-- Name: recommendation_interactions recommendation_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_interactions
    ADD CONSTRAINT recommendation_interactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4777 (class 2606 OID 459673)
-- Name: recommendation_interactions recommendation_interactions_type_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.recommendation_interactions
    ADD CONSTRAINT recommendation_interactions_type_check CHECK ((interaction_type = ANY (ARRAY['click'::text, 'watch'::text, 'rate'::text]))) NOT VALID;


--
-- TOC entry 5232 (class 2606 OID 446620)
-- Name: recommendation_performance recommendation_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_performance
    ADD CONSTRAINT recommendation_performance_pkey PRIMARY KEY (section, context_features);


--
-- TOC entry 5062 (class 2606 OID 35441)
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- TOC entry 4974 (class 2606 OID 35065)
-- Name: review_reactions review_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4976 (class 2606 OID 35519)
-- Name: review_reactions review_reactions_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_unique UNIQUE (review_id, user_id, emoji);


--
-- TOC entry 4947 (class 2606 OID 34941)
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- TOC entry 5099 (class 2606 OID 136531)
-- Name: tmdb_cache tmdb_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tmdb_cache
    ADD CONSTRAINT tmdb_cache_pkey PRIMARY KEY (kind, tmdb_id);


--
-- TOC entry 5058 (class 2606 OID 35426)
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5036 (class 2606 OID 35293)
-- Name: user_stats user_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5144 (class 2606 OID 146962)
-- Name: user_swipe_prefs user_swipe_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_swipe_prefs
    ADD CONSTRAINT user_swipe_prefs_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5046 (class 2606 OID 35372)
-- Name: user_tags user_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_pkey PRIMARY KEY (id);


--
-- TOC entry 5048 (class 2606 OID 35374)
-- Name: user_tags user_tags_unique_name_per_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_unique_name_per_user UNIQUE (user_id, name);


--
-- TOC entry 5052 (class 2606 OID 35385)
-- Name: user_title_tags user_title_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_title_tags
    ADD CONSTRAINT user_title_tags_pkey PRIMARY KEY (user_id, title_id, tag_id);


--
-- TOC entry 4922 (class 2606 OID 17483)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5157 (class 2606 OID 155047)
-- Name: messages_2025_12_20 messages_2025_12_20_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_20
    ADD CONSTRAINT messages_2025_12_20_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5174 (class 2606 OID 287368)
-- Name: messages_2025_12_21 messages_2025_12_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_21
    ADD CONSTRAINT messages_2025_12_21_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5182 (class 2606 OID 293913)
-- Name: messages_2025_12_22 messages_2025_12_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_22
    ADD CONSTRAINT messages_2025_12_22_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5208 (class 2606 OID 359530)
-- Name: messages_2025_12_23 messages_2025_12_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_23
    ADD CONSTRAINT messages_2025_12_23_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5211 (class 2606 OID 359542)
-- Name: messages_2025_12_24 messages_2025_12_24_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_24
    ADD CONSTRAINT messages_2025_12_24_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5216 (class 2606 OID 427408)
-- Name: messages_2025_12_25 messages_2025_12_25_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_25
    ADD CONSTRAINT messages_2025_12_25_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 5236 (class 2606 OID 463845)
-- Name: messages_2025_12_26 messages_2025_12_26_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2025_12_26
    ADD CONSTRAINT messages_2025_12_26_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 4902 (class 2606 OID 17147)
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- TOC entry 4899 (class 2606 OID 17120)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- TOC entry 4913 (class 2606 OID 17366)
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- TOC entry 4810 (class 2606 OID 16554)
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- TOC entry 4916 (class 2606 OID 17342)
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- TOC entry 4820 (class 2606 OID 16595)
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- TOC entry 4822 (class 2606 OID 16593)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4818 (class 2606 OID 16571)
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- TOC entry 4911 (class 2606 OID 17269)
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- TOC entry 4908 (class 2606 OID 17230)
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- TOC entry 4906 (class 2606 OID 17215)
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- TOC entry 4919 (class 2606 OID 17352)
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- TOC entry 4924 (class 2606 OID 20113)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- TOC entry 4926 (class 2606 OID 20120)
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- TOC entry 4805 (class 1259 OID 16532)
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- TOC entry 4779 (class 1259 OID 16750)
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4780 (class 1259 OID 16752)
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4781 (class 1259 OID 16753)
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4838 (class 1259 OID 16831)
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- TOC entry 4871 (class 1259 OID 16939)
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- TOC entry 4826 (class 1259 OID 16919)
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- TOC entry 6233 (class 0 OID 0)
-- Dependencies: 4826
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- TOC entry 4831 (class 1259 OID 16747)
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- TOC entry 4874 (class 1259 OID 16936)
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- TOC entry 5071 (class 1259 OID 107900)
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- TOC entry 4875 (class 1259 OID 16937)
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- TOC entry 4846 (class 1259 OID 16942)
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- TOC entry 4843 (class 1259 OID 16803)
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- TOC entry 4844 (class 1259 OID 16948)
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- TOC entry 4884 (class 1259 OID 17073)
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- TOC entry 4881 (class 1259 OID 17026)
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- TOC entry 4891 (class 1259 OID 17099)
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- TOC entry 4892 (class 1259 OID 17097)
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- TOC entry 4897 (class 1259 OID 17098)
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- TOC entry 4878 (class 1259 OID 16995)
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- TOC entry 4879 (class 1259 OID 16994)
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- TOC entry 4880 (class 1259 OID 16996)
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- TOC entry 4782 (class 1259 OID 16754)
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4783 (class 1259 OID 16751)
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4792 (class 1259 OID 16515)
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- TOC entry 4793 (class 1259 OID 16516)
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- TOC entry 4794 (class 1259 OID 16746)
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- TOC entry 4797 (class 1259 OID 16833)
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- TOC entry 4800 (class 1259 OID 16938)
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- TOC entry 4865 (class 1259 OID 16875)
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- TOC entry 4866 (class 1259 OID 16940)
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- TOC entry 4867 (class 1259 OID 16890)
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- TOC entry 4870 (class 1259 OID 16889)
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- TOC entry 4832 (class 1259 OID 16941)
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- TOC entry 4833 (class 1259 OID 17111)
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- TOC entry 4836 (class 1259 OID 16832)
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- TOC entry 4857 (class 1259 OID 16857)
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- TOC entry 4860 (class 1259 OID 16856)
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- TOC entry 4855 (class 1259 OID 16842)
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- TOC entry 4856 (class 1259 OID 17004)
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- TOC entry 4845 (class 1259 OID 17001)
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- TOC entry 4837 (class 1259 OID 16830)
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- TOC entry 4784 (class 1259 OID 16910)
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- TOC entry 6234 (class 0 OID 0)
-- Dependencies: 4784
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- TOC entry 4785 (class 1259 OID 16748)
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- TOC entry 4786 (class 1259 OID 16505)
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- TOC entry 4787 (class 1259 OID 16965)
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- TOC entry 4982 (class 1259 OID 411974)
-- Name: activity_events_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_events_created_at_id_idx ON public.activity_events USING btree (created_at DESC, id DESC);


--
-- TOC entry 4983 (class 1259 OID 466540)
-- Name: activity_events_media_item_fk_cover_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_events_media_item_fk_cover_idx ON public.activity_events USING btree (media_item_id);


--
-- TOC entry 4986 (class 1259 OID 411975)
-- Name: activity_events_user_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_events_user_created_at_id_idx ON public.activity_events USING btree (user_id, created_at DESC, id DESC);


--
-- TOC entry 5162 (class 1259 OID 287131)
-- Name: admin_audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log USING btree (created_at DESC);


--
-- TOC entry 5053 (class 1259 OID 53391)
-- Name: blocked_users_blocked_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX blocked_users_blocked_id_idx ON public.blocked_users USING btree (blocked_id);


--
-- TOC entry 5054 (class 1259 OID 53390)
-- Name: blocked_users_blocker_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX blocked_users_blocker_id_idx ON public.blocked_users USING btree (blocker_id);


--
-- TOC entry 4977 (class 1259 OID 383278)
-- Name: comment_likes_comment_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comment_likes_comment_id_created_at_idx ON public.comment_likes USING btree (comment_id, created_at DESC);


--
-- TOC entry 4978 (class 1259 OID 53398)
-- Name: comment_likes_comment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comment_likes_comment_id_idx ON public.comment_likes USING btree (comment_id);


--
-- TOC entry 4950 (class 1259 OID 53397)
-- Name: comments_parent_comment_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_parent_comment_id_created_at_idx ON public.comments USING btree (parent_comment_id, created_at);


--
-- TOC entry 4951 (class 1259 OID 383277)
-- Name: comments_parent_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_parent_created_at_idx ON public.comments USING btree (parent_comment_id, created_at DESC);


--
-- TOC entry 4954 (class 1259 OID 383276)
-- Name: comments_review_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_review_created_at_idx ON public.comments USING btree (review_id, created_at DESC);


--
-- TOC entry 4955 (class 1259 OID 53396)
-- Name: comments_review_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX comments_review_id_created_at_idx ON public.comments USING btree (review_id, created_at);


--
-- TOC entry 4999 (class 1259 OID 392384)
-- Name: conversation_participants_conversation_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conversation_participants_conversation_created_at_idx ON public.conversation_participants USING btree (conversation_id, created_at);


--
-- TOC entry 5000 (class 1259 OID 48779)
-- Name: conversation_participants_conversation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conversation_participants_conversation_id_idx ON public.conversation_participants USING btree (conversation_id);


--
-- TOC entry 5003 (class 1259 OID 48768)
-- Name: conversation_participants_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conversation_participants_user_id_idx ON public.conversation_participants USING btree (user_id);


--
-- TOC entry 4968 (class 1259 OID 48776)
-- Name: follows_followed_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX follows_followed_id_idx ON public.follows USING btree (followed_id);


--
-- TOC entry 4969 (class 1259 OID 48775)
-- Name: follows_follower_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX follows_follower_id_idx ON public.follows USING btree (follower_id);


--
-- TOC entry 4987 (class 1259 OID 35118)
-- Name: idx_activity_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_created_at ON public.activity_events USING btree (created_at);


--
-- TOC entry 4988 (class 1259 OID 52796)
-- Name: idx_activity_events_related_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_events_related_user_id ON public.activity_events USING btree (related_user_id);


--
-- TOC entry 4989 (class 1259 OID 35117)
-- Name: idx_activity_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_user_id ON public.activity_events USING btree (user_id);


--
-- TOC entry 4981 (class 1259 OID 52798)
-- Name: idx_comment_likes_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comment_likes_user_id ON public.comment_likes USING btree (user_id);


--
-- TOC entry 4956 (class 1259 OID 52799)
-- Name: idx_comments_parent_comment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_parent_comment_id ON public.comments USING btree (parent_comment_id);


--
-- TOC entry 4957 (class 1259 OID 52800)
-- Name: idx_comments_review_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_review_id ON public.comments USING btree (review_id);


--
-- TOC entry 4958 (class 1259 OID 52801)
-- Name: idx_comments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_user_id ON public.comments USING btree (user_id);


--
-- TOC entry 4998 (class 1259 OID 52802)
-- Name: idx_conversations_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_created_by ON public.conversations USING btree (created_by);


--
-- TOC entry 4940 (class 1259 OID 52805)
-- Name: idx_library_entries_title_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_library_entries_title_id ON public.library_entries USING btree (title_id);


--
-- TOC entry 4941 (class 1259 OID 35525)
-- Name: idx_library_entries_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_library_entries_user_status ON public.library_entries USING btree (user_id, status);


--
-- TOC entry 4963 (class 1259 OID 52806)
-- Name: idx_list_items_list_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_list_items_list_id ON public.list_items USING btree (list_id);


--
-- TOC entry 4964 (class 1259 OID 52807)
-- Name: idx_list_items_title_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_list_items_title_id ON public.list_items USING btree (title_id);


--
-- TOC entry 5104 (class 1259 OID 285036)
-- Name: idx_media_embeddings_profile_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_embeddings_profile_item ON public.media_embeddings USING btree (provider, model, dimensions, task, media_item_id);


--
-- TOC entry 5200 (class 1259 OID 351767)
-- Name: idx_media_genres_genre_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_genres_genre_id ON public.media_genres USING btree (genre_id);


--
-- TOC entry 5201 (class 1259 OID 351768)
-- Name: idx_media_genres_media_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_genres_media_item_id ON public.media_genres USING btree (media_item_id);


--
-- TOC entry 5136 (class 1259 OID 285146)
-- Name: idx_media_session_vectors_profile_user_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_session_vectors_profile_user_session ON public.media_session_vectors USING btree (provider, model, dimensions, task, user_id, session_id);


--
-- TOC entry 5132 (class 1259 OID 285145)
-- Name: idx_media_user_vectors_profile_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_user_vectors_profile_user ON public.media_user_vectors USING btree (provider, model, dimensions, task, user_id);


--
-- TOC entry 5018 (class 1259 OID 35250)
-- Name: idx_message_delivery_conv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_delivery_conv ON public.message_delivery_receipts USING btree (conversation_id);


--
-- TOC entry 5019 (class 1259 OID 35251)
-- Name: idx_message_delivery_msg; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_delivery_msg ON public.message_delivery_receipts USING btree (message_id);


--
-- TOC entry 5020 (class 1259 OID 52808)
-- Name: idx_message_delivery_receipts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_delivery_receipts_user_id ON public.message_delivery_receipts USING btree (user_id);


--
-- TOC entry 5009 (class 1259 OID 35225)
-- Name: idx_message_reactions_conv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_reactions_conv ON public.message_reactions USING btree (conversation_id);


--
-- TOC entry 5010 (class 1259 OID 52809)
-- Name: idx_message_reactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_reactions_user_id ON public.message_reactions USING btree (user_id);


--
-- TOC entry 5027 (class 1259 OID 52810)
-- Name: idx_message_read_receipts_last_read_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_read_receipts_last_read_message_id ON public.message_read_receipts USING btree (last_read_message_id);


--
-- TOC entry 5004 (class 1259 OID 35199)
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- TOC entry 5005 (class 1259 OID 52812)
-- Name: idx_messages_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_user_id ON public.messages USING btree (user_id);


--
-- TOC entry 4990 (class 1259 OID 52813)
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- TOC entry 4933 (class 1259 OID 35524)
-- Name: idx_ratings_title_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ratings_title_id_created_at ON public.ratings USING btree (title_id, created_at DESC);


--
-- TOC entry 5028 (class 1259 OID 35274)
-- Name: idx_read_receipts_conv; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_read_receipts_conv ON public.message_read_receipts USING btree (conversation_id);


--
-- TOC entry 5059 (class 1259 OID 52814)
-- Name: idx_reports_reporter_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_reporter_id ON public.reports USING btree (reporter_id);


--
-- TOC entry 5060 (class 1259 OID 52815)
-- Name: idx_reports_resolved_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_resolved_by ON public.reports USING btree (resolved_by);


--
-- TOC entry 4972 (class 1259 OID 52816)
-- Name: idx_review_reactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_review_reactions_user_id ON public.review_reactions USING btree (user_id);


--
-- TOC entry 5049 (class 1259 OID 52819)
-- Name: idx_user_title_tags_tag_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_title_tags_tag_id ON public.user_title_tags USING btree (tag_id);


--
-- TOC entry 5050 (class 1259 OID 35396)
-- Name: idx_user_title_tags_title_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_title_tags_title_id ON public.user_title_tags USING btree (title_id);


--
-- TOC entry 5165 (class 1259 OID 287146)
-- Name: job_run_log_job_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_run_log_job_name_idx ON public.job_run_log USING btree (job_name);


--
-- TOC entry 5166 (class 1259 OID 287145)
-- Name: job_run_log_ok_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_run_log_ok_idx ON public.job_run_log USING btree (ok);


--
-- TOC entry 5169 (class 1259 OID 287144)
-- Name: job_run_log_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_run_log_started_at_idx ON public.job_run_log USING btree (started_at DESC);


--
-- TOC entry 4944 (class 1259 OID 48785)
-- Name: library_entries_user_status_updated_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX library_entries_user_status_updated_idx ON public.library_entries USING btree (user_id, status, updated_at DESC);


--
-- TOC entry 4945 (class 1259 OID 34916)
-- Name: library_entries_user_title_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX library_entries_user_title_unique ON public.library_entries USING btree (user_id, title_id);


--
-- TOC entry 4965 (class 1259 OID 53402)
-- Name: list_items_list_id_position_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX list_items_list_id_position_idx ON public.list_items USING btree (list_id, "position");


--
-- TOC entry 4961 (class 1259 OID 53401)
-- Name: lists_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lists_user_id_created_at_idx ON public.lists USING btree (user_id, created_at);


--
-- TOC entry 4962 (class 1259 OID 34992)
-- Name: lists_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lists_user_id_idx ON public.lists USING btree (user_id);


--
-- TOC entry 5105 (class 1259 OID 146848)
-- Name: media_embeddings_hnsw_cosine; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_embeddings_hnsw_cosine ON public.media_embeddings USING hnsw (embedding extensions.vector_cosine_ops);


--
-- TOC entry 5106 (class 1259 OID 286721)
-- Name: media_embeddings_media_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_embeddings_media_item_id_idx ON public.media_embeddings USING btree (media_item_id);


--
-- TOC entry 5107 (class 1259 OID 153781)
-- Name: media_embeddings_model_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_embeddings_model_idx ON public.media_embeddings USING btree (model);


--
-- TOC entry 5110 (class 1259 OID 286723)
-- Name: media_embeddings_provider_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_embeddings_provider_idx ON public.media_embeddings USING btree (provider);


--
-- TOC entry 5111 (class 1259 OID 153780)
-- Name: media_embeddings_task_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_embeddings_task_idx ON public.media_embeddings USING btree (task);


--
-- TOC entry 5112 (class 1259 OID 153779)
-- Name: media_embeddings_updated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_embeddings_updated_at_idx ON public.media_embeddings USING btree (updated_at);


--
-- TOC entry 5113 (class 1259 OID 342893)
-- Name: media_events_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_created_at_idx ON public.media_events USING btree (created_at);


--
-- TOC entry 5114 (class 1259 OID 150303)
-- Name: media_events_event_day_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_event_day_idx ON public.media_events USING btree (event_day DESC);


--
-- TOC entry 5115 (class 1259 OID 296018)
-- Name: media_events_impression_user_item_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_impression_user_item_time ON public.media_events USING btree (user_id, media_item_id, created_at DESC) WHERE (event_type = 'impression'::public.media_event_type);


--
-- TOC entry 5116 (class 1259 OID 150304)
-- Name: media_events_item_day_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_item_day_idx ON public.media_events USING btree (media_item_id, event_day DESC);


--
-- TOC entry 5117 (class 1259 OID 146893)
-- Name: media_events_item_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_item_time_idx ON public.media_events USING btree (media_item_id, created_at DESC);


--
-- TOC entry 5120 (class 1259 OID 146894)
-- Name: media_events_type_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_type_time_idx ON public.media_events USING btree (event_type, created_at DESC);


--
-- TOC entry 5121 (class 1259 OID 152377)
-- Name: media_events_user_client_event_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX media_events_user_client_event_uq ON public.media_events USING btree (user_id, client_event_id);


--
-- TOC entry 5122 (class 1259 OID 411909)
-- Name: media_events_user_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_user_created_at_idx ON public.media_events USING btree (user_id, created_at DESC);


--
-- TOC entry 5123 (class 1259 OID 152378)
-- Name: media_events_user_dedupe_key_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX media_events_user_dedupe_key_uq ON public.media_events USING btree (user_id, dedupe_key);


--
-- TOC entry 5124 (class 1259 OID 459672)
-- Name: media_events_user_item_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_user_item_time_idx ON public.media_events USING btree (user_id, media_item_id, created_at DESC);


--
-- TOC entry 5125 (class 1259 OID 147328)
-- Name: media_events_user_session_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_events_user_session_time_idx ON public.media_events USING btree (user_id, session_id, created_at DESC);


--
-- TOC entry 5126 (class 1259 OID 154664)
-- Name: media_feedback_media_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_feedback_media_item_id_idx ON public.media_feedback USING btree (media_item_id);


--
-- TOC entry 5129 (class 1259 OID 296103)
-- Name: media_feedback_user_impr; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_feedback_user_impr ON public.media_feedback USING btree (user_id, last_impression_at DESC);


--
-- TOC entry 5130 (class 1259 OID 153347)
-- Name: media_feedback_user_item_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_feedback_user_item_idx ON public.media_feedback USING btree (user_id, media_item_id);


--
-- TOC entry 5131 (class 1259 OID 146913)
-- Name: media_feedback_user_last_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_feedback_user_last_action_idx ON public.media_feedback USING btree (user_id, last_action_at DESC);


--
-- TOC entry 5145 (class 1259 OID 150326)
-- Name: media_item_daily_day_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_item_daily_day_idx ON public.media_item_daily USING btree (day DESC);


--
-- TOC entry 5146 (class 1259 OID 150325)
-- Name: media_item_daily_item_day_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_item_daily_item_day_idx ON public.media_item_daily USING btree (media_item_id, day DESC);


--
-- TOC entry 5149 (class 1259 OID 150337)
-- Name: media_item_daily_users_item_day_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_item_daily_users_item_day_idx ON public.media_item_daily_users USING btree (media_item_id, day DESC);


--
-- TOC entry 5074 (class 1259 OID 146823)
-- Name: media_items_imdb_id_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX media_items_imdb_id_uniq ON public.media_items USING btree (omdb_imdb_id) WHERE (omdb_imdb_id IS NOT NULL);


--
-- TOC entry 5075 (class 1259 OID 146824)
-- Name: media_items_kind_completeness_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_kind_completeness_idx ON public.media_items USING btree (kind, completeness DESC);


--
-- TOC entry 5076 (class 1259 OID 135423)
-- Name: media_items_kind_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_kind_idx ON public.media_items USING btree (kind);


--
-- TOC entry 5077 (class 1259 OID 446525)
-- Name: media_items_kind_release_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_kind_release_idx ON public.media_items USING btree (kind, tmdb_release_date DESC NULLS LAST);


--
-- TOC entry 5078 (class 1259 OID 390652)
-- Name: media_items_kind_tmdb_id_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX media_items_kind_tmdb_id_uq ON public.media_items USING btree (kind, tmdb_id);


--
-- TOC entry 5079 (class 1259 OID 137809)
-- Name: media_items_omdb_backfill_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_backfill_idx ON public.media_items USING btree (omdb_status, omdb_fetched_at) WHERE (omdb_imdb_id IS NOT NULL);


--
-- TOC entry 5080 (class 1259 OID 146325)
-- Name: media_items_omdb_error_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_error_idx ON public.media_items USING btree (omdb_error);


--
-- TOC entry 5081 (class 1259 OID 148510)
-- Name: media_items_omdb_imdb_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_imdb_id_idx ON public.media_items USING btree (omdb_imdb_id);


--
-- TOC entry 5082 (class 1259 OID 148509)
-- Name: media_items_omdb_imdb_rating_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_imdb_rating_idx ON public.media_items USING btree (omdb_imdb_rating);


--
-- TOC entry 5083 (class 1259 OID 146331)
-- Name: media_items_omdb_rating_internet_movie_database_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_rating_internet_movie_database_idx ON public.media_items USING btree (omdb_rating_internet_movie_database);


--
-- TOC entry 5084 (class 1259 OID 445557)
-- Name: media_items_omdb_title_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_title_trgm_idx ON public.media_items USING gin (omdb_title extensions.gin_trgm_ops);


--
-- TOC entry 5085 (class 1259 OID 146328)
-- Name: media_items_omdb_website_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_omdb_website_idx ON public.media_items USING btree (omdb_website);


--
-- TOC entry 5088 (class 1259 OID 146827)
-- Name: media_items_release_dates_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_release_dates_idx ON public.media_items USING btree (tmdb_release_date, tmdb_first_air_date);


--
-- TOC entry 5089 (class 1259 OID 445556)
-- Name: media_items_search_vector_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_search_vector_idx ON public.media_items USING gin (search_vector);


--
-- TOC entry 5090 (class 1259 OID 137808)
-- Name: media_items_tmdb_backfill_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_backfill_idx ON public.media_items USING btree (tmdb_status, tmdb_fetched_at) WHERE (tmdb_id IS NOT NULL);


--
-- TOC entry 5091 (class 1259 OID 146327)
-- Name: media_items_tmdb_error_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_error_idx ON public.media_items USING btree (tmdb_error);


--
-- TOC entry 5092 (class 1259 OID 135424)
-- Name: media_items_tmdb_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_id_idx ON public.media_items USING btree (tmdb_id);


--
-- TOC entry 5093 (class 1259 OID 135896)
-- Name: media_items_tmdb_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_name_idx ON public.media_items USING btree (tmdb_name);


--
-- TOC entry 5094 (class 1259 OID 146825)
-- Name: media_items_tmdb_popularity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_popularity_idx ON public.media_items USING btree (tmdb_popularity DESC);


--
-- TOC entry 5095 (class 1259 OID 277975)
-- Name: media_items_tmdb_runtime_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_runtime_idx ON public.media_items USING btree (tmdb_runtime);


--
-- TOC entry 5096 (class 1259 OID 361173)
-- Name: media_items_tmdb_title_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_title_trgm_idx ON public.media_items USING gin (tmdb_title extensions.gin_trgm_ops);


--
-- TOC entry 5097 (class 1259 OID 146826)
-- Name: media_items_tmdb_vote_count_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_items_tmdb_vote_count_idx ON public.media_items USING btree (tmdb_vote_count DESC);


--
-- TOC entry 5154 (class 1259 OID 154214)
-- Name: media_job_state_updated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_job_state_updated_at_idx ON public.media_job_state USING btree (updated_at DESC);


--
-- TOC entry 5189 (class 1259 OID 343659)
-- Name: media_rank_feature_log_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rank_feature_log_created_at_idx ON public.media_rank_feature_log USING btree (created_at);


--
-- TOC entry 5190 (class 1259 OID 342634)
-- Name: media_rank_feature_log_kind_filter_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rank_feature_log_kind_filter_idx ON public.media_rank_feature_log USING btree (kind_filter);


--
-- TOC entry 5193 (class 1259 OID 342635)
-- Name: media_rank_feature_log_position_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rank_feature_log_position_idx ON public.media_rank_feature_log USING btree ("position");


--
-- TOC entry 5194 (class 1259 OID 337492)
-- Name: media_rank_feature_log_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX media_rank_feature_log_uniq ON public.media_rank_feature_log USING btree (user_id, deck_id, media_item_id);


--
-- TOC entry 5195 (class 1259 OID 342632)
-- Name: media_rank_feature_log_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rank_feature_log_user_id_idx ON public.media_rank_feature_log USING btree (user_id);


--
-- TOC entry 5196 (class 1259 OID 295892)
-- Name: media_rank_feature_log_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rank_feature_log_user_time ON public.media_rank_feature_log USING btree (user_id, created_at DESC);


--
-- TOC entry 5175 (class 1259 OID 291583)
-- Name: media_rerank_cache_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rerank_cache_expires_at_idx ON public.media_rerank_cache USING btree (expires_at);


--
-- TOC entry 5178 (class 1259 OID 292103)
-- Name: media_rerank_cache_updated_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rerank_cache_updated_at_idx ON public.media_rerank_cache USING btree (updated_at);


--
-- TOC entry 5179 (class 1259 OID 292105)
-- Name: media_rerank_cache_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_rerank_cache_user_id_idx ON public.media_rerank_cache USING btree (user_id);


--
-- TOC entry 5199 (class 1259 OID 325909)
-- Name: media_served_user_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_served_user_time_idx ON public.media_served USING btree (user_id, served_at DESC);


--
-- TOC entry 5139 (class 1259 OID 153114)
-- Name: media_session_vectors_user_updated_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_session_vectors_user_updated_idx ON public.media_session_vectors USING btree (user_id, updated_at DESC);


--
-- TOC entry 5142 (class 1259 OID 147286)
-- Name: media_trending_scores_score_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_trending_scores_score_idx ON public.media_trending_scores USING btree (score_72h DESC);


--
-- TOC entry 5183 (class 1259 OID 340409)
-- Name: media_user_centroids_muc_item_fkey_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_user_centroids_muc_item_fkey_idx ON public.media_user_centroids USING btree (exemplar_media_item_id);


--
-- TOC entry 5186 (class 1259 OID 295868)
-- Name: media_user_centroids_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_user_centroids_user_idx ON public.media_user_centroids USING btree (user_id, updated_at DESC);


--
-- TOC entry 5135 (class 1259 OID 153115)
-- Name: media_user_vectors_updated_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_user_vectors_updated_idx ON public.media_user_vectors USING btree (updated_at DESC);


--
-- TOC entry 5021 (class 1259 OID 384911)
-- Name: message_delivery_receipts_conv_msg_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_delivery_receipts_conv_msg_user_idx ON public.message_delivery_receipts USING btree (conversation_id, message_id, user_id);


--
-- TOC entry 5022 (class 1259 OID 48783)
-- Name: message_delivery_receipts_conversation_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_delivery_receipts_conversation_created_idx ON public.message_delivery_receipts USING btree (conversation_id, created_at);


--
-- TOC entry 5011 (class 1259 OID 53389)
-- Name: message_reactions_conversation_message_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_reactions_conversation_message_idx ON public.message_reactions USING btree (conversation_id, message_id);


--
-- TOC entry 5012 (class 1259 OID 361175)
-- Name: message_reactions_message_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_reactions_message_id_idx ON public.message_reactions USING btree (message_id);


--
-- TOC entry 5017 (class 1259 OID 48772)
-- Name: message_reactions_user_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX message_reactions_user_unique_idx ON public.message_reactions USING btree (conversation_id, message_id, user_id, emoji);


--
-- TOC entry 5029 (class 1259 OID 384910)
-- Name: message_read_receipts_conv_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_read_receipts_conv_user_idx ON public.message_read_receipts USING btree (conversation_id, user_id);


--
-- TOC entry 5030 (class 1259 OID 53392)
-- Name: message_read_receipts_conversation_last_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_read_receipts_conversation_last_read_idx ON public.message_read_receipts USING btree (conversation_id, last_read_at DESC);


--
-- TOC entry 5031 (class 1259 OID 53393)
-- Name: message_read_receipts_conversation_message_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_read_receipts_conversation_message_idx ON public.message_read_receipts USING btree (conversation_id, last_read_message_id);


--
-- TOC entry 5034 (class 1259 OID 48780)
-- Name: message_read_receipts_user_conversation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX message_read_receipts_user_conversation_idx ON public.message_read_receipts USING btree (user_id, conversation_id);


--
-- TOC entry 5006 (class 1259 OID 48769)
-- Name: messages_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX messages_conversation_id_created_at_idx ON public.messages USING btree (conversation_id, created_at DESC);


--
-- TOC entry 4993 (class 1259 OID 53404)
-- Name: notifications_user_unread_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_unread_created_at_idx ON public.notifications USING btree (user_id, created_at DESC) WHERE (is_read = false);


--
-- TOC entry 5100 (class 1259 OID 283655)
-- Name: omdb_cache_fetched_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX omdb_cache_fetched_at_idx ON public.omdb_cache USING btree (fetched_at);


--
-- TOC entry 5101 (class 1259 OID 137064)
-- Name: omdb_cache_kind_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX omdb_cache_kind_idx ON public.omdb_cache USING btree (kind);


--
-- TOC entry 4931 (class 1259 OID 384881)
-- Name: profiles_username_lower_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_username_lower_uq ON public.profiles USING btree (lower(username)) WHERE (username IS NOT NULL);


--
-- TOC entry 4932 (class 1259 OID 361172)
-- Name: profiles_username_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_username_trgm_idx ON public.profiles USING gin (username extensions.gin_trgm_ops);


--
-- TOC entry 4936 (class 1259 OID 446528)
-- Name: ratings_title_rating_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ratings_title_rating_idx ON public.ratings USING btree (title_id, rating DESC);


--
-- TOC entry 4937 (class 1259 OID 48784)
-- Name: ratings_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ratings_user_id_created_at_idx ON public.ratings USING btree (user_id, created_at DESC);


--
-- TOC entry 4938 (class 1259 OID 446524)
-- Name: ratings_user_rating_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ratings_user_rating_created_idx ON public.ratings USING btree (user_id, rating DESC, created_at DESC);


--
-- TOC entry 4939 (class 1259 OID 34891)
-- Name: ratings_user_title_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ratings_user_title_unique ON public.ratings USING btree (user_id, title_id);


--
-- TOC entry 5217 (class 1259 OID 459670)
-- Name: recommendation_impressions_context_gin_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_impressions_context_gin_idx ON public.recommendation_impressions USING gin (context_features jsonb_path_ops);


--
-- TOC entry 5218 (class 1259 OID 466541)
-- Name: recommendation_impressions_media_item_id_fkey_cover_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_impressions_media_item_id_fkey_cover_idx ON public.recommendation_impressions USING btree (media_item_id);


--
-- TOC entry 5221 (class 1259 OID 446580)
-- Name: recommendation_impressions_section_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_impressions_section_idx ON public.recommendation_impressions USING btree (section, created_at DESC);


--
-- TOC entry 5222 (class 1259 OID 446579)
-- Name: recommendation_impressions_session_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_impressions_session_idx ON public.recommendation_impressions USING btree (session_id, created_at DESC);


--
-- TOC entry 5223 (class 1259 OID 446578)
-- Name: recommendation_impressions_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_impressions_user_created_idx ON public.recommendation_impressions USING btree (user_id, created_at DESC);


--
-- TOC entry 5224 (class 1259 OID 457254)
-- Name: recommendation_impressions_user_item_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_impressions_user_item_time_idx ON public.recommendation_impressions USING btree (user_id, media_item_id, created_at DESC);


--
-- TOC entry 5225 (class 1259 OID 446605)
-- Name: recommendation_interactions_impression_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_interactions_impression_idx ON public.recommendation_interactions USING btree (impression_id);


--
-- TOC entry 5226 (class 1259 OID 466542)
-- Name: recommendation_interactions_media_item_id_fkey_cover_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_interactions_media_item_id_fkey_cover_idx ON public.recommendation_interactions USING btree (media_item_id);


--
-- TOC entry 5229 (class 1259 OID 446606)
-- Name: recommendation_interactions_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_interactions_user_created_idx ON public.recommendation_interactions USING btree (user_id, created_at DESC);


--
-- TOC entry 5230 (class 1259 OID 459671)
-- Name: recommendation_performance_context_gin_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_performance_context_gin_idx ON public.recommendation_performance USING gin (context_features jsonb_path_ops);


--
-- TOC entry 5233 (class 1259 OID 446621)
-- Name: recommendation_performance_section_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recommendation_performance_section_idx ON public.recommendation_performance USING btree (section);


--
-- TOC entry 4948 (class 1259 OID 53399)
-- Name: reviews_title_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reviews_title_id_created_at_idx ON public.reviews USING btree (title_id, created_at);


--
-- TOC entry 4949 (class 1259 OID 34943)
-- Name: reviews_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reviews_user_id_idx ON public.reviews USING btree (user_id);


--
-- TOC entry 4900 (class 1259 OID 17484)
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- TOC entry 4920 (class 1259 OID 17485)
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5155 (class 1259 OID 155048)
-- Name: messages_2025_12_20_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_20_inserted_at_topic_idx ON realtime.messages_2025_12_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5172 (class 1259 OID 287369)
-- Name: messages_2025_12_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_21_inserted_at_topic_idx ON realtime.messages_2025_12_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5180 (class 1259 OID 293914)
-- Name: messages_2025_12_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_22_inserted_at_topic_idx ON realtime.messages_2025_12_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5206 (class 1259 OID 359531)
-- Name: messages_2025_12_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_23_inserted_at_topic_idx ON realtime.messages_2025_12_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5209 (class 1259 OID 359543)
-- Name: messages_2025_12_24_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_24_inserted_at_topic_idx ON realtime.messages_2025_12_24 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5214 (class 1259 OID 427409)
-- Name: messages_2025_12_25_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_25_inserted_at_topic_idx ON realtime.messages_2025_12_25 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 5234 (class 1259 OID 463846)
-- Name: messages_2025_12_26_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2025_12_26_inserted_at_topic_idx ON realtime.messages_2025_12_26 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 4903 (class 1259 OID 17386)
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- TOC entry 4808 (class 1259 OID 16560)
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- TOC entry 4811 (class 1259 OID 16582)
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- TOC entry 4914 (class 1259 OID 17367)
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- TOC entry 4904 (class 1259 OID 17241)
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- TOC entry 4812 (class 1259 OID 17287)
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- TOC entry 4813 (class 1259 OID 17206)
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- TOC entry 4814 (class 1259 OID 17291)
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- TOC entry 4909 (class 1259 OID 17292)
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- TOC entry 4815 (class 1259 OID 16583)
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- TOC entry 4816 (class 1259 OID 17290)
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- TOC entry 4917 (class 1259 OID 17358)
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- TOC entry 5237 (class 0 OID 0)
-- Name: messages_2025_12_20_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_20_inserted_at_topic_idx;


--
-- TOC entry 5238 (class 0 OID 0)
-- Name: messages_2025_12_20_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_20_pkey;


--
-- TOC entry 5239 (class 0 OID 0)
-- Name: messages_2025_12_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_21_inserted_at_topic_idx;


--
-- TOC entry 5240 (class 0 OID 0)
-- Name: messages_2025_12_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_21_pkey;


--
-- TOC entry 5241 (class 0 OID 0)
-- Name: messages_2025_12_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_22_inserted_at_topic_idx;


--
-- TOC entry 5242 (class 0 OID 0)
-- Name: messages_2025_12_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_22_pkey;


--
-- TOC entry 5243 (class 0 OID 0)
-- Name: messages_2025_12_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_23_inserted_at_topic_idx;


--
-- TOC entry 5244 (class 0 OID 0)
-- Name: messages_2025_12_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_23_pkey;


--
-- TOC entry 5245 (class 0 OID 0)
-- Name: messages_2025_12_24_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_24_inserted_at_topic_idx;


--
-- TOC entry 5246 (class 0 OID 0)
-- Name: messages_2025_12_24_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_24_pkey;


--
-- TOC entry 5247 (class 0 OID 0)
-- Name: messages_2025_12_25_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_25_inserted_at_topic_idx;


--
-- TOC entry 5248 (class 0 OID 0)
-- Name: messages_2025_12_25_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_25_pkey;


--
-- TOC entry 5249 (class 0 OID 0)
-- Name: messages_2025_12_26_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_26_inserted_at_topic_idx;


--
-- TOC entry 5250 (class 0 OID 0)
-- Name: messages_2025_12_26_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_26_pkey;


--
-- TOC entry 5340 (class 2620 OID 457072)
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- TOC entry 5341 (class 2620 OID 457073)
-- Name: users trg_auth_user_updated; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER trg_auth_user_updated AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();


--
-- TOC entry 5356 (class 2620 OID 457074)
-- Name: comments set_comments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5354 (class 2620 OID 457075)
-- Name: library_entries set_library_entries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_library_entries_updated_at BEFORE UPDATE ON public.library_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5358 (class 2620 OID 457076)
-- Name: list_items set_list_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_list_items_updated_at BEFORE UPDATE ON public.list_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5357 (class 2620 OID 457077)
-- Name: lists set_lists_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_lists_updated_at BEFORE UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5380 (class 2620 OID 457078)
-- Name: media_rerank_cache set_media_rerank_cache_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_media_rerank_cache_updated_at BEFORE UPDATE ON public.media_rerank_cache FOR EACH ROW EXECUTE FUNCTION public.set_media_rerank_cache_updated_at();


--
-- TOC entry 5350 (class 2620 OID 457079)
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5353 (class 2620 OID 457080)
-- Name: ratings set_ratings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_ratings_updated_at BEFORE UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5355 (class 2620 OID 457081)
-- Name: reviews set_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5371 (class 2620 OID 457082)
-- Name: media_items trg_audit_media_items_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_media_items_delete BEFORE DELETE ON public.media_items FOR EACH ROW EXECUTE FUNCTION public.trg_audit_media_items_delete_func();


--
-- TOC entry 5351 (class 2620 OID 457083)
-- Name: profiles trg_audit_profiles_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_profiles_delete BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_audit_profiles_delete_func();


--
-- TOC entry 5361 (class 2620 OID 457084)
-- Name: conversation_participants trg_bump_conversation_on_participant_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bump_conversation_on_participant_change AFTER INSERT OR DELETE ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_participant_change();


--
-- TOC entry 5362 (class 2620 OID 457085)
-- Name: messages trg_bump_conversation_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bump_conversation_updated_at AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_updated_at();


--
-- TOC entry 5359 (class 2620 OID 457086)
-- Name: conversations trg_canonicalize_direct_participant_ids; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_canonicalize_direct_participant_ids BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.canonicalize_direct_participant_ids();


--
-- TOC entry 5360 (class 2620 OID 457087)
-- Name: conversations trg_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5378 (class 2620 OID 457088)
-- Name: embedding_settings trg_embedding_settings_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_embedding_settings_touch BEFORE UPDATE ON public.embedding_settings FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();


--
-- TOC entry 5363 (class 2620 OID 457089)
-- Name: messages trg_enforce_message_payload_safety; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_enforce_message_payload_safety BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enforce_message_payload_safety();


--
-- TOC entry 5367 (class 2620 OID 457090)
-- Name: message_reactions trg_enforce_reaction_message_scope_v1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_enforce_reaction_message_scope_v1 BEFORE INSERT OR UPDATE ON public.message_reactions FOR EACH ROW EXECUTE FUNCTION public.enforce_reaction_message_scope_v1();


--
-- TOC entry 5381 (class 2620 OID 457250)
-- Name: recommendation_impressions trg_increment_recommendation_impressions; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_increment_recommendation_impressions AFTER INSERT ON public.recommendation_impressions FOR EACH ROW EXECUTE FUNCTION public.increment_recommendation_impressions_performance();


--
-- TOC entry 5379 (class 2620 OID 457091)
-- Name: job_run_log trg_job_run_log_coalesce_total_tokens; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_job_run_log_coalesce_total_tokens BEFORE INSERT OR UPDATE ON public.job_run_log FOR EACH ROW EXECUTE FUNCTION public._trg_job_run_log_coalesce_total_tokens();


--
-- TOC entry 5376 (class 2620 OID 457092)
-- Name: media_events trg_media_events_apply_daily_rollup; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_media_events_apply_daily_rollup AFTER INSERT ON public.media_events FOR EACH ROW EXECUTE FUNCTION public.apply_media_event_to_daily_rollup();


--
-- TOC entry 5377 (class 2620 OID 457093)
-- Name: media_events trg_media_events_apply_feedback; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_media_events_apply_feedback AFTER INSERT ON public.media_events FOR EACH ROW EXECUTE FUNCTION public.apply_media_event_to_feedback();


--
-- TOC entry 5372 (class 2620 OID 457094)
-- Name: media_items trg_media_items_fts; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_media_items_fts BEFORE INSERT OR UPDATE OF tmdb_title, tmdb_name, omdb_title, tmdb_original_title, tmdb_original_name, tmdb_tagline, tmdb_overview, omdb_plot ON public.media_items FOR EACH ROW EXECUTE FUNCTION public.trg_media_items_fts_sync();


--
-- TOC entry 5373 (class 2620 OID 457095)
-- Name: media_items trg_media_items_promote_kind; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_media_items_promote_kind BEFORE INSERT OR UPDATE OF tmdb_media_type, omdb_type, kind, tmdb_id, omdb_imdb_id ON public.media_items FOR EACH ROW EXECUTE FUNCTION public.media_items_promote_kind();


--
-- TOC entry 5374 (class 2620 OID 457096)
-- Name: media_items trg_media_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_media_items_set_updated_at BEFORE UPDATE ON public.media_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5364 (class 2620 OID 457097)
-- Name: messages trg_messages_set_sender_id_v1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_messages_set_sender_id_v1 BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_set_sender_id_v1();


--
-- TOC entry 5365 (class 2620 OID 457098)
-- Name: messages trg_prevent_message_conversation_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_message_conversation_change BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_message_conversation_change();


--
-- TOC entry 5368 (class 2620 OID 457099)
-- Name: message_reactions trg_reaction_conv_match; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_reaction_conv_match BEFORE INSERT OR UPDATE ON public.message_reactions FOR EACH ROW EXECUTE FUNCTION public.enforce_reaction_conversation_match();


--
-- TOC entry 5352 (class 2620 OID 457100)
-- Name: profiles trg_sync_profiles_public; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_profiles_public AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profiles_public();


--
-- TOC entry 5375 (class 2620 OID 457101)
-- Name: media_items trg_sync_title_genres; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_title_genres AFTER INSERT OR UPDATE OF tmdb_genre_ids, omdb_genre ON public.media_items FOR EACH ROW EXECUTE FUNCTION public._trg_sync_title_genres();


--
-- TOC entry 5382 (class 2620 OID 457102)
-- Name: recommendation_interactions trg_update_recommendation_performance; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_recommendation_performance AFTER INSERT ON public.recommendation_interactions FOR EACH ROW EXECUTE FUNCTION public.update_recommendation_performance();


--
-- TOC entry 5370 (class 2620 OID 457103)
-- Name: user_settings trg_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5369 (class 2620 OID 457104)
-- Name: user_stats trg_user_stats_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_user_stats_updated_at BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5366 (class 2620 OID 457105)
-- Name: messages trg_validate_message_insert_v1; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_message_insert_v1 BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_message_insert_v1();


--
-- TOC entry 5347 (class 2620 OID 17152)
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- TOC entry 5342 (class 2620 OID 17299)
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- TOC entry 5343 (class 2620 OID 17329)
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- TOC entry 5344 (class 2620 OID 17283)
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- TOC entry 5345 (class 2620 OID 17328)
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- TOC entry 5348 (class 2620 OID 17295)
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- TOC entry 5349 (class 2620 OID 17330)
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- TOC entry 5346 (class 2620 OID 17191)
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- TOC entry 5253 (class 2606 OID 16734)
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5258 (class 2606 OID 16823)
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5257 (class 2606 OID 16811)
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- TOC entry 5256 (class 2606 OID 16798)
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5264 (class 2606 OID 17063)
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- TOC entry 5265 (class 2606 OID 17068)
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5266 (class 2606 OID 17092)
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- TOC entry 5267 (class 2606 OID 17087)
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5263 (class 2606 OID 16989)
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5251 (class 2606 OID 16767)
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5260 (class 2606 OID 16870)
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- TOC entry 5261 (class 2606 OID 16943)
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- TOC entry 5262 (class 2606 OID 16884)
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- TOC entry 5254 (class 2606 OID 17106)
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- TOC entry 5255 (class 2606 OID 16762)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5259 (class 2606 OID 16851)
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- TOC entry 5288 (class 2606 OID 411959)
-- Name: activity_events activity_events_media_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_media_item_fk FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE SET NULL;


--
-- TOC entry 5289 (class 2606 OID 446508)
-- Name: activity_events activity_events_related_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_related_user_id_fkey FOREIGN KEY (related_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5290 (class 2606 OID 35105)
-- Name: activity_events activity_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5312 (class 2606 OID 35409)
-- Name: blocked_users blocked_users_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5313 (class 2606 OID 35404)
-- Name: blocked_users blocked_users_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5286 (class 2606 OID 35086)
-- Name: comment_likes comment_likes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- TOC entry 5287 (class 2606 OID 35091)
-- Name: comment_likes comment_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5277 (class 2606 OID 34965)
-- Name: comments comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- TOC entry 5278 (class 2606 OID 34960)
-- Name: comments comments_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- TOC entry 5279 (class 2606 OID 34955)
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5293 (class 2606 OID 35163)
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 5294 (class 2606 OID 35168)
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5292 (class 2606 OID 35147)
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 5282 (class 2606 OID 35052)
-- Name: follows follows_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5283 (class 2606 OID 35047)
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5275 (class 2606 OID 34904)
-- Name: library_entries library_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.library_entries
    ADD CONSTRAINT library_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5281 (class 2606 OID 35005)
-- Name: list_items list_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.list_items
    ADD CONSTRAINT list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.lists(id) ON DELETE CASCADE;


--
-- TOC entry 5280 (class 2606 OID 34984)
-- Name: lists lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lists
    ADD CONSTRAINT lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5318 (class 2606 OID 146843)
-- Name: media_embeddings media_embeddings_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_embeddings
    ADD CONSTRAINT media_embeddings_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5319 (class 2606 OID 411954)
-- Name: media_events media_events_media_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_events
    ADD CONSTRAINT media_events_media_item_fk FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5320 (class 2606 OID 146887)
-- Name: media_events media_events_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_events
    ADD CONSTRAINT media_events_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5321 (class 2606 OID 411949)
-- Name: media_events media_events_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_events
    ADD CONSTRAINT media_events_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5322 (class 2606 OID 146882)
-- Name: media_events media_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_events
    ADD CONSTRAINT media_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5323 (class 2606 OID 146908)
-- Name: media_feedback media_feedback_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_feedback
    ADD CONSTRAINT media_feedback_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5324 (class 2606 OID 146903)
-- Name: media_feedback media_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_feedback
    ADD CONSTRAINT media_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5333 (class 2606 OID 351757)
-- Name: media_genres media_genres_genre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_genres
    ADD CONSTRAINT media_genres_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES public.genres(id) ON DELETE CASCADE;


--
-- TOC entry 5334 (class 2606 OID 351762)
-- Name: media_genres media_genres_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_genres
    ADD CONSTRAINT media_genres_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5329 (class 2606 OID 150320)
-- Name: media_item_daily media_item_daily_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_item_daily
    ADD CONSTRAINT media_item_daily_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5330 (class 2606 OID 150332)
-- Name: media_item_daily_users media_item_daily_users_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_item_daily_users
    ADD CONSTRAINT media_item_daily_users_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5326 (class 2606 OID 146935)
-- Name: media_session_vectors media_session_vectors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_session_vectors
    ADD CONSTRAINT media_session_vectors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5327 (class 2606 OID 146946)
-- Name: media_trending_scores media_trending_scores_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_trending_scores
    ADD CONSTRAINT media_trending_scores_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5325 (class 2606 OID 146922)
-- Name: media_user_vectors media_user_vectors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_user_vectors
    ADD CONSTRAINT media_user_vectors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5302 (class 2606 OID 35235)
-- Name: message_delivery_receipts message_delivery_receipts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_delivery_receipts
    ADD CONSTRAINT message_delivery_receipts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 5303 (class 2606 OID 35240)
-- Name: message_delivery_receipts message_delivery_receipts_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_delivery_receipts
    ADD CONSTRAINT message_delivery_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- TOC entry 5304 (class 2606 OID 35245)
-- Name: message_delivery_receipts message_delivery_receipts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_delivery_receipts
    ADD CONSTRAINT message_delivery_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5299 (class 2606 OID 35208)
-- Name: message_reactions message_reactions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 5300 (class 2606 OID 35213)
-- Name: message_reactions message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- TOC entry 5301 (class 2606 OID 35218)
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5305 (class 2606 OID 35259)
-- Name: message_read_receipts message_read_receipts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 5306 (class 2606 OID 35269)
-- Name: message_read_receipts message_read_receipts_last_read_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- TOC entry 5307 (class 2606 OID 35264)
-- Name: message_read_receipts message_read_receipts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5295 (class 2606 OID 411939)
-- Name: messages messages_conversation_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 5296 (class 2606 OID 35187)
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 5297 (class 2606 OID 411944)
-- Name: messages messages_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5298 (class 2606 OID 35192)
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5331 (class 2606 OID 295863)
-- Name: media_user_centroids muc_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_user_centroids
    ADD CONSTRAINT muc_item_fkey FOREIGN KEY (exemplar_media_item_id) REFERENCES public.media_items(id);


--
-- TOC entry 5332 (class 2606 OID 295858)
-- Name: media_user_centroids muc_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_user_centroids
    ADD CONSTRAINT muc_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- TOC entry 5317 (class 2606 OID 48659)
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- TOC entry 5291 (class 2606 OID 35128)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5273 (class 2606 OID 24617)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5274 (class 2606 OID 34879)
-- Name: ratings ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5335 (class 2606 OID 446573)
-- Name: recommendation_impressions recommendation_impressions_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_impressions
    ADD CONSTRAINT recommendation_impressions_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5336 (class 2606 OID 446568)
-- Name: recommendation_impressions recommendation_impressions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_impressions
    ADD CONSTRAINT recommendation_impressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5337 (class 2606 OID 446590)
-- Name: recommendation_interactions recommendation_interactions_impression_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_interactions
    ADD CONSTRAINT recommendation_interactions_impression_id_fkey FOREIGN KEY (impression_id) REFERENCES public.recommendation_impressions(id) ON DELETE CASCADE;


--
-- TOC entry 5338 (class 2606 OID 446600)
-- Name: recommendation_interactions recommendation_interactions_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_interactions
    ADD CONSTRAINT recommendation_interactions_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_items(id) ON DELETE CASCADE;


--
-- TOC entry 5339 (class 2606 OID 446595)
-- Name: recommendation_interactions recommendation_interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recommendation_interactions
    ADD CONSTRAINT recommendation_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5315 (class 2606 OID 35442)
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5316 (class 2606 OID 35447)
-- Name: reports reports_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- TOC entry 5284 (class 2606 OID 35066)
-- Name: review_reactions review_reactions_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- TOC entry 5285 (class 2606 OID 35071)
-- Name: review_reactions review_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5276 (class 2606 OID 34930)
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5314 (class 2606 OID 35427)
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5308 (class 2606 OID 35294)
-- Name: user_stats user_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5328 (class 2606 OID 146963)
-- Name: user_swipe_prefs user_swipe_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_swipe_prefs
    ADD CONSTRAINT user_swipe_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5309 (class 2606 OID 35375)
-- Name: user_tags user_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5310 (class 2606 OID 35391)
-- Name: user_title_tags user_title_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_title_tags
    ADD CONSTRAINT user_title_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.user_tags(id) ON DELETE CASCADE;


--
-- TOC entry 5311 (class 2606 OID 35386)
-- Name: user_title_tags user_title_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_title_tags
    ADD CONSTRAINT user_title_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 5252 (class 2606 OID 16572)
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 5271 (class 2606 OID 17270)
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 5268 (class 2606 OID 17216)
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 5269 (class 2606 OID 17236)
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 5270 (class 2606 OID 17231)
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- TOC entry 5272 (class 2606 OID 17353)
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- TOC entry 5542 (class 0 OID 16525)
-- Dependencies: 363
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5556 (class 0 OID 16929)
-- Dependencies: 380
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5547 (class 0 OID 16727)
-- Dependencies: 371
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5541 (class 0 OID 16518)
-- Dependencies: 362
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5551 (class 0 OID 16816)
-- Dependencies: 375
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5550 (class 0 OID 16804)
-- Dependencies: 374
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5549 (class 0 OID 16791)
-- Dependencies: 373
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5557 (class 0 OID 16979)
-- Dependencies: 381
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5540 (class 0 OID 16507)
-- Dependencies: 361
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5554 (class 0 OID 16858)
-- Dependencies: 378
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5555 (class 0 OID 16876)
-- Dependencies: 379
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5543 (class 0 OID 16533)
-- Dependencies: 364
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5548 (class 0 OID 16757)
-- Dependencies: 372
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5553 (class 0 OID 16843)
-- Dependencies: 377
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5552 (class 0 OID 16834)
-- Dependencies: 376
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5539 (class 0 OID 16495)
-- Dependencies: 359
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5575 (class 0 OID 35098)
-- Dependencies: 410
-- Name: activity_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5621 (class 3256 OID 457106)
-- Name: activity_events activity_events_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY activity_events_owner_only ON public.activity_events USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5607 (class 0 OID 287121)
-- Dependencies: 463
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5616 (class 0 OID 355945)
-- Dependencies: 474
-- Name: admin_costs_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_costs_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5622 (class 3256 OID 457107)
-- Name: admin_costs_settings admin_costs_settings_service_role_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_costs_settings_service_role_rw ON public.admin_costs_settings TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5609 (class 0 OID 287154)
-- Dependencies: 465
-- Name: admin_cron_registry; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_cron_registry ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5623 (class 3256 OID 457108)
-- Name: admin_cron_registry admin_cron_registry_deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_cron_registry_deny_all ON public.admin_cron_registry AS RESTRICTIVE TO authenticated, anon USING (false) WITH CHECK (false);


--
-- TOC entry 5606 (class 0 OID 287112)
-- Dependencies: 462
-- Name: app_admins; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5588 (class 0 OID 35398)
-- Dependencies: 425
-- Name: blocked_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5651 (class 3256 OID 457109)
-- Name: blocked_users blocked_users_manage_self_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY blocked_users_manage_self_delete ON public.blocked_users FOR DELETE USING ((blocker_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5652 (class 3256 OID 457110)
-- Name: blocked_users blocked_users_manage_self_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY blocked_users_manage_self_insert ON public.blocked_users FOR INSERT WITH CHECK ((blocker_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5653 (class 3256 OID 457111)
-- Name: blocked_users blocked_users_manage_self_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY blocked_users_manage_self_update ON public.blocked_users FOR UPDATE USING ((blocker_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((blocker_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5655 (class 3256 OID 457112)
-- Name: blocked_users blocked_users_view_related; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY blocked_users_view_related ON public.blocked_users FOR SELECT USING (((( SELECT ( SELECT auth.uid() AS uid) AS uid) = blocker_id) OR (( SELECT ( SELECT auth.uid() AS uid) AS uid) = blocked_id)));


--
-- TOC entry 5574 (class 0 OID 35080)
-- Dependencies: 409
-- Name: comment_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5656 (class 3256 OID 457113)
-- Name: comment_likes comment_likes_owner_only_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comment_likes_owner_only_delete ON public.comment_likes FOR DELETE USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5657 (class 3256 OID 457114)
-- Name: comment_likes comment_likes_owner_only_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comment_likes_owner_only_insert ON public.comment_likes FOR INSERT WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5658 (class 3256 OID 457115)
-- Name: comment_likes comment_likes_owner_only_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comment_likes_owner_only_update ON public.comment_likes FOR UPDATE USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5624 (class 3256 OID 457116)
-- Name: comment_likes comment_likes_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comment_likes_read_all ON public.comment_likes FOR SELECT TO authenticated USING (true);


--
-- TOC entry 5569 (class 0 OID 34945)
-- Dependencies: 404
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5659 (class 3256 OID 457117)
-- Name: comments comments_insert_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_insert_self ON public.comments FOR INSERT WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5660 (class 3256 OID 457118)
-- Name: comments comments_owner_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_owner_delete ON public.comments FOR DELETE USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5664 (class 3256 OID 457119)
-- Name: comments comments_owner_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_owner_update ON public.comments FOR UPDATE USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5625 (class 3256 OID 457120)
-- Name: comments comments_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_read_all ON public.comments FOR SELECT TO authenticated USING (true);


--
-- TOC entry 5578 (class 0 OID 35154)
-- Dependencies: 413
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5665 (class 3256 OID 457121)
-- Name: conversation_participants conversation_participants_insert_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversation_participants_insert_self ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 5666 (class 3256 OID 457122)
-- Name: conversation_participants conversation_participants_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversation_participants_self ON public.conversation_participants FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 5667 (class 3256 OID 457123)
-- Name: conversation_participants conversation_participants_update_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversation_participants_update_self ON public.conversation_participants FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 5577 (class 0 OID 35138)
-- Dependencies: 412
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5668 (class 3256 OID 457124)
-- Name: conversations conversations_member_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_member_manage ON public.conversations USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))));


--
-- TOC entry 5669 (class 3256 OID 457126)
-- Name: message_delivery_receipts delivery_receipts_insert_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY delivery_receipts_insert_participant ON public.message_delivery_receipts FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_delivery_receipts.conversation_id) AND (cp.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_delivery_receipts.message_id) AND (m.conversation_id = message_delivery_receipts.conversation_id))))));


--
-- TOC entry 5629 (class 3256 OID 457127)
-- Name: message_delivery_receipts delivery_receipts_select_participants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY delivery_receipts_select_participants ON public.message_delivery_receipts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_delivery_receipts.conversation_id) AND (cp.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 5691 (class 3256 OID 466329)
-- Name: message_delivery_receipts delivery_receipts_update_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY delivery_receipts_update_merged ON public.message_delivery_receipts FOR UPDATE TO authenticated USING ((((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_delivery_receipts.message_id) AND (message_delivery_receipts.conversation_id = m.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) OR ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_delivery_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_delivery_receipts.message_id) AND (m.conversation_id = message_delivery_receipts.conversation_id))))))) WITH CHECK ((((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_delivery_receipts.message_id) AND (message_delivery_receipts.conversation_id = m.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) OR ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_delivery_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.id = message_delivery_receipts.message_id) AND (m.conversation_id = message_delivery_receipts.conversation_id)))))));


--
-- TOC entry 5626 (class 3256 OID 457133)
-- Name: admin_audit_log deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all ON public.admin_audit_log USING (false) WITH CHECK (false);


--
-- TOC entry 5627 (class 3256 OID 457134)
-- Name: app_admins deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all ON public.app_admins USING (false) WITH CHECK (false);


--
-- TOC entry 5628 (class 3256 OID 457135)
-- Name: job_run_log deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all ON public.job_run_log USING (false) WITH CHECK (false);


--
-- TOC entry 5605 (class 0 OID 285049)
-- Dependencies: 457
-- Name: embedding_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.embedding_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5572 (class 0 OID 35041)
-- Dependencies: 407
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5670 (class 3256 OID 457136)
-- Name: follows follows_manage_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY follows_manage_own_delete ON public.follows FOR DELETE USING ((follower_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5671 (class 3256 OID 457137)
-- Name: follows follows_manage_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY follows_manage_own_insert ON public.follows FOR INSERT WITH CHECK ((follower_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5631 (class 3256 OID 457138)
-- Name: follows follows_manage_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY follows_manage_own_update ON public.follows FOR UPDATE USING ((follower_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((follower_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5697 (class 3256 OID 466530)
-- Name: follows follows_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY follows_select_own ON public.follows FOR SELECT TO authenticated USING (((follower_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR ((( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) = follower_id) OR (( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) = followed_id))));


--
-- TOC entry 5584 (class 0 OID 35300)
-- Dependencies: 420
-- Name: genres; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5630 (class 3256 OID 457140)
-- Name: genres genres_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY genres_select_all ON public.genres FOR SELECT USING (true);


--
-- TOC entry 5608 (class 0 OID 287132)
-- Dependencies: 464
-- Name: job_run_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_run_log ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5567 (class 0 OID 34893)
-- Dependencies: 402
-- Name: library_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5687 (class 3256 OID 466325)
-- Name: library_entries library_entries_select_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY library_entries_select_merged ON public.library_entries FOR SELECT TO authenticated USING (((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles_public
  WHERE (profiles_public.id = library_entries.user_id)))));


--
-- TOC entry 5571 (class 0 OID 34994)
-- Dependencies: 406
-- Name: list_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5632 (class 3256 OID 457143)
-- Name: list_items list_items_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY list_items_owner_only ON public.list_items USING ((EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = list_items.list_id) AND (l.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = list_items.list_id) AND (l.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))));


--
-- TOC entry 5570 (class 0 OID 34973)
-- Dependencies: 405
-- Name: lists; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5672 (class 3256 OID 457145)
-- Name: lists lists_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lists_owner_only ON public.lists USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5595 (class 0 OID 146833)
-- Dependencies: 445
-- Name: media_embeddings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_embeddings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5633 (class 3256 OID 457146)
-- Name: media_embeddings media_embeddings_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_embeddings_service_all ON public.media_embeddings TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5596 (class 0 OID 146873)
-- Dependencies: 446
-- Name: media_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5634 (class 3256 OID 457147)
-- Name: media_events media_events_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_events_insert_own ON public.media_events FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5673 (class 3256 OID 457148)
-- Name: media_events media_events_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_events_select_own ON public.media_events FOR SELECT TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5597 (class 0 OID 146895)
-- Dependencies: 447
-- Name: media_feedback; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_feedback ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5674 (class 3256 OID 457149)
-- Name: media_feedback media_feedback_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_feedback_insert_own ON public.media_feedback FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5637 (class 3256 OID 457150)
-- Name: media_feedback media_feedback_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_feedback_select_own ON public.media_feedback FOR SELECT TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5641 (class 3256 OID 457151)
-- Name: media_feedback media_feedback_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_feedback_update_own ON public.media_feedback FOR UPDATE TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5615 (class 0 OID 351751)
-- Dependencies: 473
-- Name: media_genres; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_genres ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5635 (class 3256 OID 457152)
-- Name: media_genres media_genres_read_all_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_genres_read_all_authenticated ON public.media_genres FOR SELECT TO authenticated USING (true);


--
-- TOC entry 5602 (class 0 OID 150305)
-- Dependencies: 452
-- Name: media_item_daily; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_item_daily ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5636 (class 3256 OID 457153)
-- Name: media_item_daily media_item_daily_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_item_daily_service_all ON public.media_item_daily TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5603 (class 0 OID 150327)
-- Dependencies: 453
-- Name: media_item_daily_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_item_daily_users ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5638 (class 3256 OID 457154)
-- Name: media_item_daily_users media_item_daily_users_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_item_daily_users_service_all ON public.media_item_daily_users TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5592 (class 0 OID 135411)
-- Dependencies: 441
-- Name: media_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5639 (class 3256 OID 457155)
-- Name: media_items media_items_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_items_insert_authenticated ON public.media_items FOR INSERT TO authenticated WITH CHECK (true);


--
-- TOC entry 5640 (class 3256 OID 457156)
-- Name: media_items media_items_read_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_items_read_authenticated ON public.media_items FOR SELECT TO authenticated USING (true);


--
-- TOC entry 5604 (class 0 OID 154206)
-- Dependencies: 455
-- Name: media_job_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_job_state ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5642 (class 3256 OID 457157)
-- Name: media_job_state media_job_state_deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_job_state_deny_all ON public.media_job_state TO authenticated, anon USING (false) WITH CHECK (false);


--
-- TOC entry 5613 (class 0 OID 295881)
-- Dependencies: 471
-- Name: media_rank_feature_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_rank_feature_log ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5675 (class 3256 OID 457158)
-- Name: media_rank_feature_log media_rank_feature_log_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rank_feature_log_insert_own ON public.media_rank_feature_log FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5676 (class 3256 OID 457159)
-- Name: media_rank_feature_log media_rank_feature_log_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rank_feature_log_select_own ON public.media_rank_feature_log FOR SELECT TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5643 (class 3256 OID 457160)
-- Name: media_rank_feature_log media_rank_feature_log_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rank_feature_log_service_all ON public.media_rank_feature_log TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5612 (class 0 OID 295869)
-- Dependencies: 470
-- Name: media_rank_models; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_rank_models ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5644 (class 3256 OID 457161)
-- Name: media_rank_models media_rank_models_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rank_models_service_all ON public.media_rank_models TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5610 (class 0 OID 291572)
-- Dependencies: 467
-- Name: media_rerank_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_rerank_cache ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5677 (class 3256 OID 457162)
-- Name: media_rerank_cache media_rerank_cache_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rerank_cache_delete_own ON public.media_rerank_cache FOR DELETE TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5678 (class 3256 OID 457163)
-- Name: media_rerank_cache media_rerank_cache_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rerank_cache_insert_own ON public.media_rerank_cache FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5681 (class 3256 OID 457164)
-- Name: media_rerank_cache media_rerank_cache_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rerank_cache_select_own ON public.media_rerank_cache FOR SELECT TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5682 (class 3256 OID 457165)
-- Name: media_rerank_cache media_rerank_cache_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_rerank_cache_update_own ON public.media_rerank_cache FOR UPDATE TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5614 (class 0 OID 325903)
-- Dependencies: 472
-- Name: media_served; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_served ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5683 (class 3256 OID 457166)
-- Name: media_served media_served_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_served_delete_own ON public.media_served FOR DELETE TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5684 (class 3256 OID 457167)
-- Name: media_served media_served_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_served_insert_own ON public.media_served FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5686 (class 3256 OID 457168)
-- Name: media_served media_served_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_served_select_own ON public.media_served FOR SELECT TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5646 (class 3256 OID 457169)
-- Name: media_served media_served_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_served_service_all ON public.media_served TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5647 (class 3256 OID 457170)
-- Name: media_served media_served_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_served_update_own ON public.media_served FOR UPDATE TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5599 (class 0 OID 146927)
-- Dependencies: 449
-- Name: media_session_vectors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_session_vectors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5693 (class 3256 OID 457171)
-- Name: media_session_vectors media_session_vectors_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_session_vectors_own ON public.media_session_vectors TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5600 (class 0 OID 146940)
-- Dependencies: 450
-- Name: media_trending_scores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_trending_scores ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5648 (class 3256 OID 457172)
-- Name: media_trending_scores media_trending_scores_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_trending_scores_service_all ON public.media_trending_scores TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5611 (class 0 OID 295826)
-- Dependencies: 469
-- Name: media_user_centroids; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_user_centroids ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5698 (class 3256 OID 457173)
-- Name: media_user_centroids media_user_centroids_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_user_centroids_select_own ON public.media_user_centroids FOR SELECT TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5654 (class 3256 OID 457174)
-- Name: media_user_centroids media_user_centroids_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_user_centroids_service_all ON public.media_user_centroids TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5598 (class 0 OID 146914)
-- Dependencies: 448
-- Name: media_user_vectors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.media_user_vectors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5699 (class 3256 OID 457175)
-- Name: media_user_vectors media_user_vectors_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY media_user_vectors_own ON public.media_user_vectors TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5581 (class 0 OID 35227)
-- Dependencies: 416
-- Name: message_delivery_receipts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_delivery_receipts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5580 (class 0 OID 35201)
-- Dependencies: 415
-- Name: message_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5661 (class 3256 OID 457176)
-- Name: message_reactions message_reactions_delete_own_members_v2; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_reactions_delete_own_members_v2 ON public.message_reactions FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND (cp.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- TOC entry 5649 (class 3256 OID 466334)
-- Name: message_reactions message_reactions_insert_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_reactions_insert_merged ON public.message_reactions FOR INSERT TO authenticated WITH CHECK ((((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) OR ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))))));


--
-- TOC entry 5662 (class 3256 OID 457182)
-- Name: message_reactions message_reactions_select_members_v2; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_reactions_select_members_v2 ON public.message_reactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND (cp.user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 5582 (class 0 OID 35253)
-- Dependencies: 417
-- Name: message_read_receipts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5579 (class 0 OID 35180)
-- Dependencies: 414
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5696 (class 3256 OID 466339)
-- Name: messages messages_delete_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_delete_merged ON public.messages FOR DELETE TO authenticated USING (((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR ((user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid))))))));


--
-- TOC entry 5694 (class 3256 OID 466336)
-- Name: messages messages_insert_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_insert_merged ON public.messages FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR ((user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid))))))));


--
-- TOC entry 5663 (class 3256 OID 457185)
-- Name: messages messages_member_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_member_read ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))));


--
-- TOC entry 5695 (class 3256 OID 466337)
-- Name: messages messages_update_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_update_merged ON public.messages FOR UPDATE TO authenticated USING ((((user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)))))) OR (user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))) WITH CHECK ((((user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid)))))) OR (user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))));


--
-- TOC entry 5591 (class 0 OID 48649)
-- Dependencies: 428
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5700 (class 3256 OID 457191)
-- Name: notification_preferences notification_preferences_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_preferences_owner_only ON public.notification_preferences USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5576 (class 0 OID 35120)
-- Dependencies: 411
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5701 (class 3256 OID 457192)
-- Name: notifications notifications_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_owner_only ON public.notifications USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5594 (class 0 OID 137055)
-- Dependencies: 443
-- Name: omdb_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.omdb_cache ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5679 (class 3256 OID 457193)
-- Name: omdb_cache omdb_cache_deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY omdb_cache_deny_all ON public.omdb_cache TO authenticated, anon USING (false) WITH CHECK (false);


--
-- TOC entry 5585 (class 0 OID 35323)
-- Dependencies: 422
-- Name: people; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5680 (class 3256 OID 457194)
-- Name: people people_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY people_select_all ON public.people FOR SELECT USING (true);


--
-- TOC entry 5565 (class 0 OID 24610)
-- Dependencies: 400
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5702 (class 3256 OID 457195)
-- Name: profiles profiles_insert_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK ((id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5617 (class 0 OID 384867)
-- Dependencies: 477
-- Name: profiles_public; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5645 (class 3256 OID 465940)
-- Name: profiles_public profiles_public_select_visible; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_public_select_visible ON public.profiles_public FOR SELECT TO authenticated, anon USING (public.can_view_profile(id));


--
-- TOC entry 5707 (class 3256 OID 457197)
-- Name: profiles profiles_select_self_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_self_only ON public.profiles FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 5708 (class 3256 OID 457198)
-- Name: profiles profiles_update_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING ((id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5566 (class 0 OID 34868)
-- Dependencies: 401
-- Name: ratings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5688 (class 3256 OID 466326)
-- Name: ratings ratings_select_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ratings_select_merged ON public.ratings FOR SELECT TO authenticated USING (((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles_public
  WHERE (profiles_public.id = ratings.user_id)))));


--
-- TOC entry 5685 (class 3256 OID 457201)
-- Name: embedding_settings read_embedding_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY read_embedding_settings ON public.embedding_settings FOR SELECT TO authenticated USING (true);


--
-- TOC entry 5709 (class 3256 OID 457202)
-- Name: message_read_receipts read_receipts_insert_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY read_receipts_insert_participant ON public.message_read_receipts FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_read_receipts.conversation_id) AND (cp.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- TOC entry 5712 (class 3256 OID 457203)
-- Name: message_read_receipts read_receipts_select_participants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY read_receipts_select_participants ON public.message_read_receipts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_read_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))));


--
-- TOC entry 5692 (class 3256 OID 466332)
-- Name: message_read_receipts read_receipts_update_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY read_receipts_update_merged ON public.message_read_receipts FOR UPDATE TO authenticated USING ((((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_read_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) OR ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_read_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))))) WITH CHECK ((((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_read_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))) OR ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = message_read_receipts.conversation_id) AND (cp.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))))));


--
-- TOC entry 5618 (class 0 OID 446558)
-- Dependencies: 479
-- Name: recommendation_impressions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recommendation_impressions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5713 (class 3256 OID 457208)
-- Name: recommendation_impressions recommendation_impressions_own_data; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recommendation_impressions_own_data ON public.recommendation_impressions FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 5703 (class 3256 OID 457209)
-- Name: recommendation_impressions recommendation_impressions_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recommendation_impressions_service_all ON public.recommendation_impressions TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5619 (class 0 OID 446581)
-- Dependencies: 480
-- Name: recommendation_interactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recommendation_interactions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5714 (class 3256 OID 457210)
-- Name: recommendation_interactions recommendation_interactions_own_data; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recommendation_interactions_own_data ON public.recommendation_interactions FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- TOC entry 5704 (class 3256 OID 457211)
-- Name: recommendation_interactions recommendation_interactions_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recommendation_interactions_service_all ON public.recommendation_interactions TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5620 (class 0 OID 446607)
-- Dependencies: 481
-- Name: recommendation_performance; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recommendation_performance ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5705 (class 3256 OID 457212)
-- Name: recommendation_performance recommendation_performance_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recommendation_performance_read_all ON public.recommendation_performance FOR SELECT TO authenticated USING (true);


--
-- TOC entry 5706 (class 3256 OID 457213)
-- Name: recommendation_performance recommendation_performance_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recommendation_performance_service_all ON public.recommendation_performance TO service_role USING (true) WITH CHECK (true);


--
-- TOC entry 5590 (class 0 OID 35432)
-- Dependencies: 427
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5690 (class 3256 OID 466328)
-- Name: reports reports_insert_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY reports_insert_merged ON public.reports FOR INSERT TO authenticated WITH CHECK ((reporter_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5573 (class 0 OID 35059)
-- Dependencies: 408
-- Name: review_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5715 (class 3256 OID 457216)
-- Name: review_reactions review_reactions_participant_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY review_reactions_participant_only ON public.review_reactions USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5568 (class 0 OID 34918)
-- Dependencies: 403
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5689 (class 3256 OID 466327)
-- Name: reviews reviews_select_merged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY reviews_select_merged ON public.reviews FOR SELECT TO authenticated USING (((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles_public
  WHERE (profiles_public.id = reviews.user_id)))));


--
-- TOC entry 5593 (class 0 OID 136524)
-- Dependencies: 442
-- Name: tmdb_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tmdb_cache ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5710 (class 3256 OID 457219)
-- Name: tmdb_cache tmdb_cache_deny_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tmdb_cache_deny_all ON public.tmdb_cache TO authenticated, anon USING (false) WITH CHECK (false);


--
-- TOC entry 5589 (class 0 OID 35416)
-- Dependencies: 426
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5711 (class 3256 OID 457220)
-- Name: user_settings user_settings_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_settings_owner_only ON public.user_settings USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5583 (class 0 OID 35281)
-- Dependencies: 418
-- Name: user_stats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5650 (class 3256 OID 466528)
-- Name: user_stats user_stats_select_visible; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_stats_select_visible ON public.user_stats FOR SELECT TO authenticated, anon USING (public.can_view_profile(user_id));


--
-- TOC entry 5601 (class 0 OID 146951)
-- Dependencies: 451
-- Name: user_swipe_prefs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_swipe_prefs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5717 (class 3256 OID 457222)
-- Name: user_swipe_prefs user_swipe_prefs_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_swipe_prefs_own ON public.user_swipe_prefs TO authenticated USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5586 (class 0 OID 35364)
-- Dependencies: 423
-- Name: user_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5718 (class 3256 OID 457223)
-- Name: user_tags user_tags_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_tags_owner_only ON public.user_tags USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5587 (class 0 OID 35380)
-- Dependencies: 424
-- Name: user_title_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_title_tags ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5716 (class 3256 OID 457224)
-- Name: user_title_tags user_title_tags_owner_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_title_tags_owner_only ON public.user_title_tags USING ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))) WITH CHECK ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));


--
-- TOC entry 5564 (class 0 OID 17469)
-- Dependencies: 397
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5719 (class 3256 OID 457225)
-- Name: objects Chat media delete (owner participants only); Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Chat media delete (owner participants only)" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'chat-media'::text) AND (split_part(name, '/'::text, 1) = 'message_attachments'::text) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = (split_part(objects.name, '/'::text, 2))::uuid) AND (cp.user_id = auth.uid())))) AND (split_part(name, '/'::text, 3) = (auth.uid())::text)));


--
-- TOC entry 5720 (class 3256 OID 457226)
-- Name: objects Chat media read (participants only); Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Chat media read (participants only)" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'chat-media'::text) AND (split_part(name, '/'::text, 1) = 'message_attachments'::text) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE (((cp.conversation_id)::text = split_part(objects.name, '/'::text, 2)) AND (cp.user_id = auth.uid()))))));


--
-- TOC entry 5721 (class 3256 OID 457227)
-- Name: objects Chat media upload (participants only); Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Chat media upload (participants only)" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'chat-media'::text) AND (split_part(name, '/'::text, 1) = 'message_attachments'::text) AND (split_part(name, '/'::text, 3) = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE (((cp.conversation_id)::text = split_part(objects.name, '/'::text, 2)) AND (cp.user_id = auth.uid()))))));


--
-- TOC entry 5722 (class 3256 OID 457228)
-- Name: objects avatars_delete_own_prefix; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY avatars_delete_own_prefix ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- TOC entry 5723 (class 3256 OID 457229)
-- Name: objects avatars_insert_own_prefix; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY avatars_insert_own_prefix ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- TOC entry 5724 (class 3256 OID 457230)
-- Name: objects avatars_read_authenticated; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY avatars_read_authenticated ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'avatars'::text));


--
-- TOC entry 5725 (class 3256 OID 457231)
-- Name: objects avatars_select_authenticated; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY avatars_select_authenticated ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'avatars'::text));


--
-- TOC entry 5726 (class 3256 OID 457232)
-- Name: objects avatars_update_own_prefix; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY avatars_update_own_prefix ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- TOC entry 5544 (class 0 OID 16546)
-- Dependencies: 365
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5561 (class 0 OID 17306)
-- Dependencies: 393
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5562 (class 0 OID 17333)
-- Dependencies: 394
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5546 (class 0 OID 16588)
-- Dependencies: 367
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5545 (class 0 OID 16561)
-- Dependencies: 366
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5560 (class 0 OID 17260)
-- Dependencies: 392
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5558 (class 0 OID 17207)
-- Dependencies: 390
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5559 (class 0 OID 17221)
-- Dependencies: 391
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5563 (class 0 OID 17343)
-- Dependencies: 395
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5728 (class 6104 OID 16426)
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- TOC entry 5727 (class 6104 OID 19360)
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: supabase_admin
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime_messages_publication OWNER TO supabase_admin;

--
-- TOC entry 5733 (class 6106 OID 52027)
-- Name: supabase_realtime conversation_participants; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.conversation_participants;


--
-- TOC entry 5734 (class 6106 OID 52028)
-- Name: supabase_realtime conversations; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.conversations;


--
-- TOC entry 5729 (class 6106 OID 52023)
-- Name: supabase_realtime message_delivery_receipts; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.message_delivery_receipts;


--
-- TOC entry 5730 (class 6106 OID 52024)
-- Name: supabase_realtime message_reactions; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.message_reactions;


--
-- TOC entry 5731 (class 6106 OID 52025)
-- Name: supabase_realtime message_read_receipts; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.message_read_receipts;


--
-- TOC entry 5732 (class 6106 OID 52026)
-- Name: supabase_realtime messages; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.messages;


--
-- TOC entry 5735 (class 6106 OID 25927)
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: supabase_admin
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- TOC entry 5741 (class 0 OID 0)
-- Dependencies: 42
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- TOC entry 5743 (class 0 OID 0)
-- Dependencies: 142
-- Name: SCHEMA cron; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA cron TO postgres WITH GRANT OPTION;


--
-- TOC entry 5744 (class 0 OID 0)
-- Dependencies: 29
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- TOC entry 5746 (class 0 OID 0)
-- Dependencies: 141
-- Name: SCHEMA net; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA net TO supabase_functions_admin;
GRANT USAGE ON SCHEMA net TO postgres;
GRANT USAGE ON SCHEMA net TO anon;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO service_role;


--
-- TOC entry 5747 (class 0 OID 0)
-- Dependencies: 144
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 5748 (class 0 OID 0)
-- Dependencies: 19
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- TOC entry 5749 (class 0 OID 0)
-- Dependencies: 145
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO dashboard_user;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO postgres;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO anon;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO authenticated;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO service_role;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO supabase_storage_admin;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA storage TO dashboard_user;
RESET SESSION AUTHORIZATION;


--
-- TOC entry 5750 (class 0 OID 0)
-- Dependencies: 143
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- TOC entry 5760 (class 0 OID 0)
-- Dependencies: 809
-- Name: FUNCTION gtrgm_in(cstring); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_in(cstring) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_in(cstring) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_in(cstring) TO service_role;


--
-- TOC entry 5761 (class 0 OID 0)
-- Dependencies: 794
-- Name: FUNCTION gtrgm_out(extensions.gtrgm); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_out(extensions.gtrgm) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_out(extensions.gtrgm) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_out(extensions.gtrgm) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_out(extensions.gtrgm) TO service_role;


--
-- TOC entry 5762 (class 0 OID 0)
-- Dependencies: 621
-- Name: FUNCTION halfvec_in(cstring, oid, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_in(cstring, oid, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5763 (class 0 OID 0)
-- Dependencies: 801
-- Name: FUNCTION halfvec_out(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_out(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5764 (class 0 OID 0)
-- Dependencies: 700
-- Name: FUNCTION halfvec_recv(internal, oid, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_recv(internal, oid, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5765 (class 0 OID 0)
-- Dependencies: 576
-- Name: FUNCTION halfvec_send(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_send(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5766 (class 0 OID 0)
-- Dependencies: 485
-- Name: FUNCTION halfvec_typmod_in(cstring[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_typmod_in(cstring[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5767 (class 0 OID 0)
-- Dependencies: 506
-- Name: FUNCTION sparsevec_in(cstring, oid, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_in(cstring, oid, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5768 (class 0 OID 0)
-- Dependencies: 684
-- Name: FUNCTION sparsevec_out(extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_out(extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5769 (class 0 OID 0)
-- Dependencies: 596
-- Name: FUNCTION sparsevec_recv(internal, oid, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_recv(internal, oid, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5770 (class 0 OID 0)
-- Dependencies: 642
-- Name: FUNCTION sparsevec_send(extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_send(extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5771 (class 0 OID 0)
-- Dependencies: 654
-- Name: FUNCTION sparsevec_typmod_in(cstring[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_typmod_in(cstring[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5772 (class 0 OID 0)
-- Dependencies: 780
-- Name: FUNCTION vector_in(cstring, oid, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_in(cstring, oid, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5773 (class 0 OID 0)
-- Dependencies: 643
-- Name: FUNCTION vector_out(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_out(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5774 (class 0 OID 0)
-- Dependencies: 692
-- Name: FUNCTION vector_recv(internal, oid, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_recv(internal, oid, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5775 (class 0 OID 0)
-- Dependencies: 617
-- Name: FUNCTION vector_send(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_send(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5776 (class 0 OID 0)
-- Dependencies: 646
-- Name: FUNCTION vector_typmod_in(cstring[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_typmod_in(cstring[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5777 (class 0 OID 0)
-- Dependencies: 560
-- Name: FUNCTION array_to_halfvec(real[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_halfvec(real[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5778 (class 0 OID 0)
-- Dependencies: 497
-- Name: FUNCTION array_to_sparsevec(real[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_sparsevec(real[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5779 (class 0 OID 0)
-- Dependencies: 604
-- Name: FUNCTION array_to_vector(real[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_vector(real[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5780 (class 0 OID 0)
-- Dependencies: 509
-- Name: FUNCTION array_to_halfvec(double precision[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_halfvec(double precision[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5781 (class 0 OID 0)
-- Dependencies: 634
-- Name: FUNCTION array_to_sparsevec(double precision[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_sparsevec(double precision[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5782 (class 0 OID 0)
-- Dependencies: 764
-- Name: FUNCTION array_to_vector(double precision[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_vector(double precision[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5783 (class 0 OID 0)
-- Dependencies: 574
-- Name: FUNCTION array_to_halfvec(integer[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_halfvec(integer[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5784 (class 0 OID 0)
-- Dependencies: 837
-- Name: FUNCTION array_to_sparsevec(integer[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_sparsevec(integer[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5785 (class 0 OID 0)
-- Dependencies: 707
-- Name: FUNCTION array_to_vector(integer[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_vector(integer[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5786 (class 0 OID 0)
-- Dependencies: 816
-- Name: FUNCTION array_to_halfvec(numeric[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_halfvec(numeric[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5787 (class 0 OID 0)
-- Dependencies: 561
-- Name: FUNCTION array_to_sparsevec(numeric[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_sparsevec(numeric[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5788 (class 0 OID 0)
-- Dependencies: 508
-- Name: FUNCTION array_to_vector(numeric[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.array_to_vector(numeric[], integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5789 (class 0 OID 0)
-- Dependencies: 836
-- Name: FUNCTION halfvec_to_float4(extensions.halfvec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_to_float4(extensions.halfvec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5790 (class 0 OID 0)
-- Dependencies: 638
-- Name: FUNCTION halfvec(extensions.halfvec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec(extensions.halfvec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5791 (class 0 OID 0)
-- Dependencies: 589
-- Name: FUNCTION halfvec_to_sparsevec(extensions.halfvec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_to_sparsevec(extensions.halfvec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5792 (class 0 OID 0)
-- Dependencies: 656
-- Name: FUNCTION halfvec_to_vector(extensions.halfvec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_to_vector(extensions.halfvec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5793 (class 0 OID 0)
-- Dependencies: 745
-- Name: FUNCTION sparsevec_to_halfvec(extensions.sparsevec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_to_halfvec(extensions.sparsevec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5794 (class 0 OID 0)
-- Dependencies: 649
-- Name: FUNCTION sparsevec(extensions.sparsevec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec(extensions.sparsevec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5795 (class 0 OID 0)
-- Dependencies: 715
-- Name: FUNCTION sparsevec_to_vector(extensions.sparsevec, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_to_vector(extensions.sparsevec, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5796 (class 0 OID 0)
-- Dependencies: 640
-- Name: FUNCTION vector_to_float4(extensions.vector, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_to_float4(extensions.vector, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5797 (class 0 OID 0)
-- Dependencies: 503
-- Name: FUNCTION vector_to_halfvec(extensions.vector, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_to_halfvec(extensions.vector, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5798 (class 0 OID 0)
-- Dependencies: 674
-- Name: FUNCTION vector_to_sparsevec(extensions.vector, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_to_sparsevec(extensions.vector, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5799 (class 0 OID 0)
-- Dependencies: 487
-- Name: FUNCTION vector(extensions.vector, integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector(extensions.vector, integer, boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5801 (class 0 OID 0)
-- Dependencies: 615
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- TOC entry 5802 (class 0 OID 0)
-- Dependencies: 627
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- TOC entry 5804 (class 0 OID 0)
-- Dependencies: 501
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- TOC entry 5806 (class 0 OID 0)
-- Dependencies: 544
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- TOC entry 5807 (class 0 OID 0)
-- Dependencies: 844
-- Name: FUNCTION alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5808 (class 0 OID 0)
-- Dependencies: 823
-- Name: FUNCTION job_cache_invalidate(); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.job_cache_invalidate() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5809 (class 0 OID 0)
-- Dependencies: 624
-- Name: FUNCTION schedule(schedule text, command text); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.schedule(schedule text, command text) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5810 (class 0 OID 0)
-- Dependencies: 676
-- Name: FUNCTION schedule(job_name text, schedule text, command text); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.schedule(job_name text, schedule text, command text) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5811 (class 0 OID 0)
-- Dependencies: 774
-- Name: FUNCTION schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5812 (class 0 OID 0)
-- Dependencies: 532
-- Name: FUNCTION unschedule(job_id bigint); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.unschedule(job_id bigint) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5813 (class 0 OID 0)
-- Dependencies: 838
-- Name: FUNCTION unschedule(job_name text); Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON FUNCTION cron.unschedule(job_name text) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5814 (class 0 OID 0)
-- Dependencies: 625
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- TOC entry 5815 (class 0 OID 0)
-- Dependencies: 751
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- TOC entry 5816 (class 0 OID 0)
-- Dependencies: 572
-- Name: FUNCTION binary_quantize(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.binary_quantize(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5817 (class 0 OID 0)
-- Dependencies: 712
-- Name: FUNCTION binary_quantize(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.binary_quantize(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5818 (class 0 OID 0)
-- Dependencies: 608
-- Name: FUNCTION cosine_distance(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.cosine_distance(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5819 (class 0 OID 0)
-- Dependencies: 632
-- Name: FUNCTION cosine_distance(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.cosine_distance(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5820 (class 0 OID 0)
-- Dependencies: 541
-- Name: FUNCTION cosine_distance(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.cosine_distance(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5821 (class 0 OID 0)
-- Dependencies: 709
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- TOC entry 5822 (class 0 OID 0)
-- Dependencies: 675
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- TOC entry 5823 (class 0 OID 0)
-- Dependencies: 682
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5824 (class 0 OID 0)
-- Dependencies: 599
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5825 (class 0 OID 0)
-- Dependencies: 790
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- TOC entry 5826 (class 0 OID 0)
-- Dependencies: 722
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- TOC entry 5827 (class 0 OID 0)
-- Dependencies: 584
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5828 (class 0 OID 0)
-- Dependencies: 525
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5829 (class 0 OID 0)
-- Dependencies: 742
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- TOC entry 5830 (class 0 OID 0)
-- Dependencies: 510
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- TOC entry 5831 (class 0 OID 0)
-- Dependencies: 855
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- TOC entry 5832 (class 0 OID 0)
-- Dependencies: 846
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- TOC entry 5833 (class 0 OID 0)
-- Dependencies: 657
-- Name: FUNCTION gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) TO service_role;


--
-- TOC entry 5834 (class 0 OID 0)
-- Dependencies: 559
-- Name: FUNCTION gin_extract_value_trgm(text, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gin_extract_value_trgm(text, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gin_extract_value_trgm(text, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gin_extract_value_trgm(text, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gin_extract_value_trgm(text, internal) TO service_role;


--
-- TOC entry 5835 (class 0 OID 0)
-- Dependencies: 484
-- Name: FUNCTION gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) TO service_role;


--
-- TOC entry 5836 (class 0 OID 0)
-- Dependencies: 765
-- Name: FUNCTION gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) TO service_role;


--
-- TOC entry 5838 (class 0 OID 0)
-- Dependencies: 721
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- TOC entry 5840 (class 0 OID 0)
-- Dependencies: 673
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5842 (class 0 OID 0)
-- Dependencies: 595
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- TOC entry 5843 (class 0 OID 0)
-- Dependencies: 821
-- Name: FUNCTION gtrgm_compress(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_compress(internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_compress(internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_compress(internal) TO service_role;


--
-- TOC entry 5844 (class 0 OID 0)
-- Dependencies: 755
-- Name: FUNCTION gtrgm_consistent(internal, text, smallint, oid, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_consistent(internal, text, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_consistent(internal, text, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_consistent(internal, text, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_consistent(internal, text, smallint, oid, internal) TO service_role;


--
-- TOC entry 5845 (class 0 OID 0)
-- Dependencies: 555
-- Name: FUNCTION gtrgm_decompress(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_decompress(internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_decompress(internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_decompress(internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_decompress(internal) TO service_role;


--
-- TOC entry 5846 (class 0 OID 0)
-- Dependencies: 830
-- Name: FUNCTION gtrgm_distance(internal, text, smallint, oid, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_distance(internal, text, smallint, oid, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_distance(internal, text, smallint, oid, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_distance(internal, text, smallint, oid, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_distance(internal, text, smallint, oid, internal) TO service_role;


--
-- TOC entry 5847 (class 0 OID 0)
-- Dependencies: 686
-- Name: FUNCTION gtrgm_options(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_options(internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_options(internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_options(internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_options(internal) TO service_role;


--
-- TOC entry 5848 (class 0 OID 0)
-- Dependencies: 680
-- Name: FUNCTION gtrgm_penalty(internal, internal, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_penalty(internal, internal, internal) TO service_role;


--
-- TOC entry 5849 (class 0 OID 0)
-- Dependencies: 611
-- Name: FUNCTION gtrgm_picksplit(internal, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_picksplit(internal, internal) TO service_role;


--
-- TOC entry 5850 (class 0 OID 0)
-- Dependencies: 562
-- Name: FUNCTION gtrgm_same(extensions.gtrgm, extensions.gtrgm, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_same(extensions.gtrgm, extensions.gtrgm, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_same(extensions.gtrgm, extensions.gtrgm, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_same(extensions.gtrgm, extensions.gtrgm, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_same(extensions.gtrgm, extensions.gtrgm, internal) TO service_role;


--
-- TOC entry 5851 (class 0 OID 0)
-- Dependencies: 732
-- Name: FUNCTION gtrgm_union(internal, internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.gtrgm_union(internal, internal) TO postgres;
GRANT ALL ON FUNCTION extensions.gtrgm_union(internal, internal) TO anon;
GRANT ALL ON FUNCTION extensions.gtrgm_union(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION extensions.gtrgm_union(internal, internal) TO service_role;


--
-- TOC entry 5852 (class 0 OID 0)
-- Dependencies: 549
-- Name: FUNCTION halfvec_accum(double precision[], extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_accum(double precision[], extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5853 (class 0 OID 0)
-- Dependencies: 694
-- Name: FUNCTION halfvec_add(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_add(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5854 (class 0 OID 0)
-- Dependencies: 647
-- Name: FUNCTION halfvec_avg(double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_avg(double precision[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5855 (class 0 OID 0)
-- Dependencies: 513
-- Name: FUNCTION halfvec_cmp(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_cmp(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5856 (class 0 OID 0)
-- Dependencies: 507
-- Name: FUNCTION halfvec_combine(double precision[], double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_combine(double precision[], double precision[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5857 (class 0 OID 0)
-- Dependencies: 628
-- Name: FUNCTION halfvec_concat(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_concat(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5858 (class 0 OID 0)
-- Dependencies: 720
-- Name: FUNCTION halfvec_eq(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_eq(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5859 (class 0 OID 0)
-- Dependencies: 590
-- Name: FUNCTION halfvec_ge(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_ge(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5860 (class 0 OID 0)
-- Dependencies: 737
-- Name: FUNCTION halfvec_gt(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_gt(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5861 (class 0 OID 0)
-- Dependencies: 653
-- Name: FUNCTION halfvec_l2_squared_distance(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_l2_squared_distance(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5862 (class 0 OID 0)
-- Dependencies: 718
-- Name: FUNCTION halfvec_le(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_le(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5863 (class 0 OID 0)
-- Dependencies: 736
-- Name: FUNCTION halfvec_lt(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_lt(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5864 (class 0 OID 0)
-- Dependencies: 845
-- Name: FUNCTION halfvec_mul(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_mul(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5865 (class 0 OID 0)
-- Dependencies: 677
-- Name: FUNCTION halfvec_ne(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_ne(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5866 (class 0 OID 0)
-- Dependencies: 810
-- Name: FUNCTION halfvec_negative_inner_product(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_negative_inner_product(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5867 (class 0 OID 0)
-- Dependencies: 767
-- Name: FUNCTION halfvec_spherical_distance(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_spherical_distance(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5868 (class 0 OID 0)
-- Dependencies: 597
-- Name: FUNCTION halfvec_sub(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.halfvec_sub(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5869 (class 0 OID 0)
-- Dependencies: 757
-- Name: FUNCTION hamming_distance(bit, bit); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hamming_distance(bit, bit) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5870 (class 0 OID 0)
-- Dependencies: 523
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5871 (class 0 OID 0)
-- Dependencies: 813
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- TOC entry 5872 (class 0 OID 0)
-- Dependencies: 782
-- Name: FUNCTION hnsw_bit_support(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hnsw_bit_support(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5873 (class 0 OID 0)
-- Dependencies: 672
-- Name: FUNCTION hnsw_halfvec_support(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hnsw_halfvec_support(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5874 (class 0 OID 0)
-- Dependencies: 539
-- Name: FUNCTION hnsw_sparsevec_support(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hnsw_sparsevec_support(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5875 (class 0 OID 0)
-- Dependencies: 698
-- Name: FUNCTION hnswhandler(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hnswhandler(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5876 (class 0 OID 0)
-- Dependencies: 833
-- Name: FUNCTION hypopg(OUT indexname text, OUT indexrelid oid, OUT indrelid oid, OUT innatts integer, OUT indisunique boolean, OUT indkey int2vector, OUT indcollation oidvector, OUT indclass oidvector, OUT indoption oidvector, OUT indexprs pg_node_tree, OUT indpred pg_node_tree, OUT amid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg(OUT indexname text, OUT indexrelid oid, OUT indrelid oid, OUT innatts integer, OUT indisunique boolean, OUT indkey int2vector, OUT indcollation oidvector, OUT indclass oidvector, OUT indoption oidvector, OUT indexprs pg_node_tree, OUT indpred pg_node_tree, OUT amid oid) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5877 (class 0 OID 0)
-- Dependencies: 842
-- Name: FUNCTION hypopg_create_index(sql_order text, OUT indexrelid oid, OUT indexname text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_create_index(sql_order text, OUT indexrelid oid, OUT indexname text) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5878 (class 0 OID 0)
-- Dependencies: 847
-- Name: FUNCTION hypopg_drop_index(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_drop_index(indexid oid) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5879 (class 0 OID 0)
-- Dependencies: 670
-- Name: FUNCTION hypopg_get_indexdef(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_get_indexdef(indexid oid) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5880 (class 0 OID 0)
-- Dependencies: 499
-- Name: FUNCTION hypopg_hidden_indexes(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_hidden_indexes() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5881 (class 0 OID 0)
-- Dependencies: 498
-- Name: FUNCTION hypopg_hide_index(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_hide_index(indexid oid) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5882 (class 0 OID 0)
-- Dependencies: 733
-- Name: FUNCTION hypopg_relation_size(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_relation_size(indexid oid) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5883 (class 0 OID 0)
-- Dependencies: 734
-- Name: FUNCTION hypopg_reset(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_reset() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5884 (class 0 OID 0)
-- Dependencies: 753
-- Name: FUNCTION hypopg_reset_index(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_reset_index() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5885 (class 0 OID 0)
-- Dependencies: 807
-- Name: FUNCTION hypopg_unhide_all_indexes(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_unhide_all_indexes() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5886 (class 0 OID 0)
-- Dependencies: 594
-- Name: FUNCTION hypopg_unhide_index(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_unhide_index(indexid oid) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5887 (class 0 OID 0)
-- Dependencies: 824
-- Name: FUNCTION index_advisor(query text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.index_advisor(query text) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5888 (class 0 OID 0)
-- Dependencies: 748
-- Name: FUNCTION inner_product(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.inner_product(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5889 (class 0 OID 0)
-- Dependencies: 571
-- Name: FUNCTION inner_product(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.inner_product(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5890 (class 0 OID 0)
-- Dependencies: 527
-- Name: FUNCTION inner_product(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.inner_product(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5891 (class 0 OID 0)
-- Dependencies: 760
-- Name: FUNCTION ivfflat_bit_support(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.ivfflat_bit_support(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5892 (class 0 OID 0)
-- Dependencies: 567
-- Name: FUNCTION ivfflat_halfvec_support(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.ivfflat_halfvec_support(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5893 (class 0 OID 0)
-- Dependencies: 799
-- Name: FUNCTION ivfflathandler(internal); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.ivfflathandler(internal) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5894 (class 0 OID 0)
-- Dependencies: 781
-- Name: FUNCTION jaccard_distance(bit, bit); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.jaccard_distance(bit, bit) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5895 (class 0 OID 0)
-- Dependencies: 515
-- Name: FUNCTION l1_distance(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l1_distance(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5896 (class 0 OID 0)
-- Dependencies: 817
-- Name: FUNCTION l1_distance(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l1_distance(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5897 (class 0 OID 0)
-- Dependencies: 795
-- Name: FUNCTION l1_distance(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l1_distance(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5898 (class 0 OID 0)
-- Dependencies: 822
-- Name: FUNCTION l2_distance(extensions.halfvec, extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_distance(extensions.halfvec, extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5899 (class 0 OID 0)
-- Dependencies: 787
-- Name: FUNCTION l2_distance(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_distance(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5900 (class 0 OID 0)
-- Dependencies: 661
-- Name: FUNCTION l2_distance(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_distance(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5901 (class 0 OID 0)
-- Dependencies: 568
-- Name: FUNCTION l2_norm(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_norm(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5902 (class 0 OID 0)
-- Dependencies: 606
-- Name: FUNCTION l2_norm(extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_norm(extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5903 (class 0 OID 0)
-- Dependencies: 502
-- Name: FUNCTION l2_normalize(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_normalize(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5904 (class 0 OID 0)
-- Dependencies: 666
-- Name: FUNCTION l2_normalize(extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_normalize(extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5905 (class 0 OID 0)
-- Dependencies: 826
-- Name: FUNCTION l2_normalize(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.l2_normalize(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5906 (class 0 OID 0)
-- Dependencies: 758
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- TOC entry 5907 (class 0 OID 0)
-- Dependencies: 834
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- TOC entry 5908 (class 0 OID 0)
-- Dependencies: 735
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- TOC entry 5909 (class 0 OID 0)
-- Dependencies: 607
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- TOC entry 5910 (class 0 OID 0)
-- Dependencies: 601
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- TOC entry 5911 (class 0 OID 0)
-- Dependencies: 802
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- TOC entry 5912 (class 0 OID 0)
-- Dependencies: 491
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5913 (class 0 OID 0)
-- Dependencies: 806
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- TOC entry 5914 (class 0 OID 0)
-- Dependencies: 531
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- TOC entry 5915 (class 0 OID 0)
-- Dependencies: 825
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5916 (class 0 OID 0)
-- Dependencies: 818
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- TOC entry 5917 (class 0 OID 0)
-- Dependencies: 619
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- TOC entry 5918 (class 0 OID 0)
-- Dependencies: 612
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- TOC entry 5919 (class 0 OID 0)
-- Dependencies: 581
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- TOC entry 5920 (class 0 OID 0)
-- Dependencies: 796
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 5921 (class 0 OID 0)
-- Dependencies: 798
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- TOC entry 5922 (class 0 OID 0)
-- Dependencies: 616
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- TOC entry 5923 (class 0 OID 0)
-- Dependencies: 803
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- TOC entry 5924 (class 0 OID 0)
-- Dependencies: 797
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- TOC entry 5925 (class 0 OID 0)
-- Dependencies: 853
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- TOC entry 5926 (class 0 OID 0)
-- Dependencies: 651
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- TOC entry 5927 (class 0 OID 0)
-- Dependencies: 542
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- TOC entry 5928 (class 0 OID 0)
-- Dependencies: 808
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- TOC entry 5929 (class 0 OID 0)
-- Dependencies: 488
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5930 (class 0 OID 0)
-- Dependencies: 759
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5932 (class 0 OID 0)
-- Dependencies: 519
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5933 (class 0 OID 0)
-- Dependencies: 565
-- Name: FUNCTION set_limit(real); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_limit(real) TO postgres;
GRANT ALL ON FUNCTION extensions.set_limit(real) TO anon;
GRANT ALL ON FUNCTION extensions.set_limit(real) TO authenticated;
GRANT ALL ON FUNCTION extensions.set_limit(real) TO service_role;


--
-- TOC entry 5934 (class 0 OID 0)
-- Dependencies: 727
-- Name: FUNCTION show_limit(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.show_limit() TO postgres;
GRANT ALL ON FUNCTION extensions.show_limit() TO anon;
GRANT ALL ON FUNCTION extensions.show_limit() TO authenticated;
GRANT ALL ON FUNCTION extensions.show_limit() TO service_role;


--
-- TOC entry 5935 (class 0 OID 0)
-- Dependencies: 706
-- Name: FUNCTION show_trgm(text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.show_trgm(text) TO postgres;
GRANT ALL ON FUNCTION extensions.show_trgm(text) TO anon;
GRANT ALL ON FUNCTION extensions.show_trgm(text) TO authenticated;
GRANT ALL ON FUNCTION extensions.show_trgm(text) TO service_role;


--
-- TOC entry 5936 (class 0 OID 0)
-- Dependencies: 524
-- Name: FUNCTION similarity(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.similarity(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.similarity(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.similarity(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.similarity(text, text) TO service_role;


--
-- TOC entry 5937 (class 0 OID 0)
-- Dependencies: 708
-- Name: FUNCTION similarity_dist(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.similarity_dist(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.similarity_dist(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.similarity_dist(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.similarity_dist(text, text) TO service_role;


--
-- TOC entry 5938 (class 0 OID 0)
-- Dependencies: 645
-- Name: FUNCTION similarity_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.similarity_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.similarity_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.similarity_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.similarity_op(text, text) TO service_role;


--
-- TOC entry 5939 (class 0 OID 0)
-- Dependencies: 776
-- Name: FUNCTION sparsevec_cmp(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_cmp(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5940 (class 0 OID 0)
-- Dependencies: 551
-- Name: FUNCTION sparsevec_eq(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_eq(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5941 (class 0 OID 0)
-- Dependencies: 629
-- Name: FUNCTION sparsevec_ge(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_ge(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5942 (class 0 OID 0)
-- Dependencies: 850
-- Name: FUNCTION sparsevec_gt(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_gt(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5943 (class 0 OID 0)
-- Dependencies: 583
-- Name: FUNCTION sparsevec_l2_squared_distance(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_l2_squared_distance(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5944 (class 0 OID 0)
-- Dependencies: 788
-- Name: FUNCTION sparsevec_le(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_le(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5945 (class 0 OID 0)
-- Dependencies: 614
-- Name: FUNCTION sparsevec_lt(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_lt(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5946 (class 0 OID 0)
-- Dependencies: 768
-- Name: FUNCTION sparsevec_ne(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_ne(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5947 (class 0 OID 0)
-- Dependencies: 710
-- Name: FUNCTION sparsevec_negative_inner_product(extensions.sparsevec, extensions.sparsevec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sparsevec_negative_inner_product(extensions.sparsevec, extensions.sparsevec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5948 (class 0 OID 0)
-- Dependencies: 812
-- Name: FUNCTION strict_word_similarity(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.strict_word_similarity(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.strict_word_similarity(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.strict_word_similarity(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.strict_word_similarity(text, text) TO service_role;


--
-- TOC entry 5949 (class 0 OID 0)
-- Dependencies: 545
-- Name: FUNCTION strict_word_similarity_commutator_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.strict_word_similarity_commutator_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_commutator_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_commutator_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_commutator_op(text, text) TO service_role;


--
-- TOC entry 5950 (class 0 OID 0)
-- Dependencies: 831
-- Name: FUNCTION strict_word_similarity_dist_commutator_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_commutator_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_commutator_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_commutator_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_commutator_op(text, text) TO service_role;


--
-- TOC entry 5951 (class 0 OID 0)
-- Dependencies: 495
-- Name: FUNCTION strict_word_similarity_dist_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_dist_op(text, text) TO service_role;


--
-- TOC entry 5952 (class 0 OID 0)
-- Dependencies: 486
-- Name: FUNCTION strict_word_similarity_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.strict_word_similarity_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.strict_word_similarity_op(text, text) TO service_role;


--
-- TOC entry 5953 (class 0 OID 0)
-- Dependencies: 761
-- Name: FUNCTION subvector(extensions.halfvec, integer, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.subvector(extensions.halfvec, integer, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5954 (class 0 OID 0)
-- Dependencies: 746
-- Name: FUNCTION subvector(extensions.vector, integer, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.subvector(extensions.vector, integer, integer) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5955 (class 0 OID 0)
-- Dependencies: 620
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- TOC entry 5956 (class 0 OID 0)
-- Dependencies: 775
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- TOC entry 5957 (class 0 OID 0)
-- Dependencies: 490
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- TOC entry 5958 (class 0 OID 0)
-- Dependencies: 540
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- TOC entry 5959 (class 0 OID 0)
-- Dependencies: 577
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- TOC entry 5960 (class 0 OID 0)
-- Dependencies: 711
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- TOC entry 5961 (class 0 OID 0)
-- Dependencies: 582
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- TOC entry 5962 (class 0 OID 0)
-- Dependencies: 811
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- TOC entry 5963 (class 0 OID 0)
-- Dependencies: 697
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- TOC entry 5964 (class 0 OID 0)
-- Dependencies: 714
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- TOC entry 5965 (class 0 OID 0)
-- Dependencies: 805
-- Name: FUNCTION vector_accum(double precision[], extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_accum(double precision[], extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5966 (class 0 OID 0)
-- Dependencies: 843
-- Name: FUNCTION vector_add(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_add(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5967 (class 0 OID 0)
-- Dependencies: 655
-- Name: FUNCTION vector_avg(double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_avg(double precision[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5968 (class 0 OID 0)
-- Dependencies: 573
-- Name: FUNCTION vector_cmp(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_cmp(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5969 (class 0 OID 0)
-- Dependencies: 587
-- Name: FUNCTION vector_combine(double precision[], double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_combine(double precision[], double precision[]) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5970 (class 0 OID 0)
-- Dependencies: 492
-- Name: FUNCTION vector_concat(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_concat(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5971 (class 0 OID 0)
-- Dependencies: 553
-- Name: FUNCTION vector_dims(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_dims(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5972 (class 0 OID 0)
-- Dependencies: 563
-- Name: FUNCTION vector_dims(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_dims(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5973 (class 0 OID 0)
-- Dependencies: 713
-- Name: FUNCTION vector_eq(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_eq(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5974 (class 0 OID 0)
-- Dependencies: 792
-- Name: FUNCTION vector_ge(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_ge(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5975 (class 0 OID 0)
-- Dependencies: 579
-- Name: FUNCTION vector_gt(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_gt(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5976 (class 0 OID 0)
-- Dependencies: 493
-- Name: FUNCTION vector_l2_squared_distance(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_l2_squared_distance(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5977 (class 0 OID 0)
-- Dependencies: 740
-- Name: FUNCTION vector_le(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_le(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5978 (class 0 OID 0)
-- Dependencies: 633
-- Name: FUNCTION vector_lt(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_lt(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5979 (class 0 OID 0)
-- Dependencies: 766
-- Name: FUNCTION vector_mul(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_mul(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5980 (class 0 OID 0)
-- Dependencies: 635
-- Name: FUNCTION vector_ne(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_ne(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5981 (class 0 OID 0)
-- Dependencies: 511
-- Name: FUNCTION vector_negative_inner_product(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_negative_inner_product(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5982 (class 0 OID 0)
-- Dependencies: 639
-- Name: FUNCTION vector_norm(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_norm(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5983 (class 0 OID 0)
-- Dependencies: 773
-- Name: FUNCTION vector_spherical_distance(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_spherical_distance(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5984 (class 0 OID 0)
-- Dependencies: 580
-- Name: FUNCTION vector_sub(extensions.vector, extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.vector_sub(extensions.vector, extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 5985 (class 0 OID 0)
-- Dependencies: 687
-- Name: FUNCTION word_similarity(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.word_similarity(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.word_similarity(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.word_similarity(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.word_similarity(text, text) TO service_role;


--
-- TOC entry 5986 (class 0 OID 0)
-- Dependencies: 693
-- Name: FUNCTION word_similarity_commutator_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.word_similarity_commutator_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.word_similarity_commutator_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.word_similarity_commutator_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.word_similarity_commutator_op(text, text) TO service_role;


--
-- TOC entry 5987 (class 0 OID 0)
-- Dependencies: 689
-- Name: FUNCTION word_similarity_dist_commutator_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.word_similarity_dist_commutator_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.word_similarity_dist_commutator_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.word_similarity_dist_commutator_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.word_similarity_dist_commutator_op(text, text) TO service_role;


--
-- TOC entry 5988 (class 0 OID 0)
-- Dependencies: 839
-- Name: FUNCTION word_similarity_dist_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.word_similarity_dist_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.word_similarity_dist_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.word_similarity_dist_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.word_similarity_dist_op(text, text) TO service_role;


--
-- TOC entry 5989 (class 0 OID 0)
-- Dependencies: 793
-- Name: FUNCTION word_similarity_op(text, text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.word_similarity_op(text, text) TO postgres;
GRANT ALL ON FUNCTION extensions.word_similarity_op(text, text) TO anon;
GRANT ALL ON FUNCTION extensions.word_similarity_op(text, text) TO authenticated;
GRANT ALL ON FUNCTION extensions.word_similarity_op(text, text) TO service_role;


--
-- TOC entry 5990 (class 0 OID 0)
-- Dependencies: 814
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- TOC entry 5991 (class 0 OID 0)
-- Dependencies: 528
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- TOC entry 5992 (class 0 OID 0)
-- Dependencies: 618
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- TOC entry 5993 (class 0 OID 0)
-- Dependencies: 652
-- Name: FUNCTION _mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public._mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]) TO anon;
GRANT ALL ON FUNCTION public._mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]) TO authenticated;
GRANT ALL ON FUNCTION public._mv_merge_policies(tname text, pol_cmd text, roles name[], new_policy text, old_policies text[]) TO service_role;


--
-- TOC entry 5994 (class 0 OID 0)
-- Dependencies: 840
-- Name: FUNCTION _touch_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public._touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public._touch_updated_at() TO service_role;


--
-- TOC entry 5995 (class 0 OID 0)
-- Dependencies: 841
-- Name: FUNCTION _trg_job_run_log_coalesce_total_tokens(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._trg_job_run_log_coalesce_total_tokens() TO anon;
GRANT ALL ON FUNCTION public._trg_job_run_log_coalesce_total_tokens() TO authenticated;
GRANT ALL ON FUNCTION public._trg_job_run_log_coalesce_total_tokens() TO service_role;


--
-- TOC entry 5996 (class 0 OID 0)
-- Dependencies: 763
-- Name: FUNCTION _trg_sync_title_genres(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._trg_sync_title_genres() TO anon;
GRANT ALL ON FUNCTION public._trg_sync_title_genres() TO authenticated;
GRANT ALL ON FUNCTION public._trg_sync_title_genres() TO service_role;


--
-- TOC entry 5997 (class 0 OID 0)
-- Dependencies: 556
-- Name: FUNCTION admin_list_cron_jobs(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_list_cron_jobs() TO anon;
GRANT ALL ON FUNCTION public.admin_list_cron_jobs() TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_cron_jobs() TO service_role;


--
-- TOC entry 5998 (class 0 OID 0)
-- Dependencies: 668
-- Name: FUNCTION admin_run_cron_job(p_jobname text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_run_cron_job(p_jobname text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_run_cron_job(p_jobname text) TO anon;
GRANT ALL ON FUNCTION public.admin_run_cron_job(p_jobname text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_run_cron_job(p_jobname text) TO service_role;


--
-- TOC entry 5999 (class 0 OID 0)
-- Dependencies: 538
-- Name: FUNCTION admin_search_users(p_search text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_search_users(p_search text, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_search_users(p_search text, p_limit integer, p_offset integer) TO service_role;
GRANT ALL ON FUNCTION public.admin_search_users(p_search text, p_limit integer, p_offset integer) TO authenticated;


--
-- TOC entry 6000 (class 0 OID 0)
-- Dependencies: 783
-- Name: FUNCTION admin_set_cron_active(p_jobname text, p_active boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean) TO service_role;


--
-- TOC entry 6001 (class 0 OID 0)
-- Dependencies: 648
-- Name: FUNCTION admin_set_cron_schedule(p_jobname text, p_schedule text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_set_cron_schedule(p_jobname text, p_schedule text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_cron_schedule(p_jobname text, p_schedule text) TO anon;
GRANT ALL ON FUNCTION public.admin_set_cron_schedule(p_jobname text, p_schedule text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_cron_schedule(p_jobname text, p_schedule text) TO service_role;


--
-- TOC entry 6002 (class 0 OID 0)
-- Dependencies: 591
-- Name: FUNCTION apply_media_event_to_daily_rollup(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_media_event_to_daily_rollup() TO anon;
GRANT ALL ON FUNCTION public.apply_media_event_to_daily_rollup() TO authenticated;
GRANT ALL ON FUNCTION public.apply_media_event_to_daily_rollup() TO service_role;


--
-- TOC entry 6003 (class 0 OID 0)
-- Dependencies: 752
-- Name: FUNCTION apply_media_event_to_feedback(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_media_event_to_feedback() TO anon;
GRANT ALL ON FUNCTION public.apply_media_event_to_feedback() TO authenticated;
GRANT ALL ON FUNCTION public.apply_media_event_to_feedback() TO service_role;


--
-- TOC entry 6004 (class 0 OID 0)
-- Dependencies: 514
-- Name: FUNCTION assert_admin(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.assert_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assert_admin() TO anon;
GRANT ALL ON FUNCTION public.assert_admin() TO authenticated;
GRANT ALL ON FUNCTION public.assert_admin() TO service_role;


--
-- TOC entry 6005 (class 0 OID 0)
-- Dependencies: 557
-- Name: FUNCTION bump_conversation_on_participant_change(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.bump_conversation_on_participant_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_conversation_on_participant_change() TO anon;
GRANT ALL ON FUNCTION public.bump_conversation_on_participant_change() TO authenticated;
GRANT ALL ON FUNCTION public.bump_conversation_on_participant_change() TO service_role;


--
-- TOC entry 6006 (class 0 OID 0)
-- Dependencies: 726
-- Name: FUNCTION bump_conversation_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.bump_conversation_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.bump_conversation_updated_at() TO anon;
GRANT ALL ON FUNCTION public.bump_conversation_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.bump_conversation_updated_at() TO service_role;


--
-- TOC entry 6007 (class 0 OID 0)
-- Dependencies: 489
-- Name: FUNCTION can_view_profile(target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.can_view_profile(target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_view_profile(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_profile(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_profile(target_user_id uuid) TO service_role;


--
-- TOC entry 6008 (class 0 OID 0)
-- Dependencies: 554
-- Name: FUNCTION canonicalize_direct_participant_ids(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.canonicalize_direct_participant_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.canonicalize_direct_participant_ids() TO anon;
GRANT ALL ON FUNCTION public.canonicalize_direct_participant_ids() TO authenticated;
GRANT ALL ON FUNCTION public.canonicalize_direct_participant_ids() TO service_role;


--
-- TOC entry 6009 (class 0 OID 0)
-- Dependencies: 522
-- Name: FUNCTION cleanup_media_events(p_keep_days integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_media_events(p_keep_days integer) TO anon;
GRANT ALL ON FUNCTION public.cleanup_media_events(p_keep_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_media_events(p_keep_days integer) TO service_role;


--
-- TOC entry 6010 (class 0 OID 0)
-- Dependencies: 730
-- Name: FUNCTION cleanup_media_events_hybrid(p_keep_days_low_signal integer, p_keep_days_explicit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_media_events_hybrid(p_keep_days_low_signal integer, p_keep_days_explicit integer) TO anon;
GRANT ALL ON FUNCTION public.cleanup_media_events_hybrid(p_keep_days_low_signal integer, p_keep_days_explicit integer) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_media_events_hybrid(p_keep_days_low_signal integer, p_keep_days_explicit integer) TO service_role;


--
-- TOC entry 6011 (class 0 OID 0)
-- Dependencies: 851
-- Name: FUNCTION create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_direct_conversation_v1(p_creator_id uuid, p_target_user_id uuid) TO service_role;


--
-- TOC entry 6012 (class 0 OID 0)
-- Dependencies: 603
-- Name: FUNCTION enforce_message_payload_safety(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.enforce_message_payload_safety() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_message_payload_safety() TO anon;
GRANT ALL ON FUNCTION public.enforce_message_payload_safety() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_message_payload_safety() TO service_role;


--
-- TOC entry 6013 (class 0 OID 0)
-- Dependencies: 681
-- Name: FUNCTION enforce_reaction_conversation_match(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.enforce_reaction_conversation_match() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_reaction_conversation_match() TO anon;
GRANT ALL ON FUNCTION public.enforce_reaction_conversation_match() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_reaction_conversation_match() TO service_role;


--
-- TOC entry 6014 (class 0 OID 0)
-- Dependencies: 729
-- Name: FUNCTION enforce_reaction_message_scope_v1(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enforce_reaction_message_scope_v1() TO anon;
GRANT ALL ON FUNCTION public.enforce_reaction_message_scope_v1() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_reaction_message_scope_v1() TO service_role;


--
-- TOC entry 6015 (class 0 OID 0)
-- Dependencies: 660
-- Name: FUNCTION get_conversation_summaries(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_conversation_summaries() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_conversation_summaries() TO authenticated;
GRANT ALL ON FUNCTION public.get_conversation_summaries() TO service_role;


--
-- TOC entry 6016 (class 0 OID 0)
-- Dependencies: 564
-- Name: FUNCTION get_conversation_summaries(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_conversation_summaries(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_conversation_summaries(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_conversation_summaries(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_conversation_summaries(p_user_id uuid) TO service_role;


--
-- TOC entry 6017 (class 0 OID 0)
-- Dependencies: 719
-- Name: FUNCTION get_conversation_summaries_for_user(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_conversation_summaries_for_user(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_conversation_summaries_for_user(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_conversation_summaries_for_user(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_conversation_summaries_for_user(p_user_id uuid) TO service_role;


--
-- TOC entry 6018 (class 0 OID 0)
-- Dependencies: 849
-- Name: FUNCTION get_diary_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_diary_stats(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_diary_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_diary_stats(p_user_id uuid) TO service_role;


--
-- TOC entry 6019 (class 0 OID 0)
-- Dependencies: 739
-- Name: FUNCTION get_embedding_settings_v1(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_embedding_settings_v1() TO anon;
GRANT ALL ON FUNCTION public.get_embedding_settings_v1() TO authenticated;
GRANT ALL ON FUNCTION public.get_embedding_settings_v1() TO service_role;


--
-- TOC entry 6020 (class 0 OID 0)
-- Dependencies: 410
-- Name: TABLE activity_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_events TO anon;
GRANT ALL ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;


--
-- TOC entry 6021 (class 0 OID 0)
-- Dependencies: 664
-- Name: FUNCTION get_home_feed(p_user_id uuid, p_limit integer, p_cursor timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_home_feed(p_user_id uuid, p_limit integer, p_cursor timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_home_feed(p_user_id uuid, p_limit integer, p_cursor timestamp with time zone) TO service_role;


--
-- TOC entry 6022 (class 0 OID 0)
-- Dependencies: 504
-- Name: FUNCTION get_home_feed_v2(p_user_id uuid, p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_home_feed_v2(p_user_id uuid, p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_home_feed_v2(p_user_id uuid, p_limit integer, p_cursor_created_at timestamp with time zone, p_cursor_id uuid) TO service_role;


--
-- TOC entry 6024 (class 0 OID 0)
-- Dependencies: 744
-- Name: FUNCTION get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb) TO anon;
GRANT ALL ON FUNCTION public.get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.get_personalized_recommendations_v3(p_user_id uuid, p_session_id uuid, p_section text, p_seed_media_id uuid, p_limit integer, p_exclude_watched boolean, p_quality_floor_imdb numeric, p_quality_floor_rt numeric, p_runtime_preference text, p_context jsonb) TO service_role;


--
-- TOC entry 6025 (class 0 OID 0)
-- Dependencies: 518
-- Name: FUNCTION get_recommendation_ctr(p_section text, p_context jsonb, p_days integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_recommendation_ctr(p_section text, p_context jsonb, p_days integer) TO anon;
GRANT ALL ON FUNCTION public.get_recommendation_ctr(p_section text, p_context jsonb, p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_recommendation_ctr(p_section text, p_context jsonb, p_days integer) TO service_role;


--
-- TOC entry 6026 (class 0 OID 0)
-- Dependencies: 536
-- Name: FUNCTION handle_auth_user_updated(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_auth_user_updated() TO anon;
GRANT ALL ON FUNCTION public.handle_auth_user_updated() TO authenticated;
GRANT ALL ON FUNCTION public.handle_auth_user_updated() TO service_role;


--
-- TOC entry 6027 (class 0 OID 0)
-- Dependencies: 804
-- Name: FUNCTION handle_new_auth_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_auth_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO service_role;


--
-- TOC entry 6028 (class 0 OID 0)
-- Dependencies: 650
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- TOC entry 6029 (class 0 OID 0)
-- Dependencies: 750
-- Name: FUNCTION increment_recommendation_impressions_performance(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increment_recommendation_impressions_performance() TO anon;
GRANT ALL ON FUNCTION public.increment_recommendation_impressions_performance() TO authenticated;
GRANT ALL ON FUNCTION public.increment_recommendation_impressions_performance() TO service_role;


--
-- TOC entry 6030 (class 0 OID 0)
-- Dependencies: 623
-- Name: FUNCTION invoke_media_backfill_daily(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.invoke_media_backfill_daily() TO anon;
GRANT ALL ON FUNCTION public.invoke_media_backfill_daily() TO authenticated;
GRANT ALL ON FUNCTION public.invoke_media_backfill_daily() TO service_role;


--
-- TOC entry 6031 (class 0 OID 0)
-- Dependencies: 819
-- Name: FUNCTION invoke_media_embed_backfill_edge_with_anon_key(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.invoke_media_embed_backfill_edge_with_anon_key() TO anon;
GRANT ALL ON FUNCTION public.invoke_media_embed_backfill_edge_with_anon_key() TO authenticated;
GRANT ALL ON FUNCTION public.invoke_media_embed_backfill_edge_with_anon_key() TO service_role;


--
-- TOC entry 6032 (class 0 OID 0)
-- Dependencies: 534
-- Name: FUNCTION invoke_media_embed_backfill_voyage_edge_with_anon_key(batch_size integer, reembed boolean, kind text, task text, dimensions integer, model text, use_saved_cursor boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.invoke_media_embed_backfill_voyage_edge_with_anon_key(batch_size integer, reembed boolean, kind text, task text, dimensions integer, model text, use_saved_cursor boolean) TO anon;
GRANT ALL ON FUNCTION public.invoke_media_embed_backfill_voyage_edge_with_anon_key(batch_size integer, reembed boolean, kind text, task text, dimensions integer, model text, use_saved_cursor boolean) TO authenticated;
GRANT ALL ON FUNCTION public.invoke_media_embed_backfill_voyage_edge_with_anon_key(batch_size integer, reembed boolean, kind text, task text, dimensions integer, model text, use_saved_cursor boolean) TO service_role;


--
-- TOC entry 6033 (class 0 OID 0)
-- Dependencies: 754
-- Name: FUNCTION invoke_media_trending_refresh_with_anon_key(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.invoke_media_trending_refresh_with_anon_key() TO anon;
GRANT ALL ON FUNCTION public.invoke_media_trending_refresh_with_anon_key() TO authenticated;
GRANT ALL ON FUNCTION public.invoke_media_trending_refresh_with_anon_key() TO service_role;


--
-- TOC entry 6034 (class 0 OID 0)
-- Dependencies: 520
-- Name: FUNCTION is_blocked(a uuid, b uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_blocked(a uuid, b uuid) TO anon;
GRANT ALL ON FUNCTION public.is_blocked(a uuid, b uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_blocked(a uuid, b uuid) TO service_role;


--
-- TOC entry 6035 (class 0 OID 0)
-- Dependencies: 505
-- Name: FUNCTION is_conversation_member(conv_id uuid, uid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_conversation_member(conv_id uuid, uid uuid) TO anon;
GRANT ALL ON FUNCTION public.is_conversation_member(conv_id uuid, uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_conversation_member(conv_id uuid, uid uuid) TO service_role;


--
-- TOC entry 6036 (class 0 OID 0)
-- Dependencies: 659
-- Name: FUNCTION is_follower(target uuid, candidate uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_follower(target uuid, candidate uuid) TO anon;
GRANT ALL ON FUNCTION public.is_follower(target uuid, candidate uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_follower(target uuid, candidate uuid) TO service_role;


--
-- TOC entry 6037 (class 0 OID 0)
-- Dependencies: 856
-- Name: FUNCTION is_service_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_service_role() TO anon;
GRANT ALL ON FUNCTION public.is_service_role() TO authenticated;
GRANT ALL ON FUNCTION public.is_service_role() TO service_role;


--
-- TOC entry 6038 (class 0 OID 0)
-- Dependencies: 494
-- Name: FUNCTION mark_conversation_read(p_conversation_id uuid, p_last_message_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_last_message_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_last_message_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_last_message_id uuid) TO service_role;


--
-- TOC entry 6039 (class 0 OID 0)
-- Dependencies: 569
-- Name: FUNCTION mark_notifications_read(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_notifications_read() TO anon;
GRANT ALL ON FUNCTION public.mark_notifications_read() TO authenticated;
GRANT ALL ON FUNCTION public.mark_notifications_read() TO service_role;


--
-- TOC entry 6040 (class 0 OID 0)
-- Dependencies: 609
-- Name: FUNCTION match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, year_min integer, year_max integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, year_min integer, year_max integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, year_min integer, year_max integer) TO anon;
GRANT ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, year_min integer, year_max integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, year_min integer, year_max integer) TO service_role;


--
-- TOC entry 6041 (class 0 OID 0)
-- Dependencies: 566
-- Name: FUNCTION match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, genre_filter text, year_min integer, year_max integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, genre_filter text, year_min integer, year_max integer) TO anon;
GRANT ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, genre_filter text, year_min integer, year_max integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_media_embeddings(query_embedding text, match_count integer, completeness_min numeric, kind_filter text, genre_filter text, year_min integer, year_max integer) TO service_role;


--
-- TOC entry 6042 (class 0 OID 0)
-- Dependencies: 622
-- Name: FUNCTION media_items_ensure_columns(flat jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.media_items_ensure_columns(flat jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.media_items_ensure_columns(flat jsonb) TO service_role;


--
-- TOC entry 6043 (class 0 OID 0)
-- Dependencies: 671
-- Name: FUNCTION media_items_promote_kind(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_items_promote_kind() TO anon;
GRANT ALL ON FUNCTION public.media_items_promote_kind() TO authenticated;
GRANT ALL ON FUNCTION public.media_items_promote_kind() TO service_role;


--
-- TOC entry 6044 (class 0 OID 0)
-- Dependencies: 762
-- Name: FUNCTION media_refresh_user_centroids_v1(p_user_id uuid, p_k integer, p_max_items integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_refresh_user_centroids_v1(p_user_id uuid, p_k integer, p_max_items integer) TO anon;
GRANT ALL ON FUNCTION public.media_refresh_user_centroids_v1(p_user_id uuid, p_k integer, p_max_items integer) TO authenticated;
GRANT ALL ON FUNCTION public.media_refresh_user_centroids_v1(p_user_id uuid, p_k integer, p_max_items integer) TO service_role;


--
-- TOC entry 6045 (class 0 OID 0)
-- Dependencies: 679
-- Name: FUNCTION media_swipe_brain_health_v1(p_session_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_swipe_brain_health_v1(p_session_id uuid) TO anon;
GRANT ALL ON FUNCTION public.media_swipe_brain_health_v1(p_session_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.media_swipe_brain_health_v1(p_session_id uuid) TO service_role;


--
-- TOC entry 6046 (class 0 OID 0)
-- Dependencies: 815
-- Name: FUNCTION media_swipe_deck_v2(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_swipe_deck_v2(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) TO anon;
GRANT ALL ON FUNCTION public.media_swipe_deck_v2(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) TO authenticated;
GRANT ALL ON FUNCTION public.media_swipe_deck_v2(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) TO service_role;


--
-- TOC entry 6047 (class 0 OID 0)
-- Dependencies: 741
-- Name: FUNCTION media_swipe_deck_v3(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_swipe_deck_v3(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) TO anon;
GRANT ALL ON FUNCTION public.media_swipe_deck_v3(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) TO authenticated;
GRANT ALL ON FUNCTION public.media_swipe_deck_v3(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text, p_seed text) TO service_role;


--
-- TOC entry 6048 (class 0 OID 0)
-- Dependencies: 854
-- Name: FUNCTION media_swipe_deck_v3_typed(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text[], p_seed integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_swipe_deck_v3_typed(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text[], p_seed integer) TO anon;
GRANT ALL ON FUNCTION public.media_swipe_deck_v3_typed(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text[], p_seed integer) TO authenticated;
GRANT ALL ON FUNCTION public.media_swipe_deck_v3_typed(p_session_id uuid, p_limit integer, p_mode text, p_kind_filter text[], p_seed integer) TO service_role;


--
-- TOC entry 6049 (class 0 OID 0)
-- Dependencies: 820
-- Name: FUNCTION media_update_taste_vectors_v1(p_session_id uuid, p_media_item_id uuid, p_event_type public.media_event_type, p_dwell_ms integer, p_rating_0_10 numeric, p_in_watchlist boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.media_update_taste_vectors_v1(p_session_id uuid, p_media_item_id uuid, p_event_type public.media_event_type, p_dwell_ms integer, p_rating_0_10 numeric, p_in_watchlist boolean) TO anon;
GRANT ALL ON FUNCTION public.media_update_taste_vectors_v1(p_session_id uuid, p_media_item_id uuid, p_event_type public.media_event_type, p_dwell_ms integer, p_rating_0_10 numeric, p_in_watchlist boolean) TO authenticated;
GRANT ALL ON FUNCTION public.media_update_taste_vectors_v1(p_session_id uuid, p_media_item_id uuid, p_event_type public.media_event_type, p_dwell_ms integer, p_rating_0_10 numeric, p_in_watchlist boolean) TO service_role;


--
-- TOC entry 6050 (class 0 OID 0)
-- Dependencies: 749
-- Name: FUNCTION messages_set_sender_id_v1(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.messages_set_sender_id_v1() TO anon;
GRANT ALL ON FUNCTION public.messages_set_sender_id_v1() TO authenticated;
GRANT ALL ON FUNCTION public.messages_set_sender_id_v1() TO service_role;


--
-- TOC entry 6051 (class 0 OID 0)
-- Dependencies: 605
-- Name: FUNCTION prevent_message_conversation_change(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.prevent_message_conversation_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_message_conversation_change() TO anon;
GRANT ALL ON FUNCTION public.prevent_message_conversation_change() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_message_conversation_change() TO service_role;


--
-- TOC entry 6052 (class 0 OID 0)
-- Dependencies: 526
-- Name: FUNCTION refresh_media_feedback_impressions_7d_v1(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.refresh_media_feedback_impressions_7d_v1(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.refresh_media_feedback_impressions_7d_v1(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_media_feedback_impressions_7d_v1(p_user_id uuid) TO service_role;


--
-- TOC entry 6053 (class 0 OID 0)
-- Dependencies: 835
-- Name: FUNCTION refresh_media_trending_scores(lookback_days integer, half_life_hours integer, completeness_min numeric); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.refresh_media_trending_scores(lookback_days integer, half_life_hours integer, completeness_min numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.refresh_media_trending_scores(lookback_days integer, half_life_hours integer, completeness_min numeric) TO anon;
GRANT ALL ON FUNCTION public.refresh_media_trending_scores(lookback_days integer, half_life_hours integer, completeness_min numeric) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_media_trending_scores(lookback_days integer, half_life_hours integer, completeness_min numeric) TO service_role;


--
-- TOC entry 6054 (class 0 OID 0)
-- Dependencies: 696
-- Name: FUNCTION reset_media_embed_backfill_cursor(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reset_media_embed_backfill_cursor() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_media_embed_backfill_cursor() TO anon;
GRANT ALL ON FUNCTION public.reset_media_embed_backfill_cursor() TO authenticated;
GRANT ALL ON FUNCTION public.reset_media_embed_backfill_cursor() TO service_role;


--
-- TOC entry 6055 (class 0 OID 0)
-- Dependencies: 725
-- Name: FUNCTION set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text) TO anon;
GRANT ALL ON FUNCTION public.set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text) TO authenticated;
GRANT ALL ON FUNCTION public.set_active_embedding_profile(p_provider text, p_model text, p_dimensions integer, p_task text) TO service_role;


--
-- TOC entry 6056 (class 0 OID 0)
-- Dependencies: 586
-- Name: FUNCTION set_media_rerank_cache_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_media_rerank_cache_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_media_rerank_cache_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_media_rerank_cache_updated_at() TO service_role;


--
-- TOC entry 6057 (class 0 OID 0)
-- Dependencies: 688
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- TOC entry 6058 (class 0 OID 0)
-- Dependencies: 663
-- Name: FUNCTION sync_profiles_public(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.sync_profiles_public() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_profiles_public() TO anon;
GRANT ALL ON FUNCTION public.sync_profiles_public() TO authenticated;
GRANT ALL ON FUNCTION public.sync_profiles_public() TO service_role;


--
-- TOC entry 6059 (class 0 OID 0)
-- Dependencies: 728
-- Name: FUNCTION sync_title_genres_for_media_item(p_title_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_title_genres_for_media_item(p_title_id uuid) TO anon;
GRANT ALL ON FUNCTION public.sync_title_genres_for_media_item(p_title_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.sync_title_genres_for_media_item(p_title_id uuid) TO service_role;


--
-- TOC entry 6060 (class 0 OID 0)
-- Dependencies: 598
-- Name: FUNCTION thompson_sample_exploration_rate(p_section text, p_context jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.thompson_sample_exploration_rate(p_section text, p_context jsonb) TO anon;
GRANT ALL ON FUNCTION public.thompson_sample_exploration_rate(p_section text, p_context jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.thompson_sample_exploration_rate(p_section text, p_context jsonb) TO service_role;


--
-- TOC entry 6061 (class 0 OID 0)
-- Dependencies: 716
-- Name: FUNCTION toggle_follow(p_target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.toggle_follow(p_target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.toggle_follow(p_target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_follow(p_target_user_id uuid) TO service_role;


--
-- TOC entry 6062 (class 0 OID 0)
-- Dependencies: 641
-- Name: FUNCTION touch_conversation_updated_at(_conversation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.touch_conversation_updated_at(_conversation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.touch_conversation_updated_at(_conversation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.touch_conversation_updated_at(_conversation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.touch_conversation_updated_at(_conversation_id uuid) TO service_role;


--
-- TOC entry 6063 (class 0 OID 0)
-- Dependencies: 699
-- Name: FUNCTION trg_audit_media_items_delete_func(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_audit_media_items_delete_func() TO anon;
GRANT ALL ON FUNCTION public.trg_audit_media_items_delete_func() TO authenticated;
GRANT ALL ON FUNCTION public.trg_audit_media_items_delete_func() TO service_role;


--
-- TOC entry 6064 (class 0 OID 0)
-- Dependencies: 702
-- Name: FUNCTION trg_audit_profiles_delete_func(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_audit_profiles_delete_func() TO anon;
GRANT ALL ON FUNCTION public.trg_audit_profiles_delete_func() TO authenticated;
GRANT ALL ON FUNCTION public.trg_audit_profiles_delete_func() TO service_role;


--
-- TOC entry 6065 (class 0 OID 0)
-- Dependencies: 496
-- Name: FUNCTION trg_media_items_fts_sync(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_media_items_fts_sync() TO anon;
GRANT ALL ON FUNCTION public.trg_media_items_fts_sync() TO authenticated;
GRANT ALL ON FUNCTION public.trg_media_items_fts_sync() TO service_role;


--
-- TOC entry 6066 (class 0 OID 0)
-- Dependencies: 695
-- Name: FUNCTION update_recommendation_performance(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_recommendation_performance() TO anon;
GRANT ALL ON FUNCTION public.update_recommendation_performance() TO authenticated;
GRANT ALL ON FUNCTION public.update_recommendation_performance() TO service_role;


--
-- TOC entry 6067 (class 0 OID 0)
-- Dependencies: 800
-- Name: FUNCTION validate_message_insert_v1(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_message_insert_v1() TO anon;
GRANT ALL ON FUNCTION public.validate_message_insert_v1() TO authenticated;
GRANT ALL ON FUNCTION public.validate_message_insert_v1() TO service_role;


--
-- TOC entry 6068 (class 0 OID 0)
-- Dependencies: 529
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- TOC entry 6069 (class 0 OID 0)
-- Dependencies: 705
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- TOC entry 6070 (class 0 OID 0)
-- Dependencies: 521
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- TOC entry 6071 (class 0 OID 0)
-- Dependencies: 644
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- TOC entry 6072 (class 0 OID 0)
-- Dependencies: 630
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- TOC entry 6073 (class 0 OID 0)
-- Dependencies: 779
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- TOC entry 6074 (class 0 OID 0)
-- Dependencies: 678
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- TOC entry 6075 (class 0 OID 0)
-- Dependencies: 784
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- TOC entry 6076 (class 0 OID 0)
-- Dependencies: 724
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- TOC entry 6077 (class 0 OID 0)
-- Dependencies: 723
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- TOC entry 6078 (class 0 OID 0)
-- Dependencies: 530
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- TOC entry 6079 (class 0 OID 0)
-- Dependencies: 789
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- TOC entry 6080 (class 0 OID 0)
-- Dependencies: 552
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- TOC entry 6081 (class 0 OID 0)
-- Dependencies: 517
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- TOC entry 6082 (class 0 OID 0)
-- Dependencies: 669
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- TOC entry 6083 (class 0 OID 0)
-- Dependencies: 1918
-- Name: FUNCTION avg(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.avg(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 6084 (class 0 OID 0)
-- Dependencies: 1916
-- Name: FUNCTION avg(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.avg(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 6085 (class 0 OID 0)
-- Dependencies: 1919
-- Name: FUNCTION sum(extensions.halfvec); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sum(extensions.halfvec) TO postgres WITH GRANT OPTION;


--
-- TOC entry 6086 (class 0 OID 0)
-- Dependencies: 1917
-- Name: FUNCTION sum(extensions.vector); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.sum(extensions.vector) TO postgres WITH GRANT OPTION;


--
-- TOC entry 6088 (class 0 OID 0)
-- Dependencies: 363
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- TOC entry 6090 (class 0 OID 0)
-- Dependencies: 380
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- TOC entry 6093 (class 0 OID 0)
-- Dependencies: 371
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- TOC entry 6095 (class 0 OID 0)
-- Dependencies: 362
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- TOC entry 6097 (class 0 OID 0)
-- Dependencies: 375
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- TOC entry 6099 (class 0 OID 0)
-- Dependencies: 374
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- TOC entry 6102 (class 0 OID 0)
-- Dependencies: 373
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- TOC entry 6103 (class 0 OID 0)
-- Dependencies: 383
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- TOC entry 6105 (class 0 OID 0)
-- Dependencies: 440
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- TOC entry 6106 (class 0 OID 0)
-- Dependencies: 382
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- TOC entry 6107 (class 0 OID 0)
-- Dependencies: 384
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- TOC entry 6108 (class 0 OID 0)
-- Dependencies: 381
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- TOC entry 6110 (class 0 OID 0)
-- Dependencies: 361
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- TOC entry 6112 (class 0 OID 0)
-- Dependencies: 360
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- TOC entry 6114 (class 0 OID 0)
-- Dependencies: 378
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- TOC entry 6116 (class 0 OID 0)
-- Dependencies: 379
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- TOC entry 6118 (class 0 OID 0)
-- Dependencies: 364
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- TOC entry 6123 (class 0 OID 0)
-- Dependencies: 372
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- TOC entry 6125 (class 0 OID 0)
-- Dependencies: 377
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- TOC entry 6128 (class 0 OID 0)
-- Dependencies: 376
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- TOC entry 6131 (class 0 OID 0)
-- Dependencies: 359
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- TOC entry 6132 (class 0 OID 0)
-- Dependencies: 437
-- Name: TABLE job; Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT SELECT ON TABLE cron.job TO postgres WITH GRANT OPTION;


--
-- TOC entry 6133 (class 0 OID 0)
-- Dependencies: 439
-- Name: TABLE job_run_details; Type: ACL; Schema: cron; Owner: supabase_admin
--

GRANT ALL ON TABLE cron.job_run_details TO postgres WITH GRANT OPTION;


--
-- TOC entry 6134 (class 0 OID 0)
-- Dependencies: 429
-- Name: TABLE hypopg_list_indexes; Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON TABLE extensions.hypopg_list_indexes TO postgres WITH GRANT OPTION;


--
-- TOC entry 6135 (class 0 OID 0)
-- Dependencies: 430
-- Name: TABLE hypopg_hidden_indexes; Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON TABLE extensions.hypopg_hidden_indexes TO postgres WITH GRANT OPTION;


--
-- TOC entry 6136 (class 0 OID 0)
-- Dependencies: 358
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- TOC entry 6137 (class 0 OID 0)
-- Dependencies: 357
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- TOC entry 6138 (class 0 OID 0)
-- Dependencies: 457
-- Name: TABLE embedding_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.embedding_settings TO service_role;


--
-- TOC entry 6139 (class 0 OID 0)
-- Dependencies: 458
-- Name: TABLE active_embedding_profile; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.active_embedding_profile TO service_role;


--
-- TOC entry 6140 (class 0 OID 0)
-- Dependencies: 463
-- Name: TABLE admin_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_audit_log TO anon;
GRANT ALL ON TABLE public.admin_audit_log TO authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;


--
-- TOC entry 6141 (class 0 OID 0)
-- Dependencies: 474
-- Name: TABLE admin_costs_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_costs_settings TO service_role;


--
-- TOC entry 6142 (class 0 OID 0)
-- Dependencies: 465
-- Name: TABLE admin_cron_registry; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_cron_registry TO anon;
GRANT ALL ON TABLE public.admin_cron_registry TO authenticated;
GRANT ALL ON TABLE public.admin_cron_registry TO service_role;


--
-- TOC entry 6143 (class 0 OID 0)
-- Dependencies: 462
-- Name: TABLE app_admins; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_admins TO anon;
GRANT ALL ON TABLE public.app_admins TO authenticated;
GRANT ALL ON TABLE public.app_admins TO service_role;


--
-- TOC entry 6144 (class 0 OID 0)
-- Dependencies: 425
-- Name: TABLE blocked_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.blocked_users TO anon;
GRANT ALL ON TABLE public.blocked_users TO authenticated;
GRANT ALL ON TABLE public.blocked_users TO service_role;


--
-- TOC entry 6145 (class 0 OID 0)
-- Dependencies: 409
-- Name: TABLE comment_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comment_likes TO anon;
GRANT ALL ON TABLE public.comment_likes TO authenticated;
GRANT ALL ON TABLE public.comment_likes TO service_role;


--
-- TOC entry 6146 (class 0 OID 0)
-- Dependencies: 404
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- TOC entry 6147 (class 0 OID 0)
-- Dependencies: 413
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_participants TO anon;
GRANT ALL ON TABLE public.conversation_participants TO authenticated;
GRANT ALL ON TABLE public.conversation_participants TO service_role;


--
-- TOC entry 6148 (class 0 OID 0)
-- Dependencies: 412
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- TOC entry 6149 (class 0 OID 0)
-- Dependencies: 407
-- Name: TABLE follows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.follows TO anon;
GRANT ALL ON TABLE public.follows TO authenticated;
GRANT ALL ON TABLE public.follows TO service_role;


--
-- TOC entry 6150 (class 0 OID 0)
-- Dependencies: 420
-- Name: TABLE genres; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.genres TO anon;
GRANT ALL ON TABLE public.genres TO authenticated;
GRANT ALL ON TABLE public.genres TO service_role;


--
-- TOC entry 6152 (class 0 OID 0)
-- Dependencies: 419
-- Name: SEQUENCE genres_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.genres_id_seq TO anon;
GRANT ALL ON SEQUENCE public.genres_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.genres_id_seq TO service_role;


--
-- TOC entry 6153 (class 0 OID 0)
-- Dependencies: 464
-- Name: TABLE job_run_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_run_log TO anon;
GRANT ALL ON TABLE public.job_run_log TO authenticated;
GRANT ALL ON TABLE public.job_run_log TO service_role;


--
-- TOC entry 6154 (class 0 OID 0)
-- Dependencies: 402
-- Name: TABLE library_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.library_entries TO anon;
GRANT ALL ON TABLE public.library_entries TO authenticated;
GRANT ALL ON TABLE public.library_entries TO service_role;


--
-- TOC entry 6155 (class 0 OID 0)
-- Dependencies: 406
-- Name: TABLE list_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.list_items TO anon;
GRANT ALL ON TABLE public.list_items TO authenticated;
GRANT ALL ON TABLE public.list_items TO service_role;


--
-- TOC entry 6156 (class 0 OID 0)
-- Dependencies: 405
-- Name: TABLE lists; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lists TO anon;
GRANT ALL ON TABLE public.lists TO authenticated;
GRANT ALL ON TABLE public.lists TO service_role;


--
-- TOC entry 6157 (class 0 OID 0)
-- Dependencies: 441
-- Name: TABLE media_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_items TO anon;
GRANT ALL ON TABLE public.media_items TO authenticated;
GRANT ALL ON TABLE public.media_items TO service_role;


--
-- TOC entry 6158 (class 0 OID 0)
-- Dependencies: 444
-- Name: TABLE media_catalog; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_catalog TO anon;
GRANT ALL ON TABLE public.media_catalog TO authenticated;
GRANT ALL ON TABLE public.media_catalog TO service_role;


--
-- TOC entry 6159 (class 0 OID 0)
-- Dependencies: 445
-- Name: TABLE media_embeddings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_embeddings TO service_role;


--
-- TOC entry 6160 (class 0 OID 0)
-- Dependencies: 459
-- Name: TABLE media_embeddings_active; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_embeddings_active TO service_role;


--
-- TOC entry 6161 (class 0 OID 0)
-- Dependencies: 446
-- Name: TABLE media_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_events TO anon;
GRANT ALL ON TABLE public.media_events TO authenticated;
GRANT ALL ON TABLE public.media_events TO service_role;


--
-- TOC entry 6162 (class 0 OID 0)
-- Dependencies: 447
-- Name: TABLE media_feedback; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_feedback TO anon;
GRANT ALL ON TABLE public.media_feedback TO authenticated;
GRANT ALL ON TABLE public.media_feedback TO service_role;


--
-- TOC entry 6163 (class 0 OID 0)
-- Dependencies: 473
-- Name: TABLE media_genres; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_genres TO anon;
GRANT ALL ON TABLE public.media_genres TO authenticated;
GRANT ALL ON TABLE public.media_genres TO service_role;


--
-- TOC entry 6164 (class 0 OID 0)
-- Dependencies: 452
-- Name: TABLE media_item_daily; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_item_daily TO service_role;


--
-- TOC entry 6165 (class 0 OID 0)
-- Dependencies: 453
-- Name: TABLE media_item_daily_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_item_daily_users TO service_role;


--
-- TOC entry 6166 (class 0 OID 0)
-- Dependencies: 454
-- Name: TABLE media_item_trending_72h; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_item_trending_72h TO anon;
GRANT ALL ON TABLE public.media_item_trending_72h TO authenticated;
GRANT ALL ON TABLE public.media_item_trending_72h TO service_role;


--
-- TOC entry 6169 (class 0 OID 0)
-- Dependencies: 455
-- Name: TABLE media_job_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_job_state TO service_role;


--
-- TOC entry 6170 (class 0 OID 0)
-- Dependencies: 471
-- Name: TABLE media_rank_feature_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_rank_feature_log TO anon;
GRANT ALL ON TABLE public.media_rank_feature_log TO authenticated;
GRANT ALL ON TABLE public.media_rank_feature_log TO service_role;


--
-- TOC entry 6171 (class 0 OID 0)
-- Dependencies: 470
-- Name: TABLE media_rank_models; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_rank_models TO anon;
GRANT ALL ON TABLE public.media_rank_models TO authenticated;
GRANT ALL ON TABLE public.media_rank_models TO service_role;


--
-- TOC entry 6172 (class 0 OID 0)
-- Dependencies: 467
-- Name: TABLE media_rerank_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_rerank_cache TO service_role;


--
-- TOC entry 6173 (class 0 OID 0)
-- Dependencies: 472
-- Name: TABLE media_served; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_served TO anon;
GRANT ALL ON TABLE public.media_served TO authenticated;
GRANT ALL ON TABLE public.media_served TO service_role;


--
-- TOC entry 6174 (class 0 OID 0)
-- Dependencies: 449
-- Name: TABLE media_session_vectors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_session_vectors TO anon;
GRANT ALL ON TABLE public.media_session_vectors TO authenticated;
GRANT ALL ON TABLE public.media_session_vectors TO service_role;


--
-- TOC entry 6175 (class 0 OID 0)
-- Dependencies: 461
-- Name: TABLE media_session_vectors_active; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_session_vectors_active TO service_role;


--
-- TOC entry 6176 (class 0 OID 0)
-- Dependencies: 450
-- Name: TABLE media_trending_scores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_trending_scores TO service_role;


--
-- TOC entry 6177 (class 0 OID 0)
-- Dependencies: 469
-- Name: TABLE media_user_centroids; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_user_centroids TO anon;
GRANT ALL ON TABLE public.media_user_centroids TO authenticated;
GRANT ALL ON TABLE public.media_user_centroids TO service_role;


--
-- TOC entry 6178 (class 0 OID 0)
-- Dependencies: 448
-- Name: TABLE media_user_vectors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_user_vectors TO anon;
GRANT ALL ON TABLE public.media_user_vectors TO authenticated;
GRANT ALL ON TABLE public.media_user_vectors TO service_role;


--
-- TOC entry 6179 (class 0 OID 0)
-- Dependencies: 460
-- Name: TABLE media_user_vectors_active; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_user_vectors_active TO service_role;


--
-- TOC entry 6180 (class 0 OID 0)
-- Dependencies: 416
-- Name: TABLE message_delivery_receipts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_delivery_receipts TO anon;
GRANT ALL ON TABLE public.message_delivery_receipts TO authenticated;
GRANT ALL ON TABLE public.message_delivery_receipts TO service_role;


--
-- TOC entry 6181 (class 0 OID 0)
-- Dependencies: 415
-- Name: TABLE message_reactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_reactions TO anon;
GRANT ALL ON TABLE public.message_reactions TO authenticated;
GRANT ALL ON TABLE public.message_reactions TO service_role;


--
-- TOC entry 6182 (class 0 OID 0)
-- Dependencies: 417
-- Name: TABLE message_read_receipts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_read_receipts TO anon;
GRANT ALL ON TABLE public.message_read_receipts TO authenticated;
GRANT ALL ON TABLE public.message_read_receipts TO service_role;


--
-- TOC entry 6183 (class 0 OID 0)
-- Dependencies: 414
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- TOC entry 6184 (class 0 OID 0)
-- Dependencies: 428
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- TOC entry 6185 (class 0 OID 0)
-- Dependencies: 411
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- TOC entry 6186 (class 0 OID 0)
-- Dependencies: 443
-- Name: TABLE omdb_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.omdb_cache TO anon;
GRANT ALL ON TABLE public.omdb_cache TO authenticated;
GRANT ALL ON TABLE public.omdb_cache TO service_role;


--
-- TOC entry 6187 (class 0 OID 0)
-- Dependencies: 422
-- Name: TABLE people; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.people TO anon;
GRANT ALL ON TABLE public.people TO authenticated;
GRANT ALL ON TABLE public.people TO service_role;


--
-- TOC entry 6189 (class 0 OID 0)
-- Dependencies: 421
-- Name: SEQUENCE people_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.people_id_seq TO anon;
GRANT ALL ON SEQUENCE public.people_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.people_id_seq TO service_role;


--
-- TOC entry 6190 (class 0 OID 0)
-- Dependencies: 400
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- TOC entry 6191 (class 0 OID 0)
-- Dependencies: 477
-- Name: TABLE profiles_public; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles_public TO anon;
GRANT ALL ON TABLE public.profiles_public TO authenticated;
GRANT ALL ON TABLE public.profiles_public TO service_role;


--
-- TOC entry 6192 (class 0 OID 0)
-- Dependencies: 401
-- Name: TABLE ratings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ratings TO anon;
GRANT ALL ON TABLE public.ratings TO authenticated;
GRANT ALL ON TABLE public.ratings TO service_role;


--
-- TOC entry 6194 (class 0 OID 0)
-- Dependencies: 479
-- Name: TABLE recommendation_impressions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recommendation_impressions TO anon;
GRANT ALL ON TABLE public.recommendation_impressions TO authenticated;
GRANT ALL ON TABLE public.recommendation_impressions TO service_role;


--
-- TOC entry 6196 (class 0 OID 0)
-- Dependencies: 480
-- Name: TABLE recommendation_interactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recommendation_interactions TO anon;
GRANT ALL ON TABLE public.recommendation_interactions TO authenticated;
GRANT ALL ON TABLE public.recommendation_interactions TO service_role;


--
-- TOC entry 6198 (class 0 OID 0)
-- Dependencies: 481
-- Name: TABLE recommendation_performance; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recommendation_performance TO anon;
GRANT ALL ON TABLE public.recommendation_performance TO authenticated;
GRANT ALL ON TABLE public.recommendation_performance TO service_role;


--
-- TOC entry 6199 (class 0 OID 0)
-- Dependencies: 427
-- Name: TABLE reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reports TO anon;
GRANT ALL ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;


--
-- TOC entry 6200 (class 0 OID 0)
-- Dependencies: 408
-- Name: TABLE review_reactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.review_reactions TO anon;
GRANT ALL ON TABLE public.review_reactions TO authenticated;
GRANT ALL ON TABLE public.review_reactions TO service_role;


--
-- TOC entry 6201 (class 0 OID 0)
-- Dependencies: 403
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reviews TO anon;
GRANT ALL ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;


--
-- TOC entry 6202 (class 0 OID 0)
-- Dependencies: 442
-- Name: TABLE tmdb_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tmdb_cache TO anon;
GRANT ALL ON TABLE public.tmdb_cache TO authenticated;
GRANT ALL ON TABLE public.tmdb_cache TO service_role;


--
-- TOC entry 6203 (class 0 OID 0)
-- Dependencies: 426
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_settings TO anon;
GRANT ALL ON TABLE public.user_settings TO authenticated;
GRANT ALL ON TABLE public.user_settings TO service_role;


--
-- TOC entry 6204 (class 0 OID 0)
-- Dependencies: 418
-- Name: TABLE user_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_stats TO anon;
GRANT ALL ON TABLE public.user_stats TO authenticated;
GRANT ALL ON TABLE public.user_stats TO service_role;


--
-- TOC entry 6205 (class 0 OID 0)
-- Dependencies: 451
-- Name: TABLE user_swipe_prefs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_swipe_prefs TO anon;
GRANT ALL ON TABLE public.user_swipe_prefs TO authenticated;
GRANT ALL ON TABLE public.user_swipe_prefs TO service_role;


--
-- TOC entry 6206 (class 0 OID 0)
-- Dependencies: 423
-- Name: TABLE user_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_tags TO anon;
GRANT ALL ON TABLE public.user_tags TO authenticated;
GRANT ALL ON TABLE public.user_tags TO service_role;


--
-- TOC entry 6207 (class 0 OID 0)
-- Dependencies: 424
-- Name: TABLE user_title_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_title_tags TO anon;
GRANT ALL ON TABLE public.user_title_tags TO authenticated;
GRANT ALL ON TABLE public.user_title_tags TO service_role;


--
-- TOC entry 6208 (class 0 OID 0)
-- Dependencies: 397
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- TOC entry 6209 (class 0 OID 0)
-- Dependencies: 456
-- Name: TABLE messages_2025_12_20; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_20 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_20 TO dashboard_user;


--
-- TOC entry 6210 (class 0 OID 0)
-- Dependencies: 466
-- Name: TABLE messages_2025_12_21; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_21 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_21 TO dashboard_user;


--
-- TOC entry 6211 (class 0 OID 0)
-- Dependencies: 468
-- Name: TABLE messages_2025_12_22; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_22 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_22 TO dashboard_user;


--
-- TOC entry 6212 (class 0 OID 0)
-- Dependencies: 475
-- Name: TABLE messages_2025_12_23; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_23 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_23 TO dashboard_user;


--
-- TOC entry 6213 (class 0 OID 0)
-- Dependencies: 476
-- Name: TABLE messages_2025_12_24; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_24 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_24 TO dashboard_user;


--
-- TOC entry 6214 (class 0 OID 0)
-- Dependencies: 478
-- Name: TABLE messages_2025_12_25; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_25 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_25 TO dashboard_user;


--
-- TOC entry 6215 (class 0 OID 0)
-- Dependencies: 482
-- Name: TABLE messages_2025_12_26; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2025_12_26 TO postgres;
GRANT ALL ON TABLE realtime.messages_2025_12_26 TO dashboard_user;


--
-- TOC entry 6216 (class 0 OID 0)
-- Dependencies: 385
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- TOC entry 6217 (class 0 OID 0)
-- Dependencies: 388
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- TOC entry 6218 (class 0 OID 0)
-- Dependencies: 387
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- TOC entry 6220 (class 0 OID 0)
-- Dependencies: 365
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO anon;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO authenticated;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO service_role;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO postgres;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin;
RESET SESSION AUTHORIZATION;


--
-- TOC entry 6221 (class 0 OID 0)
-- Dependencies: 393
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- TOC entry 6222 (class 0 OID 0)
-- Dependencies: 394
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- TOC entry 6224 (class 0 OID 0)
-- Dependencies: 366
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO anon;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO authenticated;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO service_role;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO postgres;
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION postgres;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin;
RESET SESSION AUTHORIZATION;


--
-- TOC entry 6225 (class 0 OID 0)
-- Dependencies: 392
-- Name: TABLE prefixes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.prefixes TO service_role;
GRANT ALL ON TABLE storage.prefixes TO authenticated;
GRANT ALL ON TABLE storage.prefixes TO anon;


--
-- TOC entry 6226 (class 0 OID 0)
-- Dependencies: 390
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- TOC entry 6227 (class 0 OID 0)
-- Dependencies: 391
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- TOC entry 6228 (class 0 OID 0)
-- Dependencies: 395
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- TOC entry 6229 (class 0 OID 0)
-- Dependencies: 368
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- TOC entry 6230 (class 0 OID 0)
-- Dependencies: 369
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- TOC entry 3227 (class 826 OID 16603)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- TOC entry 3228 (class 826 OID 16604)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- TOC entry 3226 (class 826 OID 16602)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- TOC entry 3241 (class 826 OID 56916)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: cron; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- TOC entry 3243 (class 826 OID 56915)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: cron; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- TOC entry 3242 (class 826 OID 56914)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: cron; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA cron GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- TOC entry 3237 (class 826 OID 16682)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- TOC entry 3236 (class 826 OID 16681)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- TOC entry 3235 (class 826 OID 16680)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- TOC entry 3240 (class 826 OID 16637)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 3239 (class 826 OID 16636)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 3238 (class 826 OID 16635)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 3232 (class 826 OID 16617)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 3234 (class 826 OID 16616)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 3233 (class 826 OID 16615)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 3219 (class 826 OID 16490)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 3220 (class 826 OID 16491)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 3218 (class 826 OID 16489)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 3222 (class 826 OID 16493)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 3217 (class 826 OID 16488)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 3221 (class 826 OID 16492)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 3230 (class 826 OID 16607)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- TOC entry 3231 (class 826 OID 16608)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- TOC entry 3229 (class 826 OID 16606)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- TOC entry 3225 (class 826 OID 16545)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 3224 (class 826 OID 16544)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 3223 (class 826 OID 16543)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 4434 (class 3466 OID 16621)
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- TOC entry 4439 (class 3466 OID 16700)
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- TOC entry 4433 (class 3466 OID 16619)
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- TOC entry 4440 (class 3466 OID 16703)
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- TOC entry 4435 (class 3466 OID 16622)
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- TOC entry 4436 (class 3466 OID 16623)
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

-- Completed on 2025-12-24 00:51:22

--
-- PostgreSQL database dump complete
--

\unrestrict XHGxenW7JnTsbBXrlZrfhTmHYWZPDyNbaHg3prcw331JMNHIFUVqts5wDg9UPaA

