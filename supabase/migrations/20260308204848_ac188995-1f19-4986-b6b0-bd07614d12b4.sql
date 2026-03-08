
-- Seats table: stores the layout and booking state of each seat
CREATE TABLE public.seats (
  id TEXT NOT NULL PRIMARY KEY,
  row_number INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_type TEXT NOT NULL DEFAULT 'standard' CHECK (seat_type IN ('standard', 'wheelchair', 'vip', 'couple')),
  is_booked BOOLEAN NOT NULL DEFAULT false,
  booked_by_email TEXT,
  booking_id UUID,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Everyone can view seats (needed for the seat map)
CREATE POLICY "Anyone can view seats" ON public.seats FOR SELECT USING (true);

-- Anyone can book (insert handled via update since seats are pre-seeded)
CREATE POLICY "Anyone can book seats" ON public.seats FOR UPDATE USING (true) WITH CHECK (true);

-- Bookings table: stores booking records with QR reference
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  seat_ids TEXT[] NOT NULL,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can create a booking
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (true);

-- Anyone can view bookings (needed for QR ticket page)
CREATE POLICY "Anyone can view bookings" ON public.bookings FOR SELECT USING (true);

-- Anyone can update bookings (for check-in)
CREATE POLICY "Anyone can update bookings" ON public.bookings FOR UPDATE USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_seats_updated_at
  BEFORE UPDATE ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
