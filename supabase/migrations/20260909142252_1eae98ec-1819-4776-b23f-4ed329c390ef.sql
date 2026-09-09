
-- Remove seat-based model
DROP FUNCTION IF EXISTS public.get_seats_public();
DROP FUNCTION IF EXISTS public.create_booking_secure(text, text[]);
DROP FUNCTION IF EXISTS public.cancel_seat(uuid, text);
DROP FUNCTION IF EXISTS public.cancel_booking(uuid);
DROP FUNCTION IF EXISTS public.get_booking_by_id(uuid);
DROP TABLE IF EXISTS public.seats CASCADE;

DELETE FROM public.bookings;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS seat_ids;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS checked_in;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_number text;
UPDATE public.bookings SET booking_number = upper(substr(md5(random()::text),1,6)) WHERE booking_number IS NULL;
ALTER TABLE public.bookings ALTER COLUMN booking_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_number_key ON public.bookings (booking_number);

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  checked_in boolean NOT NULL DEFAULT false,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tickets" ON public.tickets FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update tickets" ON public.tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete tickets" ON public.tickets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS tickets_booking_id_idx ON public.tickets (booking_id);

-- Capacity / availability
CREATE OR REPLACE FUNCTION public.get_availability()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'capacity', 100,
    'booked', (SELECT count(*) FROM public.tickets),
    'remaining', greatest(0, 100 - (SELECT count(*) FROM public.tickets))
  );
$$;

-- Create booking with names
CREATE OR REPLACE FUNCTION public.create_booking_with_names(_email text, _names jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count int;
  _used int;
  _booking_id uuid;
  _number text;
  _item jsonb;
  _first text;
  _last text;
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

  SELECT count(*) INTO _used FROM public.tickets;
  IF _used + _count > 100 THEN
    RETURN jsonb_build_object('error', 'Det finns bara ' || (100 - _used) || ' platser kvar');
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

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id, 'booking_number', _number);
END;
$$;

-- Public booking lookup by uuid (guest ticket page)
CREATE OR REPLACE FUNCTION public.get_booking_public(_booking_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'email', b.email,
    'booking_number', b.booking_number,
    'created_at', b.created_at,
    'tickets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'first_name', t.first_name, 'last_name', t.last_name,
        'checked_in', t.checked_in, 'checked_in_at', t.checked_in_at
      ) ORDER BY t.created_at)
      FROM public.tickets t WHERE t.booking_id = b.id
    ), '[]'::jsonb)
  )
  FROM public.bookings b WHERE b.id = _booking_id;
$$;

-- Guest cancellation
CREATE OR REPLACE FUNCTION public.cancel_ticket(_booking_id uuid, _ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
  _name text;
  _left int;
BEGIN
  SELECT b.email, t.first_name || ' ' || t.last_name INTO _email, _name
  FROM public.tickets t JOIN public.bookings b ON b.id = t.booking_id
  WHERE t.id = _ticket_id AND t.booking_id = _booking_id;

  IF _email IS NULL THEN
    RETURN jsonb_build_object('error', 'Biljetten hittades inte');
  END IF;

  DELETE FROM public.tickets WHERE id = _ticket_id;
  SELECT count(*) INTO _left FROM public.tickets WHERE booking_id = _booking_id;

  IF _left = 0 THEN
    DELETE FROM public.bookings WHERE id = _booking_id;
    RETURN jsonb_build_object('success', true, 'booking_deleted', true, 'email', _email, 'name', _name);
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_deleted', false, 'email', _email, 'name', _name);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
  _names text[];
BEGIN
  SELECT b.email INTO _email FROM public.bookings b WHERE b.id = _booking_id;
  IF _email IS NULL THEN
    RETURN jsonb_build_object('error', 'Bokningen hittades inte');
  END IF;

  SELECT array_agg(t.first_name || ' ' || t.last_name) INTO _names
  FROM public.tickets t WHERE t.booking_id = _booking_id;

  DELETE FROM public.bookings WHERE id = _booking_id;

  RETURN jsonb_build_object('success', true, 'email', _email, 'names', coalesce(_names, ARRAY[]::text[]));
END;
$$;

-- Door check-in (admin only)
CREATE OR REPLACE FUNCTION public.check_in_ticket(_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _t record;
  _num text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Behörighet saknas');
  END IF;

  SELECT t.*, b.booking_number INTO _t
  FROM public.tickets t JOIN public.bookings b ON b.id = t.booking_id
  WHERE t.id = _ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Biljetten hittades inte');
  END IF;

  IF _t.checked_in THEN
    RETURN jsonb_build_object('error', 'Redan incheckad',
      'name', _t.first_name || ' ' || _t.last_name,
      'checked_in_at', _t.checked_in_at);
  END IF;

  UPDATE public.tickets SET checked_in = true, checked_in_at = now() WHERE id = _ticket_id;

  RETURN jsonb_build_object('success', true,
    'name', _t.first_name || ' ' || _t.last_name,
    'booking_number', _t.booking_number);
END;
$$;

-- Look up a booking by its short number (admin only, for door desk)
CREATE OR REPLACE FUNCTION public.find_booking_by_number(_number text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Behörighet saknas');
  END IF;

  SELECT public.get_booking_public(b.id) INTO _result
  FROM public.bookings b WHERE b.booking_number = upper(btrim(_number));

  IF _result IS NULL THEN
    RETURN jsonb_build_object('error', 'Bokningen hittades inte');
  END IF;

  RETURN _result;
END;
$$;
