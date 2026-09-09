import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Ticket } from "lucide-react";
import sagenLogo from "@/assets/sagen-logo.png";

interface EventSettings {
  capacity: number;
  event_title: string | null;
  event_info: string | null;
  poster_url: string | null;
}

const Index = () => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(100);
  const [settings, setSettings] = useState<EventSettings | null>(null);

  useEffect(() => {
    supabase
      .from("event_settings")
      .select("capacity, event_title, event_info, poster_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings(data as EventSettings);
          setCapacity(data.capacity ?? 100);
        }
      });

    const load = async () => {
      const { data } = await supabase.rpc("get_availability");
      const res = data as { remaining?: number; capacity?: number } | null;
      if (res && typeof res.remaining === "number") setRemaining(res.remaining);
      if (res && typeof res.capacity === "number") setCapacity(res.capacity);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const soldOut = remaining === 0;
  const title = settings?.event_title?.trim() || "Sägen Filmkväll 2026";
  const info =
    settings?.event_info?.trim() ||
    "En kväll med film, popcorn och gott sällskap. Boka dina biljetter – ange namn på alla som kommer.";

  return (
    <div className="relative min-h-screen bg-background px-4 py-10 flex flex-col overflow-hidden">
      {settings?.poster_url && (
        <>
          <img
            src={settings.poster_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background" />
        </>
      )}

      <div className="relative flex flex-col flex-1">
        <header className="relative flex items-center justify-center">
          <img src={sagenLogo} alt="Sägen Film" className="h-32 object-contain" />
          <Button variant="ghost" size="sm" asChild className="absolute right-0 text-muted-foreground">
            <Link to="/admin" aria-label="Admin"><ShieldCheck className="w-4 h-4" /></Link>
          </Button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-12">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground max-w-md whitespace-pre-line">{info}</p>

          {remaining !== null && (
            <p className="text-sm text-muted-foreground">
              {soldOut ? `Alla ${capacity} platser är bokade` : `${remaining} av ${capacity} platser kvar`}
            </p>
          )}

          <Button asChild size="lg" className="h-14 px-10 text-base rounded-full shadow-lg" disabled={soldOut}>
            <Link to="/boka">
              <Ticket className="w-5 h-5 mr-2" />
              {soldOut ? "Fullbokat" : "Boka biljetter"}
            </Link>
          </Button>
        </main>
      </div>
    </div>
  );
};

export default Index;
