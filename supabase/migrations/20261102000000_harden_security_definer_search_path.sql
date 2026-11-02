-- Harden every application SECURITY DEFINER function after all prior migrations.
-- Preserve historical migrations; this corrective migration sets the effective function
-- configuration, owner and execute ACLs for existing installations as well as fresh resets.
BEGIN;

ALTER FUNCTION public.provision_shram_profile() SET search_path = pg_catalog;
ALTER FUNCTION public.get_worker_private_data(text) SET search_path = pg_catalog;
ALTER FUNCTION public.get_assigned_worker_contact(text) SET search_path = pg_catalog;
ALTER FUNCTION public.set_my_worker_contact_sharing(boolean) SET search_path = pg_catalog;

-- These functions access protected tables and must be owned by the trusted database role.
ALTER FUNCTION public.provision_shram_profile() OWNER TO postgres;
ALTER FUNCTION public.get_worker_private_data(text) OWNER TO postgres;
ALTER FUNCTION public.get_assigned_worker_contact(text) OWNER TO postgres;
ALTER FUNCTION public.set_my_worker_contact_sharing(boolean) OWNER TO postgres;

-- The auth.users trigger invokes provision_shram_profile internally; callers do not.
REVOKE ALL ON FUNCTION public.provision_shram_profile() FROM PUBLIC, anon, authenticated;

-- Private RPCs are available only to authenticated callers; each function performs its own
-- actor/role/ownership checks. No anon/public/service-facing grant is added here.
REVOKE ALL ON FUNCTION public.get_worker_private_data(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worker_private_data(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_assigned_worker_contact(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assigned_worker_contact(text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_my_worker_contact_sharing(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_worker_contact_sharing(boolean) TO authenticated;

COMMIT;
