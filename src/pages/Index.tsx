import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, ShieldCheck, Ticket } from "lucide-react";
import sagenLogo from "@/assets/sagen-logo.png";

interface EventSettings {
  capacity: number;
  event_title: string | null;
  event_info: string | null;
  event_location: string | null;
  event_time: string | null;
  event_lat: number | null;
  event_lng: number | null;
  poster_url: string | null;
}

const Index = () => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(100);
  const [settings, setSettings] = useState<EventSettings | null>(null);

  useEffect(() => {
    supabase
      .from("event_settings")
      .select("capacity, event_title, event_info, event_location, event_time, event_lat, event_lng, poster_url")
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
  const location = settings?.event_location?.trim();
  const time = settings?.event_time?.trim();
  const lat = settings?.event_lat;
  const lng = settings?.event_lng;
  const destination = lat != null && lng != null ? `${lat},${lng}` : location;
  const directionsUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;

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
          <img src={sagenLogo} alt="Sägen Film" className="h-44 sm:h-56 object-contain" />
          <Button variant="ghost" size="sm" asChild className="absolute right-0 text-muted-foreground">
            <Link to="/admin" aria-label="Admin"><ShieldCheck className="w-4 h-4" /></Link>
          </Button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-12">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl leading-tight">{title}</h1>

          <div className="flex flex-col items-center gap-2 text-lg sm:text-xl text-muted-foreground">
            {location &&
              (directionsUrl ? (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  <MapPin className="w-5 h-5 text-primary" />
                  <span>{location}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span>{location}</span>
                </div>
              ))}
            {time && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <span>{time}</span>
              </div>
            )}
          </div>

          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-4"
            >
              Visa vägbeskrivning
            </a>
          )}

          <p className="text-muted-foreground max-w-md whitespace-pre-line text-base">{info}</p>

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
