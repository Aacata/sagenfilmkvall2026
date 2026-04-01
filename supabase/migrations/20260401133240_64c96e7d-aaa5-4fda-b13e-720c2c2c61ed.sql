
-- Drop the anon SELECT policy that exposes emails
DROP POLICY IF EXISTS "Anon can view seats via view" ON public.seats;

-- Drop the security_invoker view
DROP VIEW IF EXISTS public.seats_public;

-- Create a security definer function that returns seats without email
CREATE OR REPLACE FUNCTION public.get_seats_public()
RETURNS TABLE(
  id text,
  row_number int,
  seat_number int,
  seat_type text,
  is_booked boolean,
  booking_id uuid,
  checked_in boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, row_number, seat_number, seat_type, is_booked, booking_id, checked_in, created_at, updated_at
  FROM seats
  ORDER BY row_number, seat_number;
$$;
