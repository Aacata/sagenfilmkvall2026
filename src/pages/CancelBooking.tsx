import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, XCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import type { BookingData } from "./Booking";

type Status = "loading" | "confirm" | "working" | "done" | "not_found";

const CancelBooking = () => {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [booking, setBooking] = useState<BookingData | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.rpc("get_booking_public", { _booking_id: id }).then(({ data }) => {
      const b = data as unknown as BookingData | null;
      if (!b) {
        setStatus("not_found");
        return;
      }
      setBooking(b);
      setStatus("confirm");
    });
  }, [id]);

  const notifyAdmin = (email: string, names: string[], allCancelled: boolean) => {
    supabase.functions
      .invoke("send-cancellation-notice", {
        body: {
          adminEmail: "hellosagen@gmail.com",
          userEmail: email,
          names,
          allCancelled,
          bookingId: id,
          bookingNumber: booking?.booking_number,
        },
      })
      .then(({ error }) => {
        if (error) console.error("Admin notification error:", error);
      });
  };

  const cancelOne = async (ticketId: string) => {
    if (!id || !booking) return;
    const { data, error } = await supabase.rpc("cancel_ticket", {
      _booking_id: id,
      _ticket_id: ticketId,
    });
    const res = data as { error?: string; email?: string; name?: string; booking_deleted?: boolean } | null;
    if (error || res?.error) {
      toast.error(res?.error || "Kunde inte avboka biljetten");
      return;
    }
    notifyAdmin(res!.email!, [res!.name!], !!res!.booking_deleted);
    if (res!.booking_deleted) {
      setStatus("done");
    } else {
      setBooking({ ...booking, tickets: booking.tickets.filter((t) => t.id !== ticketId) });
      toast.success(`${res!.name} avbokad`);
    }
  };

  const cancelAll = async () => {
    if (!id || !booking) return;
    setStatus("working");
    const { data, error } = await supabase.rpc("cancel_booking", { _booking_id: id });
    const res = data as { error?: string; email?: string; names?: string[] } | null;
    if (error || res?.error) {
      setStatus("confirm");
      toast.error("Kunde inte avboka");
      return;
    }
    notifyAdmin(res!.email!, res!.names || [], true);
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
              <><CheckCircle2 className="w-6 h-6 text-[hsl(var(--success))]" />Avbokat</>
            ) : status === "not_found" ? (
              <><XCircle className="w-6 h-6 text-destructive" />Hittades inte</>
            ) : (
              <>Avboka biljetter</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "not_found" && (
            <p className="text-muted-foreground text-sm">
              Bokningen finns inte längre – den kan redan vara avbokad.
            </p>
          )}

          {status === "done" && (
            <p className="text-muted-foreground text-sm">
              Dina platser är nu lediga för andra. Tack för att du meddelade oss!
            </p>
          )}

          {(status === "confirm" || status === "working") && booking && (
            <>
              <p className="text-sm text-muted-foreground">
                Bokning {booking.booking_number} · {booking.email}
              </p>
              <div className="space-y-2">
                {booking.tickets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-sm">{t.first_name} {t.last_name}</span>
                    <Button variant="ghost" size="sm" onClick={() => cancelOne(t.id)} disabled={status === "working"}>
                      <X className="w-4 h-4 mr-1" />Avboka
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="destructive" className="w-full" onClick={cancelAll} disabled={status === "working"}>
                {status === "working" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Avboka hela bokningen"}
              </Button>
            </>
          )}

          <Button asChild variant="outline">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Till startsidan</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CancelBooking;
