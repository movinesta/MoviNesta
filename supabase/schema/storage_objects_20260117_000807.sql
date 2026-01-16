--
-- PostgreSQL database dump
--

\restrict Aq3x6L2HdepNSMZVmlcDqmbhMxTqoE79DaZlpds4UVfSxLuea2dCu2Yk5NKLEuH

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

-- Started on 2026-01-17 00:12:45

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
-- TOC entry 4694 (class 0 OID 16561)
-- Dependencies: 364
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, level) FROM stdin;
178fc960-baea-4faa-a976-b1022c7a377d	avatars	1 (2).jpg	\N	2025-11-27 09:22:54.967838+00	2025-11-27 09:22:54.967838+00	2025-11-27 09:22:54.967838+00	{"eTag": "\\"ac6c7796031e495850202641306654a4-1\\"", "size": 99828, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-11-27T09:22:55.000Z", "contentLength": 99828, "httpStatusCode": 200}	2821eb7b-24e0-484c-9a9b-96637ed73200	\N	\N	1
42a31ce8-544b-4a01-9736-dad5a3bbb539	avatars	2.png	\N	2025-11-27 09:22:56.973092+00	2025-11-27 09:22:56.973092+00	2025-11-27 09:22:56.973092+00	{"eTag": "\\"eda850834b3776cad7d8ec96cbccdef4-1\\"", "size": 1416946, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-11-27T09:22:55.000Z", "contentLength": 1416946, "httpStatusCode": 200}	0e0cc346-6823-46e8-adf7-697b37fe96c6	\N	\N	1
89f0f18f-c66e-4791-8460-58c54fffd470	avatars	482004673_9016609281721753_5559657227178195284_n.jpg	\N	2025-11-28 02:18:20.903475+00	2025-11-28 02:18:20.903475+00	2025-11-28 02:18:20.903475+00	{"eTag": "\\"cda9fb4bba04357744d41088bc2a33b1-1\\"", "size": 233120, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-11-28T02:18:20.000Z", "contentLength": 233120, "httpStatusCode": 200}	11096824-fa98-48f1-9729-c1a8ef0b29f7	\N	\N	1
3c76a75f-02ba-4b40-8cc5-6cd375c70aaf	chat-media	message_attachments/37ece6a8-65b1-4c96-a917-276e40e6e44e/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1766964505895-f8e94444-592e-4006-8cd1-5f4adf2a554e.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2025-12-28 23:28:28.542906+00	2025-12-28 23:28:28.542906+00	2025-12-28 23:28:28.542906+00	{"eTag": "\\"33776cabcd9c5e6cde0d8895bbf4fbcd\\"", "size": 73663, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-12-28T23:28:29.000Z", "contentLength": 73663, "httpStatusCode": 200}	0faf6424-01bf-448f-a23c-333692733145	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
2829397b-43eb-4fe0-800e-a679a461180e	chat-media	message_attachments/23b3fe20-64dc-45ab-b136-44c636cf066c/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1767220266546-baee8fa9-cbf7-424b-a80d-bdc70229d45c.png	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2025-12-31 22:31:08.232017+00	2025-12-31 22:31:08.232017+00	2025-12-31 22:31:08.232017+00	{"eTag": "\\"779828e74c2b6d63c2add0cd07fd4656\\"", "size": 18587, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-12-31T22:31:09.000Z", "contentLength": 18587, "httpStatusCode": 200}	22ce1193-8f73-44e5-9c79-d9178ee6999b	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
3bc38d4f-0791-4755-97ad-11b9e525f04b	chat-media	message_attachments/ee5364d0-ea39-4803-8dad-74b6eea6e5e6/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1768142351442-c12838a3-e339-4ce1-b2bd-34fd7ec10ca2.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2026-01-11 14:39:19.817787+00	2026-01-11 14:39:19.817787+00	2026-01-11 14:39:19.817787+00	{"eTag": "\\"f5784039708dcc564e3d6a82b0cced1e-2\\"", "size": 5525845, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-11T14:39:20.000Z", "contentLength": 5525845, "httpStatusCode": 200}	d2d71b2a-b1c5-4f1c-acf5-1e3ed4d037e9	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
965c7a29-02cd-4f1a-a7e6-bf268d6c4f59	chat-media	message_attachments/ee5364d0-ea39-4803-8dad-74b6eea6e5e6/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1768142387471-6e47e9ba-5c9f-4cdc-a883-bfc04ebc9ee3.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2026-01-11 14:39:48.381536+00	2026-01-11 14:39:48.381536+00	2026-01-11 14:39:48.381536+00	{"eTag": "\\"07cbe604f2b4990f281773e1bbcdb48c\\"", "size": 91862, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-11T14:39:49.000Z", "contentLength": 91862, "httpStatusCode": 200}	d3eced81-94b4-4cb8-81a6-0ae90aa186c0	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
12ccaf57-8748-43d7-842e-4cb4d1a8a038	avatars	photo_2025-12-03_18-01-55.jpg	\N	2025-12-03 15:02:18.057458+00	2025-12-03 15:02:18.057458+00	2025-12-03 15:02:18.057458+00	{"eTag": "\\"33833f72bdbdb631f17f7bb022e7068a-1\\"", "size": 60746, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-12-03T15:02:18.000Z", "contentLength": 60746, "httpStatusCode": 200}	c3456f19-49e3-4e20-97f3-725a62259395	\N	\N	1
0d1603fc-b252-4dd3-85d6-e7584ab8a754	chat-media	message_attachments/74fad156-fd38-43ed-afc8-ace362891ad6/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1766982498985-0efaf12e-005f-46b7-8f74-0b7abffe3d71.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2025-12-29 04:28:21.38381+00	2025-12-29 04:28:21.38381+00	2025-12-29 04:28:21.38381+00	{"eTag": "\\"6eefc7d81b3496945d51e5acc64407c0\\"", "size": 109311, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-12-29T04:28:22.000Z", "contentLength": 109311, "httpStatusCode": 200}	813979a0-11f1-4c93-9941-517994209084	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
aed99790-fb68-407a-9f37-4d41d89a8f20	chat-media	message_attachments/23b3fe20-64dc-45ab-b136-44c636cf066c/31661b41-efc0-4f29-ba72-1a3e48cb1c80/1767228569848-da308367-1876-4d03-b456-ff90da94f542.png	31661b41-efc0-4f29-ba72-1a3e48cb1c80	2026-01-01 00:49:33.985549+00	2026-01-01 00:49:33.985549+00	2026-01-01 00:49:33.985549+00	{"eTag": "\\"1ffcdf4adb04491633438fe11ec0de46\\"", "size": 1440279, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-01T00:49:34.000Z", "contentLength": 1440279, "httpStatusCode": 200}	f503e40b-1d29-4e8c-b9d4-fd9daa15b919	31661b41-efc0-4f29-ba72-1a3e48cb1c80	{}	4
0c6ecd9d-c073-429d-977a-a9588bb07bf4	chat-media	message_attachments/3b40165c-359e-416a-8224-8cadcbfb9483/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1768222390851-165fa250-a444-4a37-94a7-45a81451e3ab.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2026-01-12 12:53:13.263695+00	2026-01-12 12:53:13.263695+00	2026-01-12 12:53:13.263695+00	{"eTag": "\\"ee68aa7336b60f6ccd75a623931079ba\\"", "size": 55352, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-12T12:53:14.000Z", "contentLength": 55352, "httpStatusCode": 200}	ce8caa0b-5a56-4f51-b1a1-f45b2232dd6c	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
b4d27a06-78df-4e32-9c6b-a1527332f1be	chat-media	message_attachments/.emptyFolderPlaceholder	\N	2025-12-27 21:52:37.625307+00	2025-12-27 21:52:37.625307+00	2025-12-27 21:52:37.625307+00	{"eTag": "\\"d41d8cd98f00b204e9800998ecf8427e\\"", "size": 0, "mimetype": "application/octet-stream", "cacheControl": "max-age=3600", "lastModified": "2025-12-27T21:52:37.627Z", "contentLength": 0, "httpStatusCode": 200}	ebf71609-a82b-48a3-8ce0-b768a4ab3970	\N	{}	2
96581ad5-3ae1-4226-80bb-df0fe589262a	chat-media	message_attachments/74fad156-fd38-43ed-afc8-ace362891ad6/d3645782-d7e9-48f9-9937-70a8d9c8352b/1767109846350-e7451af2-9c15-47ea-bdb1-a9da09f7659a.webp	d3645782-d7e9-48f9-9937-70a8d9c8352b	2025-12-30 15:50:49.694417+00	2025-12-30 15:50:49.694417+00	2025-12-30 15:50:49.694417+00	{"eTag": "\\"1b0b53ad83c944fe1c53b7022ac3bb60\\"", "size": 604414, "mimetype": "image/webp", "cacheControl": "max-age=3600", "lastModified": "2025-12-30T15:50:50.000Z", "contentLength": 604414, "httpStatusCode": 200}	523846e6-1731-407f-a90f-d067ab35dc5b	d3645782-d7e9-48f9-9937-70a8d9c8352b	{}	4
88304a43-c6b4-4643-beb9-ea6f2af843b4	chat-media	message_attachments/ecc47c2b-daec-44b5-9eb3-5a85ebf06469/d3645782-d7e9-48f9-9937-70a8d9c8352b/1767274414267-6249548c-3a58-4ee3-a506-ca3adee1ed1e.jpg	d3645782-d7e9-48f9-9937-70a8d9c8352b	2026-01-01 13:33:43.184879+00	2026-01-01 13:33:43.184879+00	2026-01-01 13:33:43.184879+00	{"eTag": "\\"6ce0fbbe1457ddfcbb6941d4d7cc7b33\\"", "size": 1300997, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-01T13:33:44.000Z", "contentLength": 1300997, "httpStatusCode": 200}	031b267d-423c-4acc-a307-54f7f29b5cef	d3645782-d7e9-48f9-9937-70a8d9c8352b	{}	4
66ad188d-bfdc-4d7a-94b2-4a3a4420dbfb	chat-media	message_attachments/ea87d762-d2bb-41ca-9096-45aeb005268a/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1768316511625-f262f80c-492b-4e87-986c-fcc5eebab46f.pdf	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2026-01-13 15:01:53.628399+00	2026-01-13 15:01:53.628399+00	2026-01-13 15:01:53.628399+00	{"eTag": "\\"0d8b9334b00b58880d0308b21a0e2ea0\\"", "size": 119045, "mimetype": "application/pdf", "cacheControl": "max-age=3600", "lastModified": "2026-01-13T15:01:54.000Z", "contentLength": 119045, "httpStatusCode": 200}	3488805c-6c25-4758-be82-6dfdd35bc743	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
2eae16f1-5cff-44a9-8e31-5fea15ed26a7	chat-media	message_attachments/74fad156-fd38-43ed-afc8-ace362891ad6/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1767128449761-acc939d9-f7c1-4ce7-b074-38456a65ddaa.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2025-12-30 21:00:53.539727+00	2025-12-30 21:00:53.539727+00	2025-12-30 21:00:53.539727+00	{"eTag": "\\"403c1d010baafc60239d1bd43221c5b7\\"", "size": 123566, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-12-30T21:00:54.000Z", "contentLength": 123566, "httpStatusCode": 200}	d76877c8-02fb-449b-9ce9-7ab0dbc2f07a	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
e5a70f51-be7d-440f-b7ed-a37743e75c54	chat-media	message_attachments/28d4240c-0990-469d-8f87-2e29efe3ccea/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1767278983346-0961352d-8763-4b1d-89cc-7de115518d50.png	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2026-01-01 14:49:47.062364+00	2026-01-01 14:49:47.062364+00	2026-01-01 14:49:47.062364+00	{"eTag": "\\"dfc12cd668c4a1045dadebddafd3b6d0\\"", "size": 74697, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-01T14:49:48.000Z", "contentLength": 74697, "httpStatusCode": 200}	5876dcef-a898-452a-aa97-2e8b3664e917	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
91082742-ec77-4671-8a9b-8d76505c7bc2	avatars	movinesta.png	\N	2025-12-31 19:37:47.041159+00	2025-12-31 19:37:47.041159+00	2025-12-31 19:37:47.041159+00	{"eTag": "\\"c9e3fa8cdcb49824e1613c36dd5c77aa-1\\"", "size": 1440279, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-12-31T19:37:46.000Z", "contentLength": 1440279, "httpStatusCode": 200}	6e3316e0-a9e7-4da6-9db2-c46dda9afee5	\N	\N	1
f613edff-b4f6-42f8-8ec1-ca60546e8aa6	chat-media	message_attachments/df1a768a-a1a2-42d4-965f-aeaa10fece07/9bf2ba8d-b360-45e0-9541-038b0eb564fd/1767601278665-d04bf41c-a38d-48c6-8c0f-984df96d331d.jpg	9bf2ba8d-b360-45e0-9541-038b0eb564fd	2026-01-05 08:21:20.895518+00	2026-01-05 08:21:20.895518+00	2026-01-05 08:21:20.895518+00	{"eTag": "\\"5ea3b66dc3620ff38b54ec47a9595f79\\"", "size": 106809, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-01-05T08:21:21.000Z", "contentLength": 106809, "httpStatusCode": 200}	e1ff2566-74e4-4fbb-bb30-0488e7ac7471	9bf2ba8d-b360-45e0-9541-038b0eb564fd	{}	4
\.


-- Completed on 2026-01-17 00:13:18

--
-- PostgreSQL database dump complete
--

\unrestrict Aq3x6L2HdepNSMZVmlcDqmbhMxTqoE79DaZlpds4UVfSxLuea2dCu2Yk5NKLEuH

