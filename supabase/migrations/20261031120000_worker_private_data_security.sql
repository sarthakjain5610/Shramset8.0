-- Move worker PII/banking identifiers out of the contractor-readable worker directory.
-- Additive, transactional migration: copy first, then remove the duplicate sensitive columns.
BEGIN;

CREATE TABLE public.worker_private_data (
  worker_id text PRIMARY KEY REFERENCES public.workers(id) ON DELETE RESTRICT,
  phone varchar(20),
  eshram_uan varchar(20) UNIQUE,
  bocw_registration_no varchar(50) UNIQUE,
  aadhaar_last4 varchar(4),
  bank_account_last4 varchar(4),
  ifsc_code varchar(15),
  upi_id varchar(50),
  blood_group varchar(5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workers ADD COLUMN contact_sharing_consent boolean NOT NULL DEFAULT false;

-- Preserve existing worker values before removing sensitive columns from the shared relation.
INSERT INTO public.worker_private_data (
  worker_id, phone, eshram_uan, bocw_registration_no, aadhaar_last4,
  bank_account_last4, ifsc_code, upi_id, blood_group
)
SELECT id, phone, eshram_uan, bocw_registration_no, aadhaar_last4,
       bank_account_last4, ifsc_code, upi_id, blood_group
FROM public.workers
ON CONFLICT (worker_id) DO NOTHING;

ALTER TABLE public.workers
  DROP COLUMN phone,
  DROP COLUMN eshram_uan,
  DROP COLUMN bocw_registration_no,
  DROP COLUMN aadhaar_last4,
  DROP COLUMN bank_account_last4,
  DROP COLUMN ifsc_code,
  DROP COLUMN upi_id,
  DROP COLUMN blood_group;

ALTER TABLE public.worker_private_data ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_private_data FROM PUBLIC, anon, authenticated;

-- Explicitly remove prior table-wide read privilege, then allow only non-sensitive
-- directory columns. Worker ownership and contractor-assignment RLS still scope rows.
REVOKE ALL ON public.workers FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, name, hindi_name, trade, skill_level, daily_base_wage_paise,
  active_site_id, created_at, contact_sharing_consent
) ON public.workers TO authenticated;

-- Workers retrieve their own private record only through this narrowly granted function.
-- Contractors and anonymous callers cannot invoke it successfully.
CREATE OR REPLACE FUNCTION public.get_worker_private_data(p_worker_id text)
RETURNS TABLE (
  worker_id text,
  phone varchar,
  eshram_uan varchar,
  bocw_registration_no varchar,
  aadhaar_last4 varchar,
  bank_account_last4 varchar,
  ifsc_code varchar,
  upi_id varchar,
  blood_group varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'worker'
  ) THEN
    RAISE EXCEPTION 'worker authorization required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT d.worker_id, d.phone, d.eshram_uan, d.bocw_registration_no,
         d.aadhaar_last4, d.bank_account_last4, d.ifsc_code, d.upi_id, d.blood_group
  FROM public.worker_private_data d
  JOIN public.workers w ON w.id = d.worker_id
  WHERE d.worker_id = p_worker_id AND w.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker private record unavailable' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.get_worker_private_data(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worker_private_data(text) TO authenticated;

-- Contact sharing defaults to off. Contractors get only the phone number, only for
-- an assigned worker, and only after that worker explicitly enables sharing.
CREATE OR REPLACE FUNCTION public.get_assigned_worker_contact(p_worker_id text)
RETURNS TABLE (worker_id text, phone varchar)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'contractor'
  ) THEN
    RAISE EXCEPTION 'contractor authorization required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT d.worker_id, d.phone
  FROM public.worker_private_data d
  JOIN public.workers w ON w.id = d.worker_id
  JOIN public.contractor_worker_assignments a ON a.worker_id = w.id
  WHERE w.id = p_worker_id
    AND a.contractor_id = auth.uid()
    AND w.contact_sharing_consent = true
    AND d.phone IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.get_assigned_worker_contact(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assigned_worker_contact(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_worker_contact_sharing(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'worker'
  ) THEN
    RAISE EXCEPTION 'worker authorization required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.workers
  SET contact_sharing_consent = COALESCE(p_enabled, false)
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker record unavailable' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_worker_contact_sharing(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_worker_contact_sharing(boolean) TO authenticated;

-- No public QR lookup function or view returns private data. The opaque credential
-- table remains inaccessible to anon/authenticated; server-side verification must
-- use a separate minimal response and never join worker_private_data.
REVOKE ALL ON public.worker_private_data, public.qr_credentials FROM PUBLIC, anon, authenticated;
COMMIT;
