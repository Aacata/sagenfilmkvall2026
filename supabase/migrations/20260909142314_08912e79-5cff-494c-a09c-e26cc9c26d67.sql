
REVOKE ALL ON FUNCTION public.check_in_ticket(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.find_booking_by_number(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.find_user_by_email_fn(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fix_auth_user_nulls(uuid) FROM anon, authenticated;
