-- Internal-only helpers: keep off the public API
REVOKE EXECUTE ON FUNCTION public.find_user_by_email_fn(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fix_auth_user_nulls(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_booking_public(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.find_user_by_email_fn(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fix_auth_user_nulls(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_public(uuid) TO service_role;

-- has_role must stay callable by authenticated (used inside RLS policies), but not by anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Admin-only entry points: signed-in only (bodies also enforce the admin role)
REVOKE EXECUTE ON FUNCTION public.check_in_ticket(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_booking_by_number(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_booking_by_number(text) TO authenticated, service_role;

-- Guest-facing RPCs stay callable (booking flow has no login)
GRANT EXECUTE ON FUNCTION public.get_availability() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_booking_with_names(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_ticket(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO anon, authenticated, service_role;