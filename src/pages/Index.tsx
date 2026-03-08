import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { initialSeats, type Seat } from "@/data/seatLayout";
import SeatGrid from "@/components/SeatGrid";
import BookingPanel from "@/components/BookingPanel";
import { toast } from "sonner";
import { Film } from "lucide-react";

const Index = () => {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const toggleSeat = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleBook = useCallback(
    (email: string) => {
      const bookingId = crypto.randomUUID();
      setSeats((prev) =>
        prev.map((s) =>
          selectedIds.includes(s.id)
            ? { ...s, isBooked: true, bookedByEmail: email, bookingId }
            : s
        )
      );
      setSelectedIds([]);
      toast.success("Bokning bekräftad!");
      navigate(`/booking/${bookingId}`);
    },
    [selectedIds, navigate]
  );

  const selectedSeats = seats.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Film className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Lovelab Bio</h1>
        </div>
        <p className="text-muted-foreground text-sm">Välj dina platser och boka direkt</p>
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
