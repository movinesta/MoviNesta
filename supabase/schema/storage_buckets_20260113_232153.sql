--
-- PostgreSQL database dump
--

\restrict k8rMObrLLSgZA4LChYZcxosnpYZnbp5h9cYNgpTyF9JewWWGezyb1bGK3VK8iXa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

-- Started on 2026-01-13 23:26:00

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
-- TOC entry 4615 (class 0 OID 16546)
-- Dependencies: 363
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
chat-media	chat-media	\N	2025-11-27 09:14:02.334215+00	2025-11-27 09:14:02.334215+00	f	f	\N	\N	\N	STANDARD
avatars	avatars	\N	2025-11-27 09:15:07.103657+00	2025-11-27 09:15:07.103657+00	t	f	\N	\N	\N	STANDARD
\.


-- Completed on 2026-01-13 23:26:33

--
-- PostgreSQL database dump complete
--

\unrestrict k8rMObrLLSgZA4LChYZcxosnpYZnbp5h9cYNgpTyF9JewWWGezyb1bGK3VK8iXa

