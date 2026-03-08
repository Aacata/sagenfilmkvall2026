import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ticket, Loader2 } from "lucide-react";

const Booking = () => {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<{ email: string; seat_ids: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("bookings")
      .select("email, seat_ids")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setBooking(data);
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            Din biljett
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={id || ""} size={200} />
          </div>
          {booking && (
            <>
              <div className="flex flex-wrap gap-2 justify-center">
                {booking.seat_ids.map((sid) => (
                  <span key={sid} className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-medium">
                    {sid}
                  </span>
                ))}
              </div>
              <p className="text-muted-foreground text-sm">{booking.email}</p>
            </>
          )}
          <p className="text-muted-foreground text-sm">Visa denna QR-kod vid ingången</p>
          <p className="text-xs text-muted-foreground break-all font-mono">ID: {id}</p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Booking;
