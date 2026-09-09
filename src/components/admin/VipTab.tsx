import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Crown, Loader2, Pencil, Plus, Trash2, Undo2, X, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface VipGuest {
  id: string;
  first_name: string;
  last_name: string;
  note: string | null;
  checked_in: boolean;
}

interface VipTabProps {
  onChange?: () => void;
}

const VipTab = ({ onChange }: VipTabProps) => {
  const [guests, setGuests] = useState<VipGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editNote, setEditNote] = useState("");

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase
      .from("vip_guests")
      .select("id, first_name, last_name, note, checked_in")
      .order("created_at");
    setGuests((data as VipGuest[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGuests();
    if (editingId) return;
    const interval = setInterval(fetchGuests, 10000);
    return () => clearInterval(interval);
  }, [fetchGuests, editingId]);

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!first.trim() || !last.trim()) {
      toast.error("Fyll i för- och efternamn");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("vip_guests").insert({
      first_name: first.trim(),
      last_name: last.trim(),
      note: note.trim() || null,
    });
    if (error) {
      toast.error("Kunde inte lägga till gästen");
    } else {
      toast.success(`${first.trim()} ${last.trim()} tillagd på VIP-listan`);
      setFirst("");
      setLast("");
      setNote("");
      await fetchGuests();
      onChange?.();
    }
    setAdding(false);
  };

  const toggleCheckIn = async (g: VipGuest) => {
    setBusy(g.id);
    await supabase
      .from("vip_guests")
      .update({
        checked_in: !g.checked_in,
        checked_in_at: g.checked_in ? null : new Date().toISOString(),
      })
      .eq("id", g.id);
    toast.success(
      g.checked_in
        ? `${g.first_name} ${g.last_name} – incheckning ångrad`
        : `${g.first_name} ${g.last_name} incheckad`
    );
    await fetchGuests();
    onChange?.();
    setBusy(null);
  };

  const saveEdit = async (g: VipGuest) => {
    if (!editFirst.trim() || !editLast.trim()) {
      toast.error("Fyll i för- och efternamn");
      return;
    }
    setBusy(g.id);
    const { error } = await supabase
      .from("vip_guests")
      .update({
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
        note: editNote.trim() || null,
      })
      .eq("id", g.id);
    if (error) {
      toast.error("Kunde inte spara ändringen");
    } else {
      toast.success("Gästen är uppdaterad");
      setEditingId(null);
      await fetchGuests();
      onChange?.();
    }
    setBusy(null);
  };

  const removeGuest = async (g: VipGuest) => {
    setBusy(g.id);
    await supabase.from("vip_guests").delete().eq("id", g.id);
    toast.success(`${g.first_name} ${g.last_name} borttagen`);
    await fetchGuests();
    onChange?.();
    setBusy(null);
  };

  const arrived = guests.filter((g) => g.checked_in).length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="w-5 h-5" />
          VIP-lista ({arrived}/{guests.length} anlända)
        </CardTitle>
        <form onSubmit={addGuest} className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Förnamn" maxLength={60} value={first} onChange={(e) => setFirst(e.target.value)} />
            <Input placeholder="Efternamn" maxLength={60} value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Input placeholder="Notering (valfritt)" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" disabled={adding}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : guests.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Inga VIP-gäster tillagda.</p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {guests.map((g) =>
              editingId === g.id ? (
                <div key={g.id} className="space-y-2 p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex gap-2">
                    <Input placeholder="Förnamn" maxLength={60} value={editFirst} onChange={(e) => setEditFirst(e.target.value)} />
                    <Input placeholder="Efternamn" maxLength={60} value={editLast} onChange={(e) => setEditLast(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Notering (valfritt)" maxLength={120} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                    <Button size="sm" disabled={busy === g.id} onClick={() => saveEdit(g)}>
                      {busy === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Spara"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} aria-label="Avbryt">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {g.checked_in && <CheckCircle className="w-4 h-4 text-[hsl(var(--success))] shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{g.first_name} {g.last_name}</p>
                      {g.note && <p className="text-xs text-muted-foreground truncate">{g.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant={g.checked_in ? "outline" : "default"}
                      size="sm"
                      disabled={busy === g.id}
                      onClick={() => toggleCheckIn(g)}
                    >
                      {busy === g.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : g.checked_in ? (
                        <Undo2 className="w-4 h-4" />
                      ) : (
                        "Checka in"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === g.id}
                      onClick={() => {
                        setEditingId(g.id);
                        setEditFirst(g.first_name);
                        setEditLast(g.last_name);
                        setEditNote(g.note ?? "");
                      }}
                      aria-label="Redigera gäst"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === g.id}
                      onClick={() => removeGuest(g)}
                      aria-label="Ta bort gäst"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VipTab;
