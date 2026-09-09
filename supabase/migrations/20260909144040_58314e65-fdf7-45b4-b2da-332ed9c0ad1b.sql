
CREATE TABLE IF NOT EXISTS public.event_settings (
  id int PRIMARY KEY DEFAULT 1,
  capacity int NOT NULL DEFAULT 100,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_settings_singleton CHECK (id = 1),
  CONSTRAINT event_settings_capacity_positive CHECK (capacity > 0 AND capacity <= 10000)
);

GRANT SELECT ON public.event_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.event_settings TO authenticated;
GRANT ALL ON public.event_settings TO service_role;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read event settings" ON public.event_settings;
CREATE POLICY "Anyone can read event settings" ON public.event_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can insert event settings" ON public.event_settings;
CREATE POLICY "Admins can insert event settings" ON public.event_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can update event settings" ON public.event_settings;
CREATE POLICY "Admins can update event settings" ON public.event_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.event_settings (id, capacity) VALUES (1, 100) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER update_event_settings_updated_at
BEFORE UPDATE ON public.event_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.vip_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  note text,
  checked_in boolean NOT NULL DEFAULT false,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vip_guests TO authenticated;
GRANT ALL ON public.vip_guests TO service_role;
ALTER TABLE public.vip_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view vip guests" ON public.vip_guests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can insert vip guests" ON public.vip_guests FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update vip guests" ON public.vip_guests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete vip guests" ON public.vip_guests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_availability()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'capacity', s.capacity,
    'booked', t.c + v.c,
    'tickets', t.c,
    'vip', v.c,
    'remaining', greatest(0, s.capacity - (t.c + v.c))
  )
  FROM (SELECT capacity FROM public.event_settings WHERE id = 1) s,
       (SELECT count(*)::int AS c FROM public.tickets) t,
       (SELECT count(*)::int AS c FROM public.vip_guests) v;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_with_names(_email text, _names jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count int;
  _used int;
  _capacity int;
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

  SELECT capacity INTO _capacity FROM public.event_settings WHERE id = 1;
  _capacity := coalesce(_capacity, 100);

  SELECT (SELECT count(*) FROM public.tickets) + (SELECT count(*) FROM public.vip_guests) INTO _used;

  IF _used + _count > _capacity THEN
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

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id, 'booking_number', _number);
END;
$$;
