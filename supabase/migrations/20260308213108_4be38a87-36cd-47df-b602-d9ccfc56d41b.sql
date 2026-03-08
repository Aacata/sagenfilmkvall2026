CREATE OR REPLACE FUNCTION public.find_user_by_email_fn(_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users WHERE email = _email LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.fix_auth_user_nulls(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE auth.users 
  SET email_change = COALESCE(email_change, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      confirmation_token = COALESCE(confirmation_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
  WHERE id = _user_id
$$;