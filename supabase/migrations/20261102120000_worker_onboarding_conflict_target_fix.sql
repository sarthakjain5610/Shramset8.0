-- Corrective migration for complete_my_worker_onboarding.
-- Its RETURNS TABLE output variable `worker_id` made ON CONFLICT (worker_id)
-- ambiguous in PL/pgSQL. Keep the original authorization and behavior unchanged,
-- and name the private table's primary-key constraint explicitly.
BEGIN;

CREATE OR REPLACE FUNCTION public.complete_my_worker_onboarding(
  p_trade text,
  p_skill_level text
)
RETURNS TABLE (worker_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_name text;
  v_phone text;
  v_worker_id text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT p.full_name, p.phone
    INTO v_name, v_phone
    FROM public.profiles AS p
   WHERE p.id = v_user_id
     AND p.role = 'worker';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker authorization required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.btrim(COALESCE(v_name, '')) = '' OR pg_catalog.btrim(COALESCE(v_phone, '')) = '' THEN
    RAISE EXCEPTION 'worker profile name and phone are required' USING ERRCODE = '22023';
  END IF;

  IF p_trade IS NULL OR p_trade NOT IN (
    'Head Mason (मुख्य राजमिस्त्री)',
    'Steel Binder & Rigging Helper (सरिया बाइंडर)',
    'Site Electrician & Cable Jointer (साइट इलेक्ट्रीशियन)',
    'General Helper & Concrete Batching (बेलदार)',
    'Tile Grinding & Surface Polisher (फिनिशिंग)',
    'Carpenter & Shuttering (शटरिंग बढ़ई)',
    'Plumber & Pipe Fitter (प्लंबर)',
    'Painter & Putty Applicator (पेंटर)'
  ) THEN
    RAISE EXCEPTION 'unsupported worker trade' USING ERRCODE = '22023';
  END IF;
  IF p_skill_level IS NULL OR p_skill_level NOT IN ('unskilled', 'semi_skilled', 'skilled', 'highly_skilled') THEN
    RAISE EXCEPTION 'unsupported worker skill level' USING ERRCODE = '22023';
  END IF;

  -- Fast idempotent path; the UNIQUE user_id constraint plus ON CONFLICT below
  -- handles two simultaneous first requests without creating duplicate workers.
  SELECT w.id
    INTO v_worker_id
    FROM public.workers AS w
   WHERE w.user_id = v_user_id
   FOR UPDATE;

  IF v_worker_id IS NULL THEN
    v_worker_id := 'WKR-' || pg_catalog.gen_random_uuid()::text;
    INSERT INTO public.workers (
      id, user_id, name, trade, skill_level, daily_base_wage_paise, active_site_id
    )
    VALUES (
      v_worker_id, v_user_id, v_name, p_trade, p_skill_level, NULL, NULL
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_worker_id;

    -- If a concurrent request won the UNIQUE(user_id) race, return its row.
    IF v_worker_id IS NULL THEN
      SELECT w.id
        INTO v_worker_id
        FROM public.workers AS w
       WHERE w.user_id = v_user_id;
    END IF;
  END IF;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'worker onboarding could not be completed' USING ERRCODE = '40001';
  END IF;

  -- The phone is copied only into the inaccessible private table. Existing
  -- private values are never overwritten by a retry. The named constraint also
  -- avoids collision with the RETURNS TABLE output variable `worker_id`.
  INSERT INTO public.worker_private_data (worker_id, phone)
  VALUES (v_worker_id, v_phone)
  ON CONFLICT ON CONSTRAINT worker_private_data_pkey DO NOTHING;

  RETURN QUERY SELECT v_worker_id;
END;
$$;

ALTER FUNCTION public.complete_my_worker_onboarding(text, text) OWNER TO postgres;
ALTER FUNCTION public.complete_my_worker_onboarding(text, text) SET search_path = pg_catalog;
REVOKE ALL ON FUNCTION public.complete_my_worker_onboarding(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_my_worker_onboarding(text, text) TO authenticated;

COMMIT;
