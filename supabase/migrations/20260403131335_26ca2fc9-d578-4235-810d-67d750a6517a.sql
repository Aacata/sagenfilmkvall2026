
CREATE OR REPLACE FUNCTION public.create_booking_secure(_email text, _seat_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _booking_id uuid;
  _locked_count int;
BEGIN
  -- Validate inputs
  IF _email IS NULL OR _email = '' THEN
    RETURN jsonb_build_object('error', 'Email is required');
  END IF;
  IF _seat_ids IS NULL OR array_length(_seat_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('error', 'No seats selected');
  END IF;

  -- Lock the requested seats rows first, then count available
  PERFORM id FROM seats WHERE id = ANY(_seat_ids) AND is_booked = false FOR UPDATE;
  GET DIAGNOSTICS _locked_count = ROW_COUNT;

  IF _locked_count != array_length(_seat_ids, 1) THEN
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
$function$;
