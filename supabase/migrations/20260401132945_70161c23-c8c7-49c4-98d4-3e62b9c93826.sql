
-- 1. Create a public view for seats that hides email
CREATE VIEW public.seats_public
WITH (security_invoker = on) AS
SELECT id, row_number, seat_number, seat_type, is_booked, booking_id, checked_in, created_at, updated_at
FROM public.seats;

-- 2. Drop overly permissive policies on bookings
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;

-- 3. Recreate bookings policies with proper restrictions
-- Public can insert bookings (needed for booking flow)
CREATE POLICY "Public can create bookings" ON public.bookings
FOR INSERT TO public
WITH CHECK (true);

-- Only admins can view all bookings; anon can view by specific ID (via RPC)
CREATE POLICY "Admins can view bookings" ON public.bookings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update bookings (check-in)
CREATE POLICY "Admins can update bookings" ON public.bookings
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Drop overly permissive seat update policy
DROP POLICY IF EXISTS "Anyone can book seats" ON public.seats;

-- 5. Recreate seat update policy - public can only set is_booked/booking_id/booked_by_email on unbooked seats
-- Admins can update any seat
CREATE POLICY "Admins can update seats" ON public.seats
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can book available seats" ON public.seats
FOR UPDATE TO anon
USING (is_booked = false)
WITH CHECK (is_booked = true);

-- 6. Create a security definer function for cancel/booking lookup
CREATE OR REPLACE FUNCTION public.get_booking_by_id(_booking_id uuid)
RETURNS TABLE(id uuid, email text, seat_ids text[], checked_in boolean, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, seat_ids, checked_in, created_at
  FROM public.bookings
  WHERE id = _booking_id
  LIMIT 1;
$$;

-- 7. Create a security definer function to cancel a booking (update seats + delete/update booking)
CREATE OR REPLACE FUNCTION public.cancel_seat(_booking_id uuid, _seat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _booking record;
  _remaining text[];
  _result jsonb;
BEGIN
  SELECT * INTO _booking FROM bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  -- Check seat belongs to booking
  IF NOT (_seat_id = ANY(_booking.seat_ids)) THEN
    RETURN jsonb_build_object('error', 'Seat not in booking');
  END IF;

  -- Free the seat
  UPDATE seats SET is_booked = false, booked_by_email = null, booking_id = null, checked_in = false
  WHERE id = _seat_id;

  -- Update booking
  _remaining := array_remove(_booking.seat_ids, _seat_id);
  IF array_length(_remaining, 1) IS NULL OR array_length(_remaining, 1) = 0 THEN
    DELETE FROM bookings WHERE id = _booking_id;
    RETURN jsonb_build_object('success', true, 'booking_deleted', true, 'email', _booking.email);
  ELSE
    UPDATE bookings SET seat_ids = _remaining WHERE id = _booking_id;
    RETURN jsonb_build_object('success', true, 'booking_deleted', false, 'email', _booking.email);
  END IF;
END;
$$;

-- 8. Create function to cancel all seats in a booking
CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _booking record;
BEGIN
  SELECT * INTO _booking FROM bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  -- Free all seats
  UPDATE seats SET is_booked = false, booked_by_email = null, booking_id = null, checked_in = false
  WHERE id = ANY(_booking.seat_ids);

  -- Delete booking
  DELETE FROM bookings WHERE id = _booking_id;

  RETURN jsonb_build_object('success', true, 'email', _booking.email);
END;
$$;

-- 9. Add storage policies for email-assets bucket
CREATE POLICY "Public can read email assets" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'email-assets');

CREATE POLICY "Only admins can modify email assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update email assets" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete email assets" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));
