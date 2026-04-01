import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { dbSeatToSeat, type Seat } from "@/data/seatLayout";
import SeatGrid from "@/components/SeatGrid";
import BookingPanel from "@/components/BookingPanel";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import sagenLogo from "@/assets/sagen-logo.png";

const Index = () => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_seats_public");
    if (error) {
      toast.error("Kunde inte ladda platser");
      return;
    }
    setSeats((data as any[]).map(dbSeatToSeat));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeats();
    // Poll every 5 seconds for seat updates (realtime disabled for security)
    const interval = setInterval(fetchSeats, 5000);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  const toggleSeat = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleBook = useCallback(
    async (email: string) => {
      // Create booking atomically via secure function
      const { data: result, error: rpcError } = await supabase.rpc("create_booking_secure", {
        _email: email,
        _seat_ids: selectedIds,
      });

      const res = result as any;
      if (rpcError || res?.error) {
        toast.error(res?.error || "Bokningen misslyckades");
        return;
      }

      const bookingId = res.booking_id;

      // Build seat labels for email
      const seatLabels = seats
        .filter((s) => selectedIds.includes(s.id))
        .map((s) => `Rad ${s.row}, Plats ${s.seatNumber}${s.type === "vip" ? " ★" : ""}`);

      // Send confirmation email (fire-and-forget)
      supabase.functions
        .invoke("send-booking-email", {
          body: { bookingId, email, seatLabels, appUrl: window.location.origin },
        })
        .then(({ error }) => {
          if (error) console.error("Email send error:", error);
        });

      setSelectedIds([]);
      toast.success("Bokning bekräftad! En bekräftelse skickas till din e-post.");
      navigate(`/booking/${bookingId}`);
    },
    [selectedIds, seats, navigate]
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
        <div className="flex items-center justify-center mb-4 relative">
          <img src={sagenLogo} alt="Sägen Film" className="h-32 object-contain" />
          <Button variant="ghost" size="sm" asChild className="absolute right-0 text-muted-foreground">
            <Link to="/admin"><ShieldCheck className="w-4 h-4" /></Link>
          </Button>
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
