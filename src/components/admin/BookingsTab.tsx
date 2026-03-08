import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface BookedSeat {
  id: string;
  row_number: number;
  seat_number: number;
  booked_by_email: string | null;
  booking_id: string | null;
  checked_in: boolean;
  seat_type: string;
}

const BookingsTab = () => {
  const [seats, setSeats] = useState<BookedSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchBookedSeats = async () => {
    const { data } = await supabase
      .from("seats")
      .select("id, row_number, seat_number, booked_by_email, booking_id, checked_in, seat_type")
      .eq("is_booked", true)
      .order("row_number")
      .order("seat_number");
    setSeats(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookedSeats();

    const channel = supabase
      .channel("admin-seats")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, () => {
        fetchBookedSeats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCancelBooking = async (seat: BookedSeat) => {
    setCancelling(seat.id);
    
    // Clear the seat
    await supabase.from("seats").update({
      is_booked: false,
      booked_by_email: null,
      booking_id: null,
      checked_in: false,
    }).eq("id", seat.id);

    // If there's a booking_id, remove the seat from the booking's seat_ids
    if (seat.booking_id) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("seat_ids")
        .eq("id", seat.booking_id)
        .single();

      if (booking) {
        const updatedIds = booking.seat_ids.filter((id: string) => id !== seat.id);
        if (updatedIds.length === 0) {
          // Delete the booking entirely if no seats left
          await supabase.from("bookings").delete().eq("id", seat.booking_id);
        } else {
          await supabase.from("bookings").update({ seat_ids: updatedIds }).eq("id", seat.booking_id);
        }
      }
    }

    toast.success(`Rad ${seat.row_number}, Plats ${seat.seat_number} – bokning borttagen`);
    setCancelling(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" />
          Bokade platser ({seats.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {seats.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Inga bokade platser.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {seats.map((seat) => (
              <div
                key={seat.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex items-center gap-3">
                  {seat.checked_in && (
                    <CheckCircle className="w-4 h-4 text-[hsl(var(--success))] shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      Rad {seat.row_number}, Plats {seat.seat_number}
                      <span className="ml-2 text-xs text-muted-foreground capitalize">({seat.seat_type})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{seat.booked_by_email || "–"}</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={cancelling === seat.id}
                  onClick={() => handleCancelBooking(seat)}
                >
                  {cancelling === seat.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Ta bort</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingsTab;
