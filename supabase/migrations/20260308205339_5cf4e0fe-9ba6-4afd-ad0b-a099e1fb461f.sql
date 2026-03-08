
-- Create the admin user directly using Supabase's auth admin API via a temporary function
-- This creates the user and assigns the admin role
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Insert user into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'bjarkikjellsson@gmail.com',
    crypt('admin123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Create identity for the user
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    new_user_id,
    'bjarkikjellsson@gmail.com',
    jsonb_build_object('sub', new_user_id::text, 'email', 'bjarkikjellsson@gmail.com'),
    'email',
    now(), now(), now()
  );

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin');
END $$;
