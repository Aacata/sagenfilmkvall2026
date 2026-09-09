ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS event_location TEXT,
  ADD COLUMN IF NOT EXISTS event_time TEXT;
