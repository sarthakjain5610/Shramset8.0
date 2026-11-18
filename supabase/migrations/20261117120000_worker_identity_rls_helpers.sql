-- 2026-11-17 · Fix SQLSTATE 42501 "permission denied for table workers" on dashboard reads.
--
-- Root cause (reproduced against project qpgnoherjkvvasrwjcmf):
--   The SELECT policies on attendance_records, wage_ledger_entries, disputes and
--   approval_requests embed an EXISTS subquery over workers that filters on
--   `w.user_id`. Policy subqueries are evaluated with the privileges of the
--   CALLING role, and 20261031120000_worker_private_data_security.sql deliberately
--   revoked table-wide SELECT on public.workers and re-granted only directory
--   columns (user_id, phone, Aadhaar, e-Shram and banking data are excluded on
--   purpose). The caller therefore had no privilege on workers.user_id and every
--   read of those four tables was rejected:
--
--     ERROR: 42501: permission denied for table workers
--     HINT: Grant the required privileges to the current role with:
--           GRANT SELECT ON public.workers TO authenticated;
--
--   Direct reads of public.workers worked, which is why the dashboards failed only
--   once they requested attendance/ledger/disputes/approvals.
--
-- Fix: move the ownership and assignment checks into SECURITY DEFINER predicates
-- that run as the table owner and return only a boolean. The policies keep their
-- exact original semantics.
--
-- Guarantees preserved (nothing here widens access):
--   * authenticated keeps exactly the same column-level grants on public.workers;
--     user_id, phone, Aadhaar, e-Shram, bank and UPI data remain unreadable.
--   * No table-wide GRANT SELECT is issued anywhere.
--   * RLS stays ENABLED on every table; no policy is dropped without an immediate
--     equivalent replacement; no policy is made permissive to anon or PUBLIC.
--   * Worker ownership scoping and contractor-assignment scoping are unchanged.
--   * get_worker_private_data / get_assigned_worker_contact /
--     set_my_worker_contact_sharing and the worker-controlled consent flag are
--     untouched.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Predicates (boolean only — they never return row data)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_current_worker(p_worker_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workers w
    WHERE w.id = p_worker_id
      AND w.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_contractor(p_worker_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contractor_worker_assignments a
    WHERE a.worker_id = p_worker_id
      AND a.contractor_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_worker(p_worker_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_current_worker(p_worker_id)
      OR public.is_assigned_contractor(p_worker_id);
$$;

COMMENT ON FUNCTION public.is_current_worker(text) IS
  'True when the caller owns the worker row. SECURITY DEFINER so policies never need SELECT on workers.user_id.';
COMMENT ON FUNCTION public.is_assigned_contractor(text) IS
  'True when the caller is the contractor assigned to the worker row. Owner-level check, boolean result only.';
COMMENT ON FUNCTION public.can_read_worker(text) IS
  'Worker-ownership OR contractor-assignment predicate used by participant read policies.';

-- Least privilege: anonymous callers may not execute these predicates.
REVOKE ALL ON FUNCTION public.is_current_worker(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_assigned_contractor(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_worker(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_current_worker(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_contractor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_worker(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Participant read policies (same semantics, no workers.user_id dependency)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS attendance_participant_read ON public.attendance_records;
CREATE POLICY attendance_participant_read ON public.attendance_records
  FOR SELECT TO authenticated
  USING (public.can_read_worker(worker_id));

DROP POLICY IF EXISTS ledger_participant_read ON public.wage_ledger_entries;
CREATE POLICY ledger_participant_read ON public.wage_ledger_entries
  FOR SELECT TO authenticated
  USING (public.can_read_worker(worker_id));

DROP POLICY IF EXISTS dispute_participant_read ON public.disputes;
CREATE POLICY dispute_participant_read ON public.disputes
  FOR SELECT TO authenticated
  USING (public.can_read_worker(worker_id));

DROP POLICY IF EXISTS approval_participant_read ON public.approval_requests;
CREATE POLICY approval_participant_read ON public.approval_requests
  FOR SELECT TO authenticated
  USING (contractor_id = auth.uid() OR public.is_current_worker(worker_id));

-- ---------------------------------------------------------------------------
-- 3. Worker write policies (worker may only file/answer for its own row)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS dispute_worker_create ON public.disputes;
CREATE POLICY dispute_worker_create ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_worker(worker_id));

DROP POLICY IF EXISTS approval_worker_respond ON public.approval_requests;
CREATE POLICY approval_worker_respond ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (public.is_current_worker(worker_id) AND status = 'pending')
  WITH CHECK (
    public.is_current_worker(worker_id)
    AND status IN ('approved', 'rejected', 'reported_suspicious')
  );
