-- Temporary seat holds while a guest is filling in a booking
CREATE TABLE public.booking_holds (
  id uuid PRIMARY KEY,
  seats int NOT NULL CHECK (seats > 0 AND seats <= 10),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_holds_expires_at_idx ON public.booking_holds (expires_at);

GRANT ALL ON public.booking_holds TO service_role;

ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
-- No policies: the table is only reachable through the SECURITY DEFINER functions below.

CREATE OR REPLACE FUNCTION public.purge_expired_holds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.booking_holds WHERE expires_at < now();
$$;

REVOKE ALL ON FUNCTION public.purge_expired_holds() FROM PUBLIC, anon, authenticated;

-- Availability now also accounts for active holds
CREATE OR REPLACE FUNCTION public.get_availability()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'capacity', s.capacity,
    'booked', t.c + v.c,
    'tickets', t.c,
    'vip', v.c,
    'held', h.c,
    'remaining', greatest(0, s.capacity - (t.c + v.c + h.c))
  )
  FROM (SELECT capacity FROM public.event_settings WHERE id = 1) s,
       (SELECT count(*)::int AS c FROM public.tickets) t,
       (SELECT count(*)::int AS c FROM public.vip_guests) v,
       (SELECT coalesce(sum(seats), 0)::int AS c FROM public.booking_holds WHERE expires_at > now()) h;
$$;

-- Create or extend a hold for the given number of seats
CREATE OR REPLACE FUNCTION public.hold_seats(_hold_id uuid, _seats int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _capacity int;
  _used int;
  _expires timestamptz;
BEGIN
  IF _hold_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ogiltig reservation');
  END IF;
  IF _seats IS NULL OR _seats < 1 OR _seats > 10 THEN
    RETURN jsonb_build_object('error', 'Ange mellan 1 och 10 biljetter');
  END IF;

  PERFORM pg_advisory_xact_lock(918273645);

  DELETE FROM public.booking_holds WHERE expires_at < now();

  SELECT capacity INTO _capacity FROM public.event_settings WHERE id = 1;
  _capacity := coalesce(_capacity, 100);

  SELECT (SELECT count(*) FROM public.tickets)
       + (SELECT count(*) FROM public.vip_guests)
       + (SELECT coalesce(sum(seats), 0) FROM public.booking_holds WHERE id <> _hold_id)
    INTO _used;

  IF _used + _seats > _capacity THEN
    RETURN jsonb_build_object('error', 'Det finns bara ' || greatest(0, _capacity - _used) || ' platser kvar',
      'remaining', greatest(0, _capacity - _used));
  END IF;

  _expires := now() + interval '5 minutes';

  INSERT INTO public.booking_holds (id, seats, expires_at)
  VALUES (_hold_id, _seats, _expires)
  ON CONFLICT (id) DO UPDATE SET seats = excluded.seats, expires_at = excluded.expires_at;

  RETURN jsonb_build_object('success', true, 'expires_at', _expires,
    'remaining', greatest(0, _capacity - (_used + _seats)));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_hold(_hold_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.booking_holds WHERE id = _hold_id OR expires_at < now();
$$;

-- Booking consumes its own hold
CREATE OR REPLACE FUNCTION public.create_booking_with_names(_email text, _names jsonb, _hold_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count int;
  _used int;
  _capacity int;
  _booking_id uuid;
  _number text;
  _item jsonb;
  _first text;
  _last text;
  _hold_valid boolean := false;
BEGIN
  IF _email IS NULL OR btrim(_email) = '' OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('error', 'Ogiltig e-postadress');
  END IF;

  IF _names IS NULL OR jsonb_typeof(_names) <> 'array' THEN
    RETURN jsonb_build_object('error', 'Inga namn angivna');
  END IF;

  _count := jsonb_array_length(_names);
  IF _count < 1 OR _count > 10 THEN
    RETURN jsonb_build_object('error', 'Ange mellan 1 och 10 biljetter');
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_names) LOOP
    _first := btrim(coalesce(_item->>'first_name',''));
    _last := btrim(coalesce(_item->>'last_name',''));
    IF _first = '' OR _last = '' THEN
      RETURN jsonb_build_object('error', 'Både förnamn och efternamn krävs för varje biljett');
    END IF;
    IF length(_first) > 60 OR length(_last) > 60 THEN
      RETURN jsonb_build_object('error', 'Namnet är för långt');
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(918273645);

  DELETE FROM public.booking_holds WHERE expires_at < now();

  IF _hold_id IS NOT NULL THEN
    SELECT true INTO _hold_valid FROM public.booking_holds
    WHERE id = _hold_id AND seats >= _count AND expires_at > now();
    _hold_valid := coalesce(_hold_valid, false);

    IF NOT _hold_valid AND EXISTS (SELECT 1 FROM public.booking_holds WHERE id = _hold_id) THEN
      _hold_valid := true; -- hold exists but for fewer seats; extra seats checked below
    END IF;
  END IF;

  SELECT capacity INTO _capacity FROM public.event_settings WHERE id = 1;
  _capacity := coalesce(_capacity, 100);

  SELECT (SELECT count(*) FROM public.tickets)
       + (SELECT count(*) FROM public.vip_guests)
       + (SELECT coalesce(sum(seats), 0) FROM public.booking_holds
          WHERE _hold_id IS NULL OR id <> _hold_id)
    INTO _used;

  IF _used + _count > _capacity THEN
    DELETE FROM public.booking_holds WHERE id = _hold_id;
    RETURN jsonb_build_object('error', 'Det finns bara ' || greatest(0, _capacity - _used) || ' platser kvar');
  END IF;

  LOOP
    _number := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE booking_number = _number);
  END LOOP;

  INSERT INTO public.bookings (email, booking_number)
  VALUES (btrim(_email), _number)
  RETURNING id INTO _booking_id;

  INSERT INTO public.tickets (booking_id, first_name, last_name)
  SELECT _booking_id, btrim(n->>'first_name'), btrim(n->>'last_name')
  FROM jsonb_array_elements(_names) n;

  DELETE FROM public.booking_holds WHERE id = _hold_id;

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id, 'booking_number', _number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hold_seats(uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_hold(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_with_names(text, jsonb, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_availability() TO anon, authenticated;