import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ticket, Loader2, CheckCircle2 } from "lucide-react";

export interface TicketRow {
  id: string;
  first_name: string;
  last_name: string;
  checked_in: boolean;
  checked_in_at: string | null;
}

export interface BookingData {
  id: string;
  email: string;
  booking_number: string;
  tickets: TicketRow[];
}

const Booking = () => {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.rpc("get_booking_public", { _booking_id: id }).then(({ data }) => {
      setBooking((data as unknown as BookingData) || null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Bokningen hittades inte.</p>
        <Button asChild variant="outline"><Link to="/">Till startsidan</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Ticket className="w-6 h-6 text-primary" />
              Dina biljetter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Bokningsnummer</p>
            <p className="text-3xl font-bold tracking-widest">{booking.booking_number}</p>
            <p className="text-xs text-muted-foreground">{booking.email}</p>
          </CardContent>
        </Card>

        {booking.tickets.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-6 flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={t.id} size={180} level="H" marginSize={2} />
              </div>
              <p className="font-medium">{t.first_name} {t.last_name}</p>
              {t.checked_in ? (
                <p className="text-xs text-[hsl(var(--success))] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Incheckad
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Visa denna QR-kod vid ingången</p>
              )}
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Tillbaka</Link>
          </Button>
          <Button asChild variant="ghost" className="flex-1">
            <Link to={`/cancel/${booking.id}`}>Avboka</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Booking;
