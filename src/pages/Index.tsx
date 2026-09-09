import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Ticket } from "lucide-react";
import sagenLogo from "@/assets/sagen-logo.png";

const Index = () => {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_availability");
      const res = data as { remaining?: number } | null;
      if (res && typeof res.remaining === "number") setRemaining(res.remaining);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const soldOut = remaining === 0;

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex flex-col">
      <header className="relative flex items-center justify-center">
        <img src={sagenLogo} alt="Sägen Film" className="h-32 object-contain" />
        <Button variant="ghost" size="sm" asChild className="absolute right-0 text-muted-foreground">
          <Link to="/admin" aria-label="Admin"><ShieldCheck className="w-4 h-4" /></Link>
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight">Sägen Filmkväll 2026</h1>
        <p className="text-muted-foreground max-w-md">
          En kväll med film, popcorn och gott sällskap. Boka dina biljetter – ange namn på alla som kommer.
        </p>

        {remaining !== null && (
          <p className="text-sm text-muted-foreground">
            {soldOut ? "Alla 100 platser är bokade" : `${remaining} av 100 platser kvar`}
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
  );
};

export default Index;
