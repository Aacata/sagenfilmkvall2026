import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import sagenLogo from "@/assets/sagen-logo.png";

interface Guest {
  first_name: string;
  last_name: string;
}

const MAX_TICKETS = 10;

const BookTickets = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState<Guest[]>([{ first_name: "", last_name: "" }]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.rpc("get_availability").then(({ data }) => {
      const res = data as { remaining?: number; capacity?: number } | null;
      if (res && typeof res.remaining === "number") setRemaining(res.remaining);
      if (res && typeof res.capacity === "number") setCapacity(res.capacity);
    });
  }, []);

  const updateGuest = (index: number, field: keyof Guest, value: string) => {
    setGuests((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  };

  const addGuest = () => {
    if (guests.length >= MAX_TICKETS) return;
    setGuests((prev) => [...prev, { first_name: "", last_name: "" }]);
  };

  const removeGuest = (index: number) => {
    setGuests((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleaned = guests.map((g) => ({
      first_name: g.first_name.trim(),
      last_name: g.last_name.trim(),
    }));

    if (!email.trim()) {
      toast.error("Ange din e-postadress");
      return;
    }
    if (cleaned.some((g) => !g.first_name || !g.last_name)) {
      toast.error("Fyll i för- och efternamn för varje biljett");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_booking_with_names", {
      _email: email.trim(),
      _names: cleaned,
    });

    const res = data as { error?: string; booking_id?: string } | null;
    if (error || res?.error) {
      toast.error(res?.error || "Bokningen misslyckades");
      setSubmitting(false);
      return;
    }

    const bookingId = res!.booking_id!;

    supabase.functions
      .invoke("send-booking-email", {
        body: {
          bookingId,
          email: email.trim(),
          guests: cleaned,
          appUrl: window.location.origin,
        },
      })
      .then(({ error: mailError }) => {
        if (mailError) console.error("Email send error:", mailError);
      });

    toast.success("Bokning bekräftad! Bekräftelse skickas till din e-post.");
    navigate(`/booking/${bookingId}`);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-center mb-6">
          <img src={sagenLogo} alt="Sägen Film" className="h-24 object-contain" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ticket className="w-5 h-5 text-primary" />
              Boka biljetter
            </CardTitle>
            {remaining !== null && (
              <p className="text-xs text-muted-foreground">{remaining} av 100 platser kvar</p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-postadress</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.se"
                />
              </div>

              <div className="space-y-3">
                <Label>Namn på biljetterna</Label>
                {guests.map((guest, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Förnamn"
                      required
                      maxLength={60}
                      value={guest.first_name}
                      onChange={(e) => updateGuest(index, "first_name", e.target.value)}
                    />
                    <Input
                      placeholder="Efternamn"
                      required
                      maxLength={60}
                      value={guest.last_name}
                      onChange={(e) => updateGuest(index, "last_name", e.target.value)}
                    />
                    {guests.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGuest(index)}
                        aria-label="Ta bort biljett"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {guests.length < MAX_TICKETS && (
                  <Button type="button" variant="outline" size="sm" onClick={addGuest}>
                    <Plus className="w-4 h-4 mr-1" />
                    Lägg till biljett
                  </Button>
                )}
              </div>

              <Button type="submit" className="w-full h-12" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Boka ${guests.length} biljett${guests.length > 1 ? "er" : ""}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Button asChild variant="ghost" className="mt-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Tillbaka</Link>
        </Button>
      </div>
    </div>
  );
};

export default BookTickets;
