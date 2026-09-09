
ALTER TABLE public.event_settings ADD COLUMN IF NOT EXISTS event_title text;
ALTER TABLE public.event_settings ADD COLUMN IF NOT EXISTS event_info text;
UPDATE public.event_settings SET
  event_title = coalesce(event_title, 'Sägen Filmkväll 2026'),
  event_info = coalesce(event_info, 'En kväll med film, popcorn och gott sällskap. Boka dina biljetter – ange namn på alla som kommer.')
WHERE id = 1;
