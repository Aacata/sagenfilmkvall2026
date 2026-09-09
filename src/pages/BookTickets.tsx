import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Loader2, Plus, Ticket, Trash2 } from "lucide-react";
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
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const holdId = useRef<string>(crypto.randomUUID());
  const doneRef = useRef(false);

  useEffect(() => {
    supabase.rpc("get_availability").then(({ data }) => {
      const res = data as { remaining?: number; capacity?: number } | null;
      if (res && typeof res.remaining === "number") setRemaining(res.remaining);
      if (res && typeof res.capacity === "number") setCapacity(res.capacity);
    });
  }, []);

  // Reserve the seats for 5 minutes while the guest fills in the form
  const refreshHold = useCallback(async (seats: number) => {
    const { data, error } = await supabase.rpc("hold_seats", {
      _hold_id: holdId.current,
      _seats: seats,
    });
    const res = data as { error?: string; expires_at?: string; remaining?: number } | null;
    if (error || res?.error) {
      if (res?.error) toast.error(res.error);
      if (typeof res?.remaining === "number") setRemaining(res.remaining);
      return false;
    }
    if (res?.expires_at) setExpiresAt(new Date(res.expires_at).getTime());
    if (typeof res?.remaining === "number") setRemaining(res.remaining);
    setExpired(false);
    return true;
  }, []);

  useEffect(() => {
    if (expired || doneRef.current) return;
    refreshHold(guests.length);
  }, [guests.length, expired, refreshHold]);

  // Release the reservation if the guest leaves the page
  useEffect(() => {
    const id = holdId.current;
    return () => {
      if (!doneRef.current) {
        supabase.rpc("release_hold", { _hold_id: id });
      }
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !doneRef.current) {
        setExpired(true);
        setExpiresAt(null);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const restart = async () => {
    holdId.current = crypto.randomUUID();
    setExpired(false);
    const ok = await refreshHold(guests.length);
    if (!ok) setExpired(true);
  };

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
    if (submitting || expired) return;

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
      _hold_id: holdId.current,
    });

    const res = data as { error?: string; booking_id?: string } | null;
    if (error || res?.error) {
      toast.error(res?.error || "Bokningen misslyckades");
      setSubmitting(false);
      return;
    }

    doneRef.current = true;
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

  const mmss =
    secondsLeft === null
      ? null
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;


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
              <p className="text-xs text-muted-foreground">{remaining} av {capacity} platser kvar</p>
            )}
            {!expired && mmss && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Dina platser är reserverade i {mmss}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {expired && (
              <div className="mb-4 p-3 rounded-lg border border-border bg-secondary/50 space-y-2">
                <p className="text-sm">Tiden gick ut och platserna släpptes. Starta om för att reservera dem igen.</p>
                <Button type="button" size="sm" onClick={restart}>Starta om</Button>
              </div>
            )}
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

              <Button type="submit" className="w-full h-12" disabled={submitting || expired}>
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
