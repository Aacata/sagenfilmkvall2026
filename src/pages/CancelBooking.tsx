import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, XCircle, CheckCircle2 } from "lucide-react";

type Status = "loading" | "confirm" | "cancelling" | "done" | "not_found" | "already_cancelled";

const CancelBooking = () => {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [booking, setBooking] = useState<{ email: string; seat_ids: string[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("bookings")
      .select("email, seat_ids")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setStatus("not_found");
        } else {
          setBooking(data);
          setStatus("confirm");
        }
      });
  }, [id]);

  const handleCancel = async () => {
    if (!id || !booking) return;
    setStatus("cancelling");

    // Free the seats
    const { error: seatError } = await supabase
      .from("seats")
      .update({ is_booked: false, booked_by_email: null, booking_id: null, checked_in: false })
      .in("id", booking.seat_ids);

    if (seatError) {
      setStatus("confirm");
      return;
    }

    // Delete the booking
    const { error: bookingError } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id);

    if (bookingError) {
      setStatus("confirm");
      return;
    }

    setStatus("done");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "done" ? (
              <><CheckCircle2 className="w-6 h-6 text-green-500" /> Avbokning klar</>
            ) : (
              <><XCircle className="w-6 h-6 text-destructive" /> Avboka bokning</>
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
              <p className="text-muted-foreground">
                Vill du avboka din bokning för <strong>{booking.seat_ids.length}</strong> plats{booking.seat_ids.length > 1 ? "er" : ""}?
              </p>
              <p className="text-sm text-muted-foreground">{booking.email}</p>
              <div className="flex gap-3 mt-2">
                <Button variant="destructive" onClick={handleCancel}>
                  Ja, avboka
                </Button>
                <Button asChild variant="outline">
                  <Link to="/">Nej, behåll</Link>
                </Button>
              </div>
            </>
          )}

          {status === "cancelling" && (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          )}

          {status === "done" && (
            <>
              <p className="text-muted-foreground">Din bokning har avbokats och platserna är nu lediga igen.</p>
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
