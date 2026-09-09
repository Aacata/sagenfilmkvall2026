import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Users, CheckCircle, Undo2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface TicketRow {
  id: string;
  first_name: string;
  last_name: string;
  checked_in: boolean;
  booking_id: string;
  created_at: string;
  bookings: { booking_number: string; email: string } | null;
}

interface BookingsTabProps {
  onChange?: () => void;
}

const BookingsTab = ({ onChange }: BookingsTabProps) => {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "booking" | "email" | "checked_in" | "created_at"; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from("tickets")
      .select("id, first_name, last_name, checked_in, booking_id, created_at, bookings(booking_number, email)")
      .order("created_at");
    setTickets((data as unknown as TicketRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 8000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const toggleCheckIn = async (t: TicketRow) => {
    setBusy(t.id);
    if (t.checked_in) {
      await supabase.from("tickets").update({ checked_in: false, checked_in_at: null }).eq("id", t.id);
      toast.success(`${t.first_name} ${t.last_name} – incheckning ångrad`);
    } else {
      const { data } = await supabase.rpc("check_in_ticket", { _ticket_id: t.id });
      const res = data as { error?: string } | null;
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`${t.first_name} ${t.last_name} incheckad`);
      }
    }
    await fetchTickets();
    onChange?.();
    setBusy(null);
  };

  const removeTicket = async (t: TicketRow) => {
    setBusy(t.id);
    await supabase.from("tickets").delete().eq("id", t.id);
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", t.booking_id);
    if (!count) {
      await supabase.from("bookings").delete().eq("id", t.booking_id);
    }
    toast.success(`${t.first_name} ${t.last_name} – bokning borttagen`);
    await fetchTickets();
    onChange?.();
    setBusy(null);
  };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? tickets.filter((t) =>
        `${t.first_name} ${t.last_name} ${t.bookings?.booking_number ?? ""} ${t.bookings?.email ?? ""}`
          .toLowerCase()
          .includes(query)
      )
    : tickets;

  const arrived = tickets.filter((t) => t.checked_in).length;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" />
          Gästlista ({arrived}/{tickets.length} anlända)
        </CardTitle>
        <Input
          placeholder="Sök namn, bokningsnummer eller e-post"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Inga bokningar.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {t.checked_in && <CheckCircle className="w-4 h-4 text-[hsl(var(--success))] shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.first_name} {t.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.bookings?.booking_number} · {t.bookings?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant={t.checked_in ? "outline" : "default"}
                    size="sm"
                    disabled={busy === t.id}
                    onClick={() => toggleCheckIn(t)}
                  >
                    {busy === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : t.checked_in ? (
                      <Undo2 className="w-4 h-4" />
                    ) : (
                      "Checka in"
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy === t.id}
                    onClick={() => removeTicket(t)}
                    aria-label="Ta bort bokning"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingsTab;
