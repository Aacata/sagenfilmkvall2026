import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, XCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

type Status = "loading" | "confirm" | "cancelling" | "done" | "not_found";

interface SeatInfo {
  id: string;
  row_number: number;
  seat_number: number;
  seat_type: string;
}

const CancelBooking = () => {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [booking, setBooking] = useState<{ email: string; seat_ids: string[] } | null>(null);
  const [seatDetails, setSeatDetails] = useState<SeatInfo[]>([]);
  const [cancelledSeats, setCancelledSeats] = useState<string[]>([]);

  const fetchBooking = async () => {
    if (!id) return;
    const { data, error } = await supabase.rpc("get_booking_by_id", { _booking_id: id });

    if (error || !data || data.length === 0) {
      setStatus("not_found");
      return;
    }

    const b = data[0];
    setBooking({ email: b.email, seat_ids: b.seat_ids });

    // Fetch seat details from public view
    const { data: seats } = await (supabase
      .from("seats_public" as any)
      .select("id, row_number, seat_number, seat_type") as any)
      .in("id", b.seat_ids);

    setSeatDetails((seats as SeatInfo[]) || []);
    setStatus("confirm");
  };

  useEffect(() => {
    fetchBooking();
  }, [id]);

  const sendAdminNotification = async (email: string, cancelledSeatLabels: string[], allCancelled: boolean) => {
    supabase.functions
      .invoke("send-cancellation-notice", {
        body: {
          adminEmail: "hellosagen@gmail.com",
          userEmail: email,
          seatLabels: cancelledSeatLabels,
          allCancelled,
          bookingId: id,
        },
      })
      .then(({ error }) => {
        if (error) console.error("Admin notification error:", error);
      });
  };

  const handleCancelSeat = async (seatId: string) => {
    if (!id || !booking) return;

    const seat = seatDetails.find((s) => s.id === seatId);
    const seatLabel = seat ? `Rad ${seat.row_number}, Plats ${seat.seat_number}` : seatId;

    const { data, error } = await supabase.rpc("cancel_seat", {
      _booking_id: id,
      _seat_id: seatId,
    });

    if (error || (data as any)?.error) {
      toast.error("Kunde inte avboka platsen");
      return;
    }

    const result = data as any;
    await sendAdminNotification(result.email, [seatLabel], result.booking_deleted);
    setCancelledSeats((prev) => [...prev, seatId]);

    if (result.booking_deleted) {
      setStatus("done");
    } else {
      setBooking({ ...booking, seat_ids: booking.seat_ids.filter((sid) => sid !== seatId) });
      toast.success(`${seatLabel} avbokad`);
    }
  };

  const handleCancelAll = async () => {
    if (!id || !booking) return;
    setStatus("cancelling");

    const labels = seatDetails
      .filter((s) => booking.seat_ids.includes(s.id))
      .map((s) => `Rad ${s.row_number}, Plats ${s.seat_number}`);

    const { data, error } = await supabase.rpc("cancel_booking", { _booking_id: id });

    if (error || (data as any)?.error) {
      setStatus("confirm");
      toast.error("Kunde inte avboka platserna");
      return;
    }

    await sendAdminNotification((data as any).email, labels, true);
    setStatus("done");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeSeats = seatDetails.filter(
    (s) => booking?.seat_ids.includes(s.id) && !cancelledSeats.includes(s.id)
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "done" ? (
              <><CheckCircle2 className="w-6 h-6 text-primary" /> Avbokning klar</>
            ) : (
              <><XCircle className="w-6 h-6 text-destructive" /> Avboka platser</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "not_found" && (
            <>
              <p className="text-muted-foreground">Bokningen hittades inte. Den kan redan ha avbokats.</p>
              <Button asChild variant="outline">
                <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" /> Tillbaka</Link>
              </Button>
            </>
          )}

          {status === "confirm" && booking && (
            <>
              <p className="text-muted-foreground text-sm">{booking.email}</p>

              {activeSeats.length > 1 && (
                <p className="text-muted-foreground text-sm">
                  Klicka på <X className="w-3 h-3 inline" /> för att avboka en enskild plats, eller avboka alla.
                </p>
              )}

              <div className="flex flex-wrap gap-2 justify-center">
                {activeSeats.map((seat) => (
                  <div
                    key={seat.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium"
                  >
                    <span>Rad {seat.row_number}, Plats {seat.seat_number}{seat.seat_type === "vip" ? " ★" : ""}</span>
                    <button
                      onClick={() => handleCancelSeat(seat.id)}
                      className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                      title="Avboka denna plats"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {cancelledSeats.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {seatDetails
                    .filter((s) => cancelledSeats.includes(s.id))
                    .map((seat) => (
                      <span
                        key={seat.id}
                        className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm line-through"
                      >
                        Rad {seat.row_number}, Plats {seat.seat_number}
                      </span>
                    ))}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                {activeSeats.length > 1 && (
                  <Button variant="destructive" onClick={handleCancelAll}>
                    Avboka alla ({activeSeats.length})
                  </Button>
                )}
                {activeSeats.length === 1 && (
                  <Button variant="destructive" onClick={() => handleCancelSeat(activeSeats[0].id)}>
                    Avboka sista platsen
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/">Behåll</Link>
                </Button>
              </div>
            </>
          )}

          {status === "cancelling" && (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          )}

          {status === "done" && (
            <>
              <p className="text-muted-foreground">Avbokningen är genomförd och platserna är lediga igen.</p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" /> Boka nya platser</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CancelBooking;
