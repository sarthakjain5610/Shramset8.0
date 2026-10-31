-- Corrective migration. Do not edit the already-versioned initial migration.
-- Inspect remote migration history and export/backup data before applying.
BEGIN;

-- Create new relations before any grants, policies or RLS statements reference them.
CREATE TABLE IF NOT EXISTS public.contractor_worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), worker_id text NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  contractor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(worker_id, contractor_id)
);
CREATE TABLE IF NOT EXISTS public.qr_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  credential_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  replaced_by uuid REFERENCES public.qr_credentials(id) ON DELETE RESTRICT
);

-- Ordinary signup must not require government identifiers.
ALTER TABLE public.workers ALTER COLUMN eshram_uan DROP NOT NULL;
ALTER TABLE public.workers ALTER COLUMN bocw_registration_no DROP NOT NULL;
ALTER TABLE public.workers ALTER COLUMN aadhaar_last4 DROP NOT NULL;
ALTER TABLE public.workers ALTER COLUMN user_id DROP NOT NULL;
-- Financial evidence is historical evidence and must not cascade away with a worker.
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_worker_id_fkey;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;
ALTER TABLE public.wage_ledger_entries DROP CONSTRAINT IF EXISTS wage_ledger_entries_worker_id_fkey;
ALTER TABLE public.wage_ledger_entries ADD CONSTRAINT wage_ledger_entries_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_worker_id_fkey;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;
ALTER TABLE public.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_worker_id_fkey;
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_requests_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('worker','contractor'));

-- Server-side profile provisioning. A trusted auth.users trigger creates profiles;
-- clients cannot create or alter privileged roles. Only constrained public roles are accepted.
CREATE OR REPLACE FUNCTION public.provision_shram_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'signup_role';
  IF requested_role NOT IN ('worker','contractor') THEN RAISE EXCEPTION 'invalid public signup role'; END IF;
  INSERT INTO public.profiles(id, role, full_name, phone)
  VALUES (NEW.id, requested_role, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'phone',''));
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.provision_shram_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shram_auth_profile_provision ON auth.users;
CREATE TRIGGER shram_auth_profile_provision AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.provision_shram_profile();

-- Remove unsafe legacy policies (including audit-wide read and broad FOR ALL).
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('profiles','workers','sites','attendance_records','wage_ledger_entries','disputes','audit_events','approval_requests')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename); END LOOP;
END $$;
REVOKE ALL ON public.profiles, public.workers, public.sites, public.attendance_records,
  public.wage_ledger_entries, public.disputes, public.audit_events, public.approval_requests
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wage_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_worker_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_self_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
GRANT SELECT ON public.profiles TO authenticated;
REVOKE UPDATE, DELETE ON public.profiles FROM authenticated;

ALTER TABLE public.qr_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qr_credentials FROM PUBLIC, anon, authenticated;
ALTER TABLE public.contractor_worker_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contractor_worker_assignments FROM PUBLIC, anon, authenticated;
CREATE POLICY assignment_participants_read ON public.contractor_worker_assignments FOR SELECT TO authenticated
USING (contractor_id=auth.uid());
-- Assignment mutation is intentionally denied until a separately validated invitation operation is deployed.

CREATE POLICY worker_self_read ON public.workers FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY worker_assigned_read ON public.workers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.contractor_worker_assignments a WHERE a.worker_id=workers.id AND a.contractor_id=auth.uid())
);
-- Assignment table is added here, with contractor-managed membership and worker-visible own rows.

CREATE POLICY site_assigned_read ON public.sites FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.contractor_worker_assignments a JOIN public.workers w ON w.id=a.worker_id WHERE a.contractor_id=auth.uid() AND w.active_site_id=sites.id)
);
-- Financial/attendance reads scoped to worker or explicit assigned contractor.
CREATE POLICY attendance_participant_read ON public.attendance_records FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND (w.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.contractor_worker_assignments a WHERE a.worker_id=w.id AND a.contractor_id=auth.uid())))
);
CREATE POLICY ledger_participant_read ON public.wage_ledger_entries FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND (w.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.contractor_worker_assignments a WHERE a.worker_id=w.id AND a.contractor_id=auth.uid())))
);
CREATE POLICY dispute_participant_read ON public.disputes FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND (w.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.contractor_worker_assignments a WHERE a.worker_id=w.id AND a.contractor_id=auth.uid())))
);
CREATE POLICY dispute_worker_create ON public.disputes FOR INSERT TO authenticated WITH CHECK (
 EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND w.user_id=auth.uid())
);
CREATE POLICY approval_participant_read ON public.approval_requests FOR SELECT TO authenticated USING (
 contractor_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND w.user_id=auth.uid())
);
CREATE POLICY approval_contractor_create ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (contractor_id=auth.uid() AND status='pending' AND EXISTS (SELECT 1 FROM public.contractor_worker_assignments a WHERE a.worker_id=approval_requests.worker_id AND a.contractor_id=auth.uid()));
CREATE POLICY approval_worker_respond ON public.approval_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND w.user_id=auth.uid() AND status='pending'))
WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.id=worker_id AND w.user_id=auth.uid()) AND status IN ('approved','rejected','reported_suspicious'));
-- Least-privilege read access; no direct client financial writes in this phase.
GRANT SELECT ON public.workers, public.sites, public.attendance_records, public.wage_ledger_entries,
  public.disputes, public.approval_requests, public.contractor_worker_assignments TO authenticated;
GRANT INSERT ON public.disputes, public.approval_requests TO authenticated;
GRANT UPDATE (status, responded_at) ON public.approval_requests TO authenticated;
-- Audit has no client read/write policy; authoritative events must be emitted by trusted backend operations.
REVOKE ALL ON public.audit_events FROM PUBLIC, anon, authenticated;

-- Initial schema remains the authority for integer paise; enforce non-null operational values.
ALTER TABLE public.wage_ledger_entries ALTER COLUMN amount_paise SET NOT NULL;
COMMIT;

-- Rollback guidance: restore prior policy definitions from the backed-up initial migration and restore
-- the dropped NOT NULL/FK constraints only after confirming no null values; do not cascade-delete records.
