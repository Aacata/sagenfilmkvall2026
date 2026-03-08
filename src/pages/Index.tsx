import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { dbSeatToSeat, type Seat } from "@/data/seatLayout";
import SeatGrid from "@/components/SeatGrid";
import BookingPanel from "@/components/BookingPanel";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import sagenLogo from "@/assets/sagen-logo.png";

const Index = () => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase
      .from("seats")
      .select("*")
      .order("row_number")
      .order("seat_number");
    if (error) {
      toast.error("Kunde inte ladda platser");
      return;
    }
    setSeats(data.map(dbSeatToSeat));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeats();
    const channel = supabase
      .channel("seats-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seats" }, () => {
        fetchSeats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSeats]);

  const toggleSeat = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleBook = useCallback(
    async (email: string) => {
      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({ email, seat_ids: selectedIds })
        .select("id")
        .single();

      if (bookingError || !booking) {
        toast.error("Bokningen misslyckades");
        return;
      }

      // Update seats
      const { error: seatError } = await supabase
        .from("seats")
        .update({
          is_booked: true,
          booked_by_email: email,
          booking_id: booking.id,
        })
        .in("id", selectedIds);

      if (seatError) {
        toast.error("Kunde inte uppdatera platser");
        return;
      }

      setSelectedIds([]);
      toast.success("Bokning bekräftad!");
      navigate(`/booking/${booking.id}`);
    },
    [selectedIds, navigate]
  );

  const selectedSeats = seats.filter((s) => selectedIds.includes(s.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <header className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <img src={sagenLogo} alt="Sägen Film" className="h-16 object-contain" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Sägen Filmkväll 2026</h1>
        <p className="text-muted-foreground text-sm mt-1">Välj dina platser och boka direkt</p>
      </header>

      <SeatGrid seats={seats} selectedIds={selectedIds} onToggleSeat={toggleSeat} />
      <BookingPanel
        selectedSeats={selectedSeats}
        onBook={handleBook}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
};

export default Index;
