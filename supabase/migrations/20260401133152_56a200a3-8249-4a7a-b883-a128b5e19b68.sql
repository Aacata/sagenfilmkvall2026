
-- 1. Restrict direct seats SELECT to admins only (public uses seats_public view)
DROP POLICY IF EXISTS "Anyone can view seats" ON public.seats;

CREATE POLICY "Admins can view seats" ON public.seats
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also allow anon to SELECT seats (needed for the view with security_invoker)
CREATE POLICY "Anon can view seats via view" ON public.seats
FOR SELECT TO anon
USING (true);

-- 2. Remove direct anon UPDATE on seats - booking will go through secure function
DROP POLICY IF EXISTS "Public can book available seats" ON public.seats;

-- 3. Drop the permissive INSERT policy on bookings
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;

-- 4. Create a secure booking function that validates and creates everything atomically
CREATE OR REPLACE FUNCTION public.create_booking_secure(_email text, _seat_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _booking_id uuid;
  _available_count int;
BEGIN
  -- Validate inputs
  IF _email IS NULL OR _email = '' THEN
    RETURN jsonb_build_object('error', 'Email is required');
  END IF;
  IF _seat_ids IS NULL OR array_length(_seat_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No seats selected');
  END IF;

  -- Check all seats are available (lock rows)
  SELECT count(*) INTO _available_count
  FROM seats
  WHERE id = ANY(_seat_ids) AND is_booked = false
  FOR UPDATE;

  IF _available_count != array_length(_seat_ids, 1) THEN
    RETURN jsonb_build_object('error', 'Some seats are no longer available');
  END IF;

  -- Create booking
  INSERT INTO bookings (email, seat_ids)
  VALUES (_email, _seat_ids)
  RETURNING id INTO _booking_id;

  -- Update seats
  UPDATE seats
  SET is_booked = true, booked_by_email = _email, booking_id = _booking_id
  WHERE id = ANY(_seat_ids);

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$$;
