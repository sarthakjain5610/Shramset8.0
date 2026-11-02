BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(43);

-- Synthetic identities only; this test never targets production user records.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','worker-a@test.invalid','',now(),'{}','{"signup_role":"worker","full_name":"Worker A"}',now(),now()),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','worker-b@test.invalid','',now(),'{}','{"signup_role":"worker","full_name":"Worker B"}',now(),now()),
 ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','contractor-a@test.invalid','',now(),'{}','{"signup_role":"contractor","full_name":"Contractor A"}',now(),now()),
 ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','contractor-b@test.invalid','',now(),'{}','{"signup_role":"contractor","full_name":"Contractor B"}',now(),now());
INSERT INTO public.workers (id,user_id,name,trade,skill_level,daily_base_wage_paise)
VALUES ('W-A','10000000-0000-4000-8000-000000000001','Worker A','Mason','skilled',55000),
       ('W-B','10000000-0000-4000-8000-000000000002','Worker B','Mason','skilled',55000);
INSERT INTO public.worker_private_data (worker_id, phone, eshram_uan, bocw_registration_no, aadhaar_last4, bank_account_last4, ifsc_code, upi_id, blood_group)
VALUES ('W-A','1111111111','UAN-PRIVATE-A','BOCW-PRIVATE-A','1111','2222','IFSC-PRIVATE-A','upi-private-a','B+'),
       ('W-B','2222222222','UAN-PRIVATE-B','BOCW-PRIVATE-B','3333','4444','IFSC-PRIVATE-B','upi-private-b','O+');
INSERT INTO public.contractor_worker_assignments(worker_id,contractor_id)
VALUES ('W-A','20000000-0000-4000-8000-000000000001');

-- SECURITY DEFINER function configuration, ownership and execute ACLs.
SELECT ok((SELECT p.proconfig @> ARRAY['search_path=pg_catalog']::text[] FROM pg_catalog.pg_proc p WHERE p.oid='public.provision_shram_profile()'::regprocedure),'provision trigger has pg_catalog-only search_path');
SELECT ok((SELECT p.proconfig @> ARRAY['search_path=pg_catalog']::text[] FROM pg_catalog.pg_proc p WHERE p.oid='public.get_worker_private_data(text)'::regprocedure),'worker private RPC has pg_catalog-only search_path');
SELECT ok((SELECT p.proconfig @> ARRAY['search_path=pg_catalog']::text[] FROM pg_catalog.pg_proc p WHERE p.oid='public.get_assigned_worker_contact(text)'::regprocedure),'contractor contact RPC has pg_catalog-only search_path');
SELECT ok((SELECT p.proconfig @> ARRAY['search_path=pg_catalog']::text[] FROM pg_catalog.pg_proc p WHERE p.oid='public.set_my_worker_contact_sharing(boolean)'::regprocedure),'contact consent RPC has pg_catalog-only search_path');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid='public.provision_shram_profile()'::regprocedure),'postgres','provision trigger is owned by postgres');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid='public.get_worker_private_data(text)'::regprocedure),'postgres','worker private RPC is owned by postgres');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid='public.get_assigned_worker_contact(text)'::regprocedure),'postgres','contractor contact RPC is owned by postgres');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid='public.set_my_worker_contact_sharing(boolean)'::regprocedure),'postgres','contact consent RPC is owned by postgres');
SELECT ok(NOT pg_catalog.has_function_privilege('authenticated','public.provision_shram_profile()','EXECUTE'),'authenticated cannot call trigger function directly');
SELECT ok(NOT pg_catalog.has_function_privilege('anon','public.provision_shram_profile()','EXECUTE'),'anon cannot execute trigger function');
SELECT ok(pg_catalog.has_function_privilege('authenticated','public.get_worker_private_data(text)','EXECUTE'),'authenticated can execute worker private RPC');
SELECT ok(NOT pg_catalog.has_function_privilege('anon','public.get_worker_private_data(text)','EXECUTE'),'anon cannot execute worker private RPC');
SELECT ok(pg_catalog.has_function_privilege('authenticated','public.get_assigned_worker_contact(text)','EXECUTE'),'authenticated can execute contact RPC');
SELECT ok(NOT pg_catalog.has_function_privilege('anon','public.get_assigned_worker_contact(text)','EXECUTE'),'anon cannot execute contact RPC');
SELECT ok(pg_catalog.has_function_privilege('authenticated','public.set_my_worker_contact_sharing(boolean)','EXECUTE'),'authenticated can execute own-consent RPC');
SELECT ok(NOT pg_catalog.has_function_privilege('anon','public.set_my_worker_contact_sharing(boolean)','EXECUTE'),'anon cannot execute own-consent RPC');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::int FROM public.workers),1,'Worker A only sees own worker row');
SELECT is((SELECT count(*)::int FROM public.profiles),1,'Worker A only sees own profile');
SELECT is((SELECT count(*)::int FROM public.contractor_worker_assignments),0,'Worker cannot enumerate assignments');
SELECT throws_ok($$UPDATE public.workers SET name='hacked' WHERE id='W-B'$$,'42501',NULL,'Worker cannot modify another worker profile');
SELECT is((SELECT eshram_uan::text || ':' || aadhaar_last4 || ':' || bank_account_last4 FROM public.get_worker_private_data('W-A')),'UAN-PRIVATE-A:1111:2222','Worker can access own identifiers and banking details via the guarded RPC');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT * FROM public.get_worker_private_data('W-A')$$,'42501',NULL,'Worker B cannot access Worker A private identifiers');
SELECT throws_ok($$SELECT * FROM public.worker_private_data$$,'42501',NULL,'Workers cannot bypass the private-data RPC');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::int FROM public.workers),1,'Contractor A sees only explicitly assigned worker');
SELECT is((SELECT count(*)::int FROM public.workers WHERE id='W-A' AND name='Worker A'),1,'Assigned contractor can read permitted directory fields');
SELECT throws_ok($$SELECT eshram_uan, aadhaar_last4, bank_account_last4 FROM public.workers$$,'42703',NULL,'Sensitive identifiers are absent from contractor directory columns');
SELECT throws_ok($$SELECT eshram_uan, aadhaar_last4, bank_account_last4 FROM public.worker_private_data$$,'42501',NULL,'Assigned contractor cannot read protected identifiers or banking fields');
SELECT throws_ok($$SELECT * FROM public.get_worker_private_data('W-A')$$,'42501',NULL,'Assigned contractor cannot call the worker-only private data RPC');
SELECT throws_ok($$SELECT * FROM public.qr_credentials$$,'42501',NULL,'Assigned contractor cannot read raw QR credentials');
SELECT is((SELECT count(*)::int FROM public.get_assigned_worker_contact('W-A')),0,'Assigned contractor sees no phone until worker consents');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT public.set_my_worker_contact_sharing(true)$$,'Worker can set their own contact-sharing consent');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT phone::text FROM public.get_assigned_worker_contact('W-A')),'1111111111','Assigned contractor can retrieve only consented contact phone');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::int FROM public.get_assigned_worker_contact('W-A')),0,'Unassigned contractor cannot retrieve worker contact');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::int FROM public.workers),0,'Contractor B sees no unassigned workers');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::int FROM public.workers),1,'Worker B sees only own row');
SELECT throws_ok($$INSERT INTO public.contractor_worker_assignments(worker_id,contractor_id) VALUES ('W-B','20000000-0000-4000-8000-000000000002')$$,'42501',NULL,'Contractor cannot self-assign workers through direct table mutation');
SELECT throws_ok($$UPDATE public.wage_ledger_entries SET acknowledgment_status='acknowledged_by_worker' WHERE worker_id='W-A'$$,'42501',NULL,'Worker cannot bypass payment acknowledgment operation');
SELECT throws_ok($$SELECT * FROM public.audit_events$$,'42501',NULL,'Authenticated users cannot SELECT audit events');
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT id FROM public.workers$$,'42501',NULL,'Anonymous users cannot query worker directory');
SELECT throws_ok($$SELECT * FROM public.worker_private_data$$,'42501',NULL,'Anonymous users cannot query private worker data');
SELECT throws_ok($$SELECT * FROM public.qr_credentials$$,'42501',NULL,'Anonymous users cannot query QR credential storage');
SELECT throws_ok($$SELECT * FROM public.get_worker_private_data('W-A')$$,'42501',NULL,'Anonymous users cannot execute worker private data RPC');
SELECT throws_ok($$SELECT * FROM public.get_assigned_worker_contact('W-A')$$,'42501',NULL,'Public QR/anonymous lookup cannot execute contact-returning RPC');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
