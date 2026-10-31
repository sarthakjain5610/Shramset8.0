BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

-- Synthetic identities only; this test never targets production user records.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','worker-a@test.invalid','',now(),'{}','{"signup_role":"worker","full_name":"Worker A","phone":"100"}',now(),now()),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','worker-b@test.invalid','',now(),'{}','{"signup_role":"worker","full_name":"Worker B","phone":"200"}',now(),now()),
 ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','contractor-a@test.invalid','',now(),'{}','{"signup_role":"contractor","full_name":"Contractor A","phone":"300"}',now(),now()),
 ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','contractor-b@test.invalid','',now(),'{}','{"signup_role":"contractor","full_name":"Contractor B","phone":"400"}',now(),now());
INSERT INTO public.workers (id,user_id,name,phone,trade,skill_level,daily_base_wage_paise)
VALUES ('W-A','10000000-0000-4000-8000-000000000001','Worker A','100','Mason','skilled',55000),
       ('W-B','10000000-0000-4000-8000-000000000002','Worker B','200','Mason','skilled',55000);
INSERT INTO public.contractor_worker_assignments(worker_id,contractor_id)
VALUES ('W-A','20000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::int FROM public.workers),1,'Worker A only sees own worker row');
SELECT is((SELECT count(*)::int FROM public.profiles),1,'Worker A only sees own profile');
SELECT is((SELECT count(*)::int FROM public.contractor_worker_assignments),0,'Worker cannot enumerate assignments');
SELECT throws_ok($$UPDATE public.workers SET name='hacked' WHERE id='W-B'$$,'42501',NULL,'Worker cannot modify another worker profile');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*)::int FROM public.workers),1,'Contractor A sees only explicitly assigned worker');
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::int FROM public.workers),0,'Contractor B sees no unassigned workers');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*)::int FROM public.workers),1,'Worker B sees only own row');
SELECT throws_ok($$INSERT INTO public.contractor_worker_assignments(worker_id,contractor_id) VALUES ('W-B','20000000-0000-4000-8000-000000000002')$$,'42501',NULL,'Contractor cannot self-assign workers through direct table mutation');
SELECT throws_ok($$UPDATE public.wage_ledger_entries SET acknowledgment_status='acknowledged_by_worker' WHERE worker_id='W-A'$$,'42501',NULL,'Worker cannot bypass payment acknowledgment operation');
SELECT is((SELECT count(*)::int FROM public.audit_events),0,'Authenticated users cannot read unrestricted audit events');
SELECT * FROM finish();
ROLLBACK;
