-- WURK UP · RLS and privilege regression tests
--
-- Reproduces the exact execution model PostgREST uses (SET LOCAL ROLE authenticated +
-- request.jwt.claims) so the three actors from the 42501 incident are covered:
--   * a worker reading/writing its own rows,
--   * an assigned contractor reading the same rows,
--   * an unrelated authenticated account that must see nothing,
-- plus the negative write cases.
--
-- Run against the project (read-only for real data — every mutating case rolls back):
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rls_permissions.sql
-- Every test raises an exception on failure, so a non-zero exit means a regression.
--
-- Fixture IDs (project qpgnoherjkvvasrwjcmf):
--   worker A   WKR-7fb53fd7-769c-4f01-9583-8d9d4d6a4bad  user 91fb6d39-4a6c-480c-ab6e-4a8671b8fe7a
--   worker B   WKR-ab5e0195-fb05-45ed-bfc4-cea4c0dce649  user b2ea88b2-46f6-4dd8-9bb0-fef174db9dcc
-- Replace them with fixtures of your own environment before running elsewhere.

\set ON_ERROR_STOP on
\pset pager off

DO $test$
DECLARE
  worker_a constant text := 'WKR-7fb53fd7-769c-4f01-9583-8d9d4d6a4bad';
  worker_b constant text := 'WKR-ab5e0195-fb05-45ed-bfc4-cea4c0dce649';
  user_a   constant uuid := '91fb6d39-4a6c-480c-ab6e-4a8671b8fe7a';
  user_b   constant uuid := 'b2ea88b2-46f6-4dd8-9bb0-fef174db9dcc';
  stranger constant uuid := '11111111-1111-4111-8111-111111111111';
  n integer;
BEGIN
  -- ---------------------------------------------------------------- worker A
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  EXECUTE 'SELECT count(*) FROM public.workers' INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'TEST FAIL: worker A should see exactly 1 worker row, saw %', n; END IF;

  -- These four statements are the exact reads that returned 42501 before migration
  -- 20261117120000; a privilege regression makes them raise instead of returning.
  EXECUTE 'SELECT count(*) FROM public.attendance_records' INTO n;
  EXECUTE 'SELECT count(*) FROM public.wage_ledger_entries' INTO n;
  EXECUTE 'SELECT count(*) FROM public.disputes' INTO n;
  EXECUTE 'SELECT count(*) FROM public.approval_requests' INTO n;
  RAISE NOTICE 'PASS: worker reads workers/attendance/ledger/disputes/approvals without 42501';

  IF public.is_current_worker(worker_a) IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST FAIL: is_current_worker(worker A) must be true for its owner';
  END IF;
  IF public.is_current_worker(worker_b) IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST FAIL: is_current_worker(worker B) must be false for worker A';
  END IF;

  -- positive write: own dispute
  BEGIN
    INSERT INTO public.disputes (id, worker_id, contractor_name, contractor_phone, site_name,
      dispute_type, claimed_amount_paise, incident_date, filing_date, status, description,
      dlo_filing_ref, evidence_muster_count)
    VALUES ('DSP-RLS-TEST-OWN', worker_a, 'RLS Test', '+910000000000', 'RLS Test Site',
      'unpaid_wages', 1000, current_date, current_date, 'submitted',
      'Rolled-back regression row for RLS verification.', 'WU-DSP-20261117-RLSTEST001', 1);
    RAISE NOTICE 'PASS: worker may file a dispute for its own worker row';
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'TEST FAIL: own dispute insert rejected (%)', SQLERRM;
  END;

  -- negative write: somebody else's dispute
  BEGIN
    INSERT INTO public.disputes (id, worker_id, contractor_name, contractor_phone, site_name,
      dispute_type, claimed_amount_paise, incident_date, filing_date, status, description,
      dlo_filing_ref, evidence_muster_count)
    VALUES ('DSP-RLS-TEST-OTHER', worker_b, 'RLS Test', '+910000000000', 'RLS Test Site',
      'unpaid_wages', 1000, current_date, current_date, 'submitted',
      'Rolled-back regression row that must be rejected.', 'WU-DSP-20261117-RLSTEST002', 1);
    RAISE EXCEPTION 'TEST FAIL: worker A was allowed to file a dispute for worker B';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: filing a dispute for another worker is blocked (42501)';
  END;

  -- ------------------------------------------------------- unrelated account
  PERFORM set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  EXECUTE 'SELECT count(*) FROM public.workers' INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'TEST FAIL: unrelated account saw % worker rows', n; END IF;
  EXECUTE 'SELECT count(*) FROM public.disputes' INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'TEST FAIL: unrelated account saw % dispute rows', n; END IF;
  IF public.is_current_worker(worker_a) OR public.is_assigned_contractor(worker_a) THEN
    RAISE EXCEPTION 'TEST FAIL: unrelated account resolved a worker predicate';
  END IF;
  RAISE NOTICE 'PASS: unrelated account sees nothing and resolves no predicate';

  -- --------------------------------------------------- assigned contractor
  -- The assignment is created inside this transaction and rolled back, so no real
  -- data changes. Worker B's account acts as the contractor assigned to worker A
  -- (user_a is already worker A's owner, which would mask the boundary being tested).
  RESET ROLE;
  INSERT INTO public.contractor_worker_assignments (id, worker_id, contractor_id)
  VALUES (gen_random_uuid(), worker_a, user_b);

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  IF public.is_assigned_contractor(worker_a) IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST FAIL: assignment predicate not satisfied for the assigned contractor';
  END IF;
  IF public.is_current_worker(worker_a) IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST FAIL: the assigned contractor must not be the owner of worker A';
  END IF;
  EXECUTE 'SELECT count(*) FROM public.workers' INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'TEST FAIL: assigned contractor saw % worker rows (expected own + assigned)', n; END IF;
  EXECUTE 'SELECT count(*) FROM public.attendance_records' INTO n;
  EXECUTE 'SELECT count(*) FROM public.wage_ledger_entries' INTO n;
  EXECUTE 'SELECT count(*) FROM public.disputes' INTO n;
  RAISE NOTICE 'PASS: assigned contractor reads the assigned worker''s participant tables';

  -- Contractor may not file a dispute on the worker's behalf (INSERT policy is worker-only).
  BEGIN
    INSERT INTO public.disputes (id, worker_id, contractor_name, contractor_phone, site_name,
      dispute_type, claimed_amount_paise, incident_date, filing_date, status, description,
      dlo_filing_ref, evidence_muster_count)
    VALUES ('DSP-RLS-TEST-CTR', worker_a, 'RLS Test', '+910000000000', 'RLS Test Site',
      'unpaid_wages', 1000, current_date, current_date, 'submitted',
      'Rolled-back row that the contractor policy must reject.', 'WU-DSP-20261117-RLSTEST003', 1);
    RAISE EXCEPTION 'TEST FAIL: contractor was allowed to insert a dispute';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: contractor cannot file a dispute on the worker''s behalf';
  END;

  -- ------------------------------------------- privacy: restricted columns
  RESET ROLE;
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
    EXECUTE 'SELECT user_id FROM public.workers LIMIT 1';
    RAISE EXCEPTION 'TEST FAIL: workers.user_id is readable by authenticated';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: workers.user_id remains unreadable by authenticated';
  END;

  RAISE EXCEPTION 'ALL RLS TESTS PASSED';
END
$test$;

ROLLBACK;
