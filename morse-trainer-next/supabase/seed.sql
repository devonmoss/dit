SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', '53412585-7016-4c6a-a84b-90c340b15749', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"test@user.com","user_id":"8202244a-2521-4c98-850d-8ae966e6eae4","user_phone":""}}', '2025-04-25 20:46:17.355698+00', ''),
	('00000000-0000-0000-0000-000000000000', '9d11962e-98bd-495c-9f3c-c8aabdb22202', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"user_email":"test2@user.com","user_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","user_phone":""}}', '2025-04-25 20:46:32.193172+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f191764d-de93-4766-888b-db97583f5172', '{"action":"login","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-04-25 20:48:55.867049+00', ''),
	('00000000-0000-0000-0000-000000000000', '088e9ac2-3edb-4ae7-a8fa-4dc65370a3a8', '{"action":"user_repeated_signup","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}', '2025-04-25 21:18:43.909917+00', ''),
	('00000000-0000-0000-0000-000000000000', '97f15107-50a0-4295-92e2-c11b01802975', '{"action":"login","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-04-25 21:18:45.293584+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b8ab02d5-36cb-419e-b466-0cb37914fb69', '{"action":"token_refreshed","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 21:46:55.712663+00', ''),
	('00000000-0000-0000-0000-000000000000', '33c8f671-964b-4bb5-ba06-4ccf283a421d', '{"action":"token_revoked","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 21:46:55.713946+00', ''),
	('00000000-0000-0000-0000-000000000000', '30f29006-8058-4a5b-b011-ce0f63274744', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 22:17:04.732212+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a94172af-53aa-46f2-aceb-9b10b13fffa6', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 22:17:04.733339+00', ''),
	('00000000-0000-0000-0000-000000000000', 'efdc2650-23a9-48f6-b4fe-51a840d67a05', '{"action":"token_refreshed","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 22:45:14.785039+00', ''),
	('00000000-0000-0000-0000-000000000000', 'adf6569a-360f-4ea2-b8f4-0980c743f0f4', '{"action":"token_revoked","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 22:45:14.785714+00', ''),
	('00000000-0000-0000-0000-000000000000', '7cf71b56-7b78-4414-a84d-471a03306643', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 23:15:43.163939+00', ''),
	('00000000-0000-0000-0000-000000000000', '30f7188c-f4ac-4117-920c-c4ea227f6ba5', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-25 23:15:43.165358+00', ''),
	('00000000-0000-0000-0000-000000000000', '89bd134b-9474-4e2e-9378-c0fe638a659f', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 00:14:13.943765+00', ''),
	('00000000-0000-0000-0000-000000000000', '6c5f141a-aab9-4185-8825-0bbed0855131', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 00:14:13.945232+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c0c4af09-bdfa-43a3-a843-10087b0df7d5', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 01:12:47.948819+00', ''),
	('00000000-0000-0000-0000-000000000000', '8b8573b5-0d02-4905-9dbe-897c5ca8679a', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 01:12:47.951552+00', ''),
	('00000000-0000-0000-0000-000000000000', '40c7608d-ead1-4cd4-b9a2-255d7005ac9a', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 02:11:19.819937+00', ''),
	('00000000-0000-0000-0000-000000000000', '10e1c8a3-ccd0-4e32-8dcb-c91a82f45f5f', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 02:11:19.820912+00', ''),
	('00000000-0000-0000-0000-000000000000', '8b154502-8026-448c-88f0-cec8cf4e479e', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 03:09:52.197055+00', ''),
	('00000000-0000-0000-0000-000000000000', '81a3b393-d75b-4d4f-b2a7-3f0f0cebcb79', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 03:09:52.198998+00', ''),
	('00000000-0000-0000-0000-000000000000', '4c58403e-a06a-4023-9ed3-a9d478054eb3', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 04:08:24.774621+00', ''),
	('00000000-0000-0000-0000-000000000000', '9db5c2a5-5021-46c0-883a-4202e4c22ae8', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 04:08:24.776055+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f96e3036-128d-41db-a65d-d3ff7613e277', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 05:07:00.261017+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b7201592-1e19-47dc-9ac0-d82e78c6d44a', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 05:07:00.26182+00', ''),
	('00000000-0000-0000-0000-000000000000', '21fe8663-29d2-4c69-a3ef-97189c2fc2fe', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 06:05:34.476588+00', ''),
	('00000000-0000-0000-0000-000000000000', '588492be-fa1b-495a-a1f3-0d7eea013aa9', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 06:05:34.478058+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f486acff-0f14-482e-8bf2-a3510085a84f', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 07:04:06.932149+00', ''),
	('00000000-0000-0000-0000-000000000000', '767aeb65-31a8-4681-94a1-71ac21ffe5cc', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 07:04:06.933648+00', ''),
	('00000000-0000-0000-0000-000000000000', '2cf1c662-d101-4d43-b19a-df467939e531', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 08:02:39.416657+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd40e7267-073a-4c2e-9654-94de2d4c34e6', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 08:02:39.418162+00', ''),
	('00000000-0000-0000-0000-000000000000', '7ca00256-74a0-44f8-83d9-9516c68e0e9a', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 09:01:11.321095+00', ''),
	('00000000-0000-0000-0000-000000000000', '15658968-92bd-4423-941b-ec76b0884e1e', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 09:01:11.321957+00', ''),
	('00000000-0000-0000-0000-000000000000', '1ccde68b-ec5a-4576-aa24-0e882dcf181b', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 09:59:43.135249+00', ''),
	('00000000-0000-0000-0000-000000000000', '6fbcab29-c90e-473f-9d56-39a0fc2f3547', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 09:59:43.136602+00', ''),
	('00000000-0000-0000-0000-000000000000', '37389708-e9ba-4295-ab14-e601c22c8888', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 10:58:13.926271+00', ''),
	('00000000-0000-0000-0000-000000000000', '20d48360-101b-433a-918b-828b7ffe8bbf', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 10:58:13.927918+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a0dc812f-01bd-4800-8edc-6854c4472a6c', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 11:56:45.983073+00', ''),
	('00000000-0000-0000-0000-000000000000', '40aa70c3-2a31-4ec0-9b71-033aa0734045', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 11:56:45.984634+00', ''),
	('00000000-0000-0000-0000-000000000000', '869e67ce-3ae2-4ff5-8c7c-0f3da038b6dc', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 12:55:04.992349+00', ''),
	('00000000-0000-0000-0000-000000000000', '130ea513-478d-4b28-a4e2-04832f8db1ce', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 12:55:04.993649+00', ''),
	('00000000-0000-0000-0000-000000000000', '6c450f22-fe5c-471d-9e58-3d23cdaae6cf', '{"action":"token_refreshed","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 13:01:21.553633+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e891044b-4efc-4df3-ba33-bd3a9e1180b2', '{"action":"token_revoked","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 13:01:21.554554+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a5624c0f-85b6-4d5d-9b04-2fea7d0c4a22', '{"action":"token_refreshed","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 13:53:20.494206+00', ''),
	('00000000-0000-0000-0000-000000000000', '10d42f38-c64a-41a6-841d-e2c5f60ee230', '{"action":"token_revoked","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"token"}', '2025-04-26 13:53:20.495659+00', ''),
	('00000000-0000-0000-0000-000000000000', '0c887399-072d-45fc-ae1e-cfd289398e10', '{"action":"login","actor_id":"8202244a-2521-4c98-850d-8ae966e6eae4","actor_username":"test@user.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-04-26 14:07:01.89582+00', ''),
	('00000000-0000-0000-0000-000000000000', '0b20c785-96a6-4bf0-ac87-a258ff30dcc9', '{"action":"logout","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"account"}', '2025-04-26 14:20:21.219297+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f6d88b93-ac4b-4317-a2df-4b2275c7d78e', '{"action":"login","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-04-26 14:24:01.81777+00', ''),
	('00000000-0000-0000-0000-000000000000', '73852938-4597-44cf-ba05-13f355b6b1ec', '{"action":"logout","actor_id":"b27090bb-bc7c-4eff-ac63-d50b058daf2f","actor_username":"test2@user.com","actor_via_sso":false,"log_type":"account"}', '2025-04-26 14:24:21.637399+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '8202244a-2521-4c98-850d-8ae966e6eae4', 'authenticated', 'authenticated', 'test@user.com', '$2a$10$wFrzMD2YI.l4iSYXpysAVeGo5Sh8QS2qxgfAUfSe1vIAFztVTLlxe', '2025-04-25 20:46:17.356921+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-04-26 14:07:01.89632+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2025-04-25 20:46:17.351624+00', '2025-04-26 14:07:01.897696+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'authenticated', 'authenticated', 'test2@user.com', '$2a$10$PqMTNgUzMUIFCnQ2VEH1QuTVo3fbnhgLrnfpz74KvU9TgfACzy24m', '2025-04-25 20:46:32.196735+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-04-26 14:24:01.818256+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2025-04-25 20:46:32.191879+00', '2025-04-26 14:24:01.819782+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('8202244a-2521-4c98-850d-8ae966e6eae4', '8202244a-2521-4c98-850d-8ae966e6eae4', '{"sub": "8202244a-2521-4c98-850d-8ae966e6eae4", "email": "test@user.com", "email_verified": false, "phone_verified": false}', 'email', '2025-04-25 20:46:17.354656+00', '2025-04-25 20:46:17.354692+00', '2025-04-25 20:46:17.354692+00', '387b2dd5-f1a4-4931-bd6a-7010244ac6db'),
	('b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', '{"sub": "b27090bb-bc7c-4eff-ac63-d50b058daf2f", "email": "test2@user.com", "email_verified": false, "phone_verified": false}', 'email', '2025-04-25 20:46:32.192615+00', '2025-04-25 20:46:32.192649+00', '2025-04-25 20:46:32.192649+00', '44b54a0e-bdb2-4270-b2e0-b49711257798');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag") VALUES
	('e7aae978-0b6d-4b86-a875-c0760aef0905', '8202244a-2521-4c98-850d-8ae966e6eae4', '2025-04-25 20:48:55.868713+00', '2025-04-26 13:01:21.557633+00', NULL, 'aal1', NULL, '2025-04-26 13:01:21.557591', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0', '192.168.65.1', NULL),
	('83d1c8c3-d49a-4859-861b-09417599a984', '8202244a-2521-4c98-850d-8ae966e6eae4', '2025-04-26 14:07:01.896407+00', '2025-04-26 14:07:01.896407+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0', '192.168.65.1', NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('e7aae978-0b6d-4b86-a875-c0760aef0905', '2025-04-25 20:48:55.872208+00', '2025-04-25 20:48:55.872208+00', 'password', 'e2b4bee6-fa30-4e6f-8d5f-71f4099ce574'),
	('83d1c8c3-d49a-4859-861b-09417599a984', '2025-04-26 14:07:01.897874+00', '2025-04-26 14:07:01.897874+00', 'password', 'd619b626-a5b9-4725-9b06-4f91df5d2dd8');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 1, '6clagxwahjxt', '8202244a-2521-4c98-850d-8ae966e6eae4', true, '2025-04-25 20:48:55.870395+00', '2025-04-25 21:46:55.714476+00', NULL, 'e7aae978-0b6d-4b86-a875-c0760aef0905'),
	('00000000-0000-0000-0000-000000000000', 3, '6ksea6rwpqnd', '8202244a-2521-4c98-850d-8ae966e6eae4', true, '2025-04-25 21:46:55.715983+00', '2025-04-25 22:45:14.785967+00', '6clagxwahjxt', 'e7aae978-0b6d-4b86-a875-c0760aef0905'),
	('00000000-0000-0000-0000-000000000000', 5, '2o2e7j3qbdlv', '8202244a-2521-4c98-850d-8ae966e6eae4', true, '2025-04-25 22:45:14.78655+00', '2025-04-26 13:01:21.554866+00', '6ksea6rwpqnd', 'e7aae978-0b6d-4b86-a875-c0760aef0905'),
	('00000000-0000-0000-0000-000000000000', 21, 'frpv52c4h465', '8202244a-2521-4c98-850d-8ae966e6eae4', false, '2025-04-26 13:01:21.555474+00', '2025-04-26 13:01:21.555474+00', '2o2e7j3qbdlv', 'e7aae978-0b6d-4b86-a875-c0760aef0905'),
	('00000000-0000-0000-0000-000000000000', 23, 'xyovop3mjcsy', '8202244a-2521-4c98-850d-8ae966e6eae4', false, '2025-04-26 14:07:01.897031+00', '2025-04-26 14:07:01.897031+00', NULL, '83d1c8c3-d49a-4859-861b-09417599a984');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: races; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."races" ("id", "created_by", "status", "mode", "char_sequence", "text", "level_id", "start_time", "created_at") VALUES
	('d55b3meq', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{n,1,3,v,1,s,f,j,f,i,k,m,x,b,r,b,y,t,f,r}', 'n13v1sfjfikmxbrbytfr', 'checkpoint-4', 1745617680824, '2025-04-25 21:47:47.884377+00'),
	('uu4zx66j', 'bbdc6606-7d43-44cf-8349-1fbcf7a69db7', 'finished', 'copy', '{e,t,t,e,e,t,t,t,e,t,e,e,t,t,t,t,e,t,t,t}', 'etteettteteettttettt', 'level-1', 1745614192322, '2025-04-25 20:48:24.093956+00'),
	('ka7ir7j4', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{m,a,u,c,o,n,c,e,b,i,r,s,c,g,a,i,u,t,u,m}', 'mauconcebirscgaiutum', 'checkpoint-4', 1745619252019, '2025-04-25 22:14:00.384191+00'),
	('dxtbnl2u', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{b,g,m,c,s,r,m,c,i,o,i,p,i,c,g,m,e,b,t,g}', 'bgmcsrmcioipicgmebtg', 'checkpoint-4', 1745618402682, '2025-04-25 21:59:47.204974+00'),
	('vwv9e0uc', '8202244a-2521-4c98-850d-8ae966e6eae4', 'finished', 'copy', '{e,e,e,e,t,t,t,t,t,t,e,e,e,e,t,t,t,e,e,t}', 'eeeetttttteeeettteet', 'level-1', 1745614233586, '2025-04-25 20:50:13.630224+00'),
	('iwdbgu52', '18721d0a-6e00-451e-8b8c-063029901644', 'waiting', 'copy', '{t,e,e,e,t,t,t,e,e,e,e,e,e,e,e,e,t,e,t,e}', 'teeettteeeeeeeeetete', 'level-1', NULL, '2025-04-25 20:52:09.678344+00'),
	('0vy7aoju', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{a,k,1,p,k,g,k,a,w,2,z,g,h,n,x,s,9,o,l,f}', 'ak1pkgkaw2zghnxs9olf', 'checkpoint-4', NULL, '2025-04-25 20:59:49.83709+00'),
	('iohjx1n5', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{h,n,m,n,v,r,d,1,2,m,k,g,r,x,d,9,f,8,d,k}', 'hnmnvrd12mkgrxd9f8dk', 'checkpoint-4', NULL, '2025-04-25 21:01:58.468563+00'),
	('2e21fdjf', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{k,n,5,v,j,s,f,i,s,t,t,6,q,c,0,6,e,i,9,r}', 'kn5vjsfistt6qc06ei9r', 'checkpoint-4', NULL, '2025-04-25 21:02:29.683808+00'),
	('hejflr7o', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{l,a,a,0,h,3,c,l,g,e,r,1,o,9,6,2,j,d,9,g}', 'laa0h3clger1o962jd9g', 'checkpoint-4', NULL, '2025-04-25 21:16:14.655182+00'),
	('qd6mr2jw', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{e,i,8,c,h,b,8,i,9,j,x,o,z,6,s,c,6,0,2,w}', 'ei8chb8i9jxoz6sc602w', 'checkpoint-4', 1745617868616, '2025-04-25 21:50:54.100369+00'),
	('4hspaqoa', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{b,y,u,9,r,f,x,7,7,7,0,w,e,s,4,i,4,n,5,6}', 'byu9rfx7770wes4i4n56', 'checkpoint-4', 1745616137910, '2025-04-25 21:18:16.55021+00'),
	('8lbxvgcy', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{a,k,6,p,s,z,u,j,u,p,5,c,t,p,p,d,i,h,z,e}', 'ak6pszujup5ctppdihze', 'checkpoint-4', NULL, '2025-04-25 21:32:48.835778+00'),
	('gsmfj14e', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{7,a,u,t,s,s,k,g,8,r,b,8,t,k,i,o,2,e,5,y}', '7autsskg8rb8tkio2e5y', 'checkpoint-4', NULL, '2025-04-25 21:36:19.642064+00'),
	('ow615fyt', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{3,f,w,a,s,8,a,2,7,4,p,q,m,h,2,c,v,z,t,j}', '3fwas8a274pqmh2cvztj', 'checkpoint-4', NULL, '2025-04-25 21:36:30.159302+00'),
	('a8m58thi', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{1,f,0,k,t,g,m,p,f,c,6,4,h,9,9,l,6,q,6,2}', '1f0ktgmpfc64h99l6q62', 'checkpoint-4', 1745617326048, '2025-04-25 21:40:58.804511+00'),
	('dp0406wu', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{b,o,o,g,p,r,g,b,b,e,k,u,u,u,n,i,i,c,u,k}', 'boogprgbbekuuuniicuk', 'checkpoint-4', NULL, '2025-04-25 22:22:57.287158+00'),
	('90fbjhrt', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{n,a,n,n,a,e,a,t,n,n,e,a,a,e,a,e,n,a,a,e}', 'nannaeatnneaaeaenaae', 'level-2', NULL, '2025-04-25 22:24:04.669544+00'),
	('g0mxilc3', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{i,d,m,a,d,k,t,m,o,e,a,e,p,a,c,g,p,b,k,r}', 'idmadktmoeaepacgpbkr', 'checkpoint-4', 1745619011386, '2025-04-25 22:09:58.942543+00'),
	('448wms5l', '8202244a-2521-4c98-850d-8ae966e6eae4', 'finished', 'copy', '{j,d,s,d,2,3,f,x,b,4,u,4,b,m,1,1,c,h,1,z}', 'jdsd23fxb4u4bm11ch1z', 'checkpoint-4', 1745617952794, '2025-04-25 21:52:19.480167+00'),
	('sn0zlquk', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{e,e,r,k,e,o,k,m,g,k,e,p,p,o,m,s,a,e,g,k}', 'eerkeokmgkeppomsaegk', 'checkpoint-4', 1745620282932, '2025-04-25 22:31:05.10484+00'),
	('38ra0se3', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{t,e,t,t,e,e,e,t,t,e,e,e,e,e,t,t,t,t,e,t}', 'tetteeetteeeeettttet', 'level-1', 1745620473273, '2025-04-25 22:34:19.47095+00'),
	('k51f55q1', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{p,p,u,e,m,e,o,p,i,p,c,d,p,o,o,c,g,e,d,o}', 'ppuemeopipcdpoocgedo', 'checkpoint-4', 1745620710469, '2025-04-25 22:38:17.808915+00'),
	('qrp305se', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{t,t,t,t,t,e,e,e,e,e,e,e,e,e,e,e,t,t,t,t}', 'ttttteeeeeeeeeeetttt', 'level-1', 1745621257937, '2025-04-25 22:47:26.147329+00'),
	('gx08k9jl', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{d,i,n,i,m,p,g,u,d,a,c,m,t,c,e,e,c,r,i,m}', 'dinimpgudacmtceecrim', 'checkpoint-4', 1745621445573, '2025-04-25 22:48:25.54596+00'),
	('8rjfcm5h', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{e,t,e,t,t,e,e,e,e,t,t,e,t,e,t,e,t,t,t,e}', 'etetteeeettetetettte', 'level-1', 1745621672078, '2025-04-25 22:54:21.575961+00'),
	('esf6ggkc', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'send', '{t,t,e,t,e,e,e,t,t,t,e,e,t,t,t,t,e,e,e,t}', 'tteteeettteetttteeet', 'level-1', NULL, '2025-04-25 23:02:08.674525+00'),
	('085ob31p', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{k,e,p,o,c,u,m,d,b,p,k,o,a,m,o,c,o,a,b,a}', 'kepocumdbpkoamocoaba', 'checkpoint-4', 1745622173898, '2025-04-25 23:02:33.637638+00'),
	('zi6zv3uc', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'racing', 'copy', '{n,t,a,e,e,t,t,n,e,a,e,e,a,e,e,t,a,e,t,t}', 'ntaeettneaeeaeetaett', 'level-2', 1745672641665, '2025-04-26 13:03:41.48736+00'),
	('lycbo8at', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{e,e,e,t,e,t,t,e,e,e,e,t,t,t,e,e,e,e,e,t}', 'eeetetteeeettteeeeet', 'level-1', 1745672775549, '2025-04-26 13:06:00.512369+00'),
	('3my1608a', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'waiting', 'copy', '{a,t,t,a,a,t,a,n,n,n,a,t,t,t,e,e,t,e,n,a}', 'attaatannnattteetena', 'level-2', NULL, '2025-04-26 14:00:56.026346+00'),
	('bb5pbm7y', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'waiting', 'copy', '{t,a,a,a,n,a,t,a,n,e,t,n,t,n,n,t,e,e,e,t}', 'taaanatanetntnnteeet', 'level-2', NULL, '2025-04-26 14:02:52.697196+00'),
	('zlha5hwb', '8202244a-2521-4c98-850d-8ae966e6eae4', 'racing', 'copy', '{e,e,e,e,e,e,e,t,e,t,t,t,e,t,e,t,t,t,t,t}', 'eeeeeeetetttetettttt', 'level-1', 1745677243862, '2025-04-26 14:07:04.400932+00'),
	('itrxh81d', '8202244a-2521-4c98-850d-8ae966e6eae4', 'waiting', 'copy', '{t,t,t,t,t,t,t,e,e,e,t,e,t,e,t,e,e,e,e,e}', 'ttttttteeeteteteeeee', 'level-1', NULL, '2025-04-26 14:20:59.013809+00');


--
-- Data for Name: answers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: race_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."race_participants" ("id", "race_id", "user_id", "name", "progress", "finished", "finish_time", "created_at") VALUES
	('989ce3f7-9122-4ea9-a416-d932c3d79f59', 'dxtbnl2u', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 20, true, 1745618441812, '2025-04-25 21:59:47.226144+00'),
	('09a7e91f-ddae-4754-8a4d-5a0e779e3f81', 'vwv9e0uc', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, true, 1745614243422, '2025-04-25 20:50:13.6593+00'),
	('1264b8ba-5172-406e-a02e-18bc08c64beb', '0vy7aoju', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 20:59:49.852509+00'),
	('9a39fae2-b140-46d7-855d-ee8602c7bb1b', 'iohjx1n5', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:01:58.497058+00'),
	('0563751f-8a99-4410-a782-5dddccb2966c', '2e21fdjf', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:02:29.701967+00'),
	('7fd85d55-d2fd-4b8a-86cb-feaefaaea140', 'hejflr7o', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:16:14.670845+00'),
	('19a23d5a-e509-4b26-91f5-bae21e6b183f', '4hspaqoa', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 21:20:56.818683+00'),
	('b1d3c04e-5512-4823-98c1-743b5d45fc02', 'g0mxilc3', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 22:10:03.850188+00'),
	('3fd4c961-6d60-48e6-b6d6-6b396a554a28', 'zi6zv3uc', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-26 13:03:41.503192+00'),
	('25b7c330-ea95-4418-9e10-7cc3503c76b2', 'sn0zlquk', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 6, false, NULL, '2025-04-25 22:31:05.147683+00'),
	('b1c39bac-58d9-44d5-b180-4441082a898a', 'g0mxilc3', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 22:09:58.979508+00'),
	('82907a62-662f-41c0-a6b3-3473e4d06788', 'a8m58thi', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:40:58.824346+00'),
	('36fe5711-eebc-4587-9644-901e664ba1a4', 'd55b3meq', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:47:47.909234+00'),
	('5a09a42b-7331-43ee-a21f-258dafdfe4bf', 'd55b3meq', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 21:47:53.138132+00'),
	('6a7e3317-5850-4c20-8a79-534048d578a6', 'qd6mr2jw', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:50:54.140133+00'),
	('76ebd5e9-f9b5-497c-957f-62a243d46d88', 'qd6mr2jw', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 21:51:00.843226+00'),
	('a4aa4ed3-80fe-498b-abb9-6055737936eb', '8rjfcm5h', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 20, true, 1745621703048, '2025-04-25 22:54:21.602503+00'),
	('6e2992a4-9efe-421c-b9bd-bbb4ff4e731b', 'esf6ggkc', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 23:02:08.71264+00'),
	('54580a37-e276-4174-b2e2-1cef892c9eb6', '085ob31p', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 23:02:42.105053+00'),
	('e57768d5-a2b4-410a-b0b5-30120d16a48a', 'ka7ir7j4', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 3, false, NULL, '2025-04-25 22:14:00.426133+00'),
	('bf77c66b-0ded-48c4-abf2-6c6283e921dd', 'dp0406wu', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 22:22:57.339549+00'),
	('1cdfd3db-7f61-4a62-bf10-45cc017e013a', '90fbjhrt', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 22:24:04.701111+00'),
	('cda02603-edd6-4d29-ae1b-44587dfaf128', '448wms5l', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 20, true, 1745618068741, '2025-04-25 21:52:25.219205+00'),
	('5ec621ea-38c5-4591-91eb-b6160b441723', '4hspaqoa', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 10, false, NULL, '2025-04-25 21:18:16.574544+00'),
	('0689c89c-05a9-4bd8-a293-3acee6b90a4a', '8lbxvgcy', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:32:48.852112+00'),
	('bcf47386-500b-4fd9-9f3b-8032a927c825', '8lbxvgcy', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 21:33:04.622541+00'),
	('e684bf59-5eec-456b-ac43-08c3f4794c06', 'gsmfj14e', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:36:19.674546+00'),
	('2b3c9511-3fc5-422a-816d-dfbaa0fb4076', 'ow615fyt', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-25 21:36:30.185673+00'),
	('56c3cd28-af7b-4c6a-8d59-fcda39088c50', 'a8m58thi', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 21:41:35.822095+00'),
	('a6b35c48-e668-4cb1-b981-e767c818f954', 'lycbo8at', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 20, true, 1745672805404, '2025-04-26 13:06:06.720596+00'),
	('67a6e198-9cc5-483b-826b-e367ae97b3ca', '3my1608a', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-26 14:00:56.037705+00'),
	('f74b4352-ad42-4702-a93b-7d56f3835731', '448wms5l', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 20, true, 1745618076941, '2025-04-25 21:52:19.501856+00'),
	('a7d2119b-d235-4995-8ae4-8fb4772c54c1', 'dxtbnl2u', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 21:59:52.715122+00'),
	('eb2b86ec-57a8-4b57-89c2-6089f8c38127', 'bb5pbm7y', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-26 14:02:52.750676+00'),
	('a93fb742-0190-4dcd-a907-ff7678505ca8', 'zlha5hwb', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-26 14:07:13.255173+00'),
	('a1e83360-3285-4769-ab55-b3f688d4a50a', 'zlha5hwb', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 1, false, NULL, '2025-04-26 14:07:04.413999+00'),
	('dde28c46-77af-48cd-bbe4-624eb73d2e15', 'zi6zv3uc', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 1, false, NULL, '2025-04-26 13:03:50.062029+00'),
	('ccf0526c-591e-41e5-a022-1d67605091fa', 'qrp305se', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 15, false, NULL, '2025-04-25 22:47:26.187276+00'),
	('7ae56a36-6f9e-42fb-93bf-54c61a745f93', 'gx08k9jl', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 22:48:29.562776+00'),
	('42b35688-58ad-44c2-bc77-db7b4ba5643e', 'sn0zlquk', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 20, true, 1745620372287, '2025-04-25 22:31:14.95871+00'),
	('2da11a19-e2a9-4981-a3fa-cc0e30dbcdfb', '38ra0se3', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 22:34:24.082244+00'),
	('20edc57e-eb3b-42d8-adda-dd792d90a8cb', 'k51f55q1', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 3, false, NULL, '2025-04-25 22:38:17.850907+00'),
	('12852648-7a06-4a6d-a714-61436c06129c', 'qrp305se', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 22:47:30.727978+00'),
	('d7ab9eaf-3f80-4513-9b88-eb7493fa043a', 'lycbo8at', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-26 13:06:00.535591+00'),
	('2d6ba25c-2c4f-4066-8f8f-41619f0aae3c', 'gx08k9jl', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 2, false, NULL, '2025-04-25 22:48:25.559751+00'),
	('bc9b7570-73ac-4a8f-af72-6632ec115d33', 'ka7ir7j4', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 2, false, NULL, '2025-04-25 22:14:04.760408+00'),
	('9de6d43a-8c16-4d54-b608-43253b2748d7', '8rjfcm5h', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 22:54:25.349694+00'),
	('4a92c640-d7ef-4265-afea-e3ee0a4b0c05', 'itrxh81d', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 0, false, NULL, '2025-04-26 14:20:59.030296+00'),
	('bc9a1aa9-c8d0-4b3f-99c9-b9ce12f92fa1', '38ra0se3', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 18, false, NULL, '2025-04-25 22:34:19.49356+00'),
	('edd2a6fc-934a-4dfd-8851-1ab04e5f8c09', 'k51f55q1', 'b27090bb-bc7c-4eff-ac63-d50b058daf2f', 'test2@user.com', 0, false, NULL, '2025-04-25 22:38:23.123533+00'),
	('873ecd0a-b090-49f5-a03f-dc960d5896cc', '085ob31p', '8202244a-2521-4c98-850d-8ae966e6eae4', 'test@user.com', 20, true, 1745622254499, '2025-04-25 23:02:33.680145+00');


--
-- Data for Name: training_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."training_results" ("id", "user_id", "mode", "level_id", "time_sec", "tone_replays", "mistakes", "created_at", "times") VALUES
	('daee0823-e4a2-44c1-8247-0323e4603be5', '8202244a-2521-4c98-850d-8ae966e6eae4', 'copy', 'level-1', 7.6, 0, '{}', '2025-04-26 13:24:50.222574+00', '{"e": 0.3815, "t": 0.6146666666666667}'),
	('bf33936b-2a47-4d7c-8e12-7597a4584074', '8202244a-2521-4c98-850d-8ae966e6eae4', 'copy', 'level-1', 15.674, 0, '{"e": 2, "t": 1}', '2025-04-26 13:26:54.676855+00', '{"e": 1.5153333333333334, "t": 1.069}'),
	('b4986df6-48e2-4c62-b104-7db204f6387c', '8202244a-2521-4c98-850d-8ae966e6eae4', 'copy', 'level-2', 24.058, 1, '{}', '2025-04-26 13:29:41.160309+00', '{"a": 1.0633333333333332, "e": 1.4366666666666665, "n": 0.598, "t": 0.622}'),
	('007bdfa0-6067-4218-b20e-1790f9f4570b', '8202244a-2521-4c98-850d-8ae966e6eae4', 'copy', 'level-2', 24.058, 1, '{}', '2025-04-26 13:29:41.160857+00', '{"a": 1.0633333333333332, "e": 1.4366666666666665, "n": 0.598, "t": 0.622}');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 24, true);


--
-- Name: answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."answers_id_seq"', 1, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

RESET ALL;
