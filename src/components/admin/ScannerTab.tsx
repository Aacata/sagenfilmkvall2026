import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QrScanner from "@/components/QrScanner";
import { ScanLine, CheckCircle, XCircle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface ScannerTabProps {
  onCheckedIn: () => void;
}

interface TicketRow {
  id: string;
  first_name: string;
  last_name: string;
  checked_in: boolean;
}

interface BookingResult {
  error?: string;
  booking_number?: string;
  email?: string;
  tickets?: TicketRow[];
}

const getAudioContext = () => {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
};

const ScannerTab = ({ onCheckedIn }: ScannerTabProps) => {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<null | { success: boolean; message: string }>(null);
  const [number, setNumber] = useState("");
  const [lookup, setLookup] = useState<BookingResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const processingRef = useRef(false);
  const lastProcessedRef = useRef<{ id: string; at: number } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const unlockAudio = useCallback(async () => {
    if (!audioContextRef.current) audioContextRef.current = getAudioContext();
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = "sine") => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.28;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
    osc.stop(now + duration / 1000);
  }, []);

  const feedbackSuccess = useCallback(() => {
    playTone(880, 140);
    setTimeout(() => playTone(1320, 180), 110);
    try { navigator.vibrate?.([60, 40, 80]); } catch { /* unsupported */ }
  }, [playTone]);

  const feedbackError = useCallback(() => {
    playTone(280, 260, "square");
    try { navigator.vibrate?.([180]); } catch { /* unsupported */ }
  }, [playTone]);

  const checkIn = useCallback(
    async (ticketId: string) => {
      const { data } = await supabase.rpc("check_in_ticket", { _ticket_id: ticketId });
      const res = data as { error?: string; name?: string; booking_number?: string } | null;
      if (!res || res.error) {
        feedbackError();
        setScanResult({
          success: false,
          message: res?.error === "Redan incheckad"
            ? `Redan incheckad: ${res?.name ?? ""}`
            : res?.error || "Ogiltig biljett",
        });
        return false;
      }
      feedbackSuccess();
      setScanResult({ success: true, message: `Välkommen ${res.name}!` });
      onCheckedIn();
      return true;
    },
    [feedbackError, feedbackSuccess, onCheckedIn]
  );

  const handleScan = useCallback(
    async (ticketId: string) => {
      const now = Date.now();
      const last = lastProcessedRef.current;
      if (processingRef.current) return;
      if (last && last.id === ticketId && now - last.at < 3500) return;

      processingRef.current = true;
      lastProcessedRef.current = { id: ticketId, at: now };
      setLoading(true);
      try {
        await checkIn(ticketId);
      } finally {
        setLoading(false);
        processingRef.current = false;
      }
    },
    [checkIn]
  );

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) return;
    setLookupLoading(true);
    const { data } = await supabase.rpc("find_booking_by_number", { _number: number.trim() });
    const res = data as unknown as BookingResult | null;
    if (!res || res.error) {
      toast.error(res?.error || "Bokningen hittades inte");
      setLookup(null);
    } else {
      setLookup(res);
    }
    setLookupLoading(false);
  };

  const manualCheckIn = async (ticketId: string) => {
    const ok = await checkIn(ticketId);
    if (ok && lookup) {
      setLookup({
        ...lookup,
        tickets: (lookup.tickets || []).map((t) => (t.id === ticketId ? { ...t, checked_in: true } : t)),
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5" />
            QR-scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scanning ? (
            <div className="space-y-3">
              <QrScanner onScan={handleScan} />
              {loading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Verifierar biljett...
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
                Avbryt
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                void unlockAudio();
                setScanning(true);
                setScanResult(null);
              }}
              className="w-full"
            >
              Starta insläpp
            </Button>
          )}
        </CardContent>
      </Card>

      {scanResult && (
        <Card className={scanResult.success ? "border-[hsl(var(--success))]/50" : "border-destructive/50"}>
          <CardContent className="pt-4 flex items-center gap-3">
            {scanResult.success ? (
              <CheckCircle className="w-8 h-8 text-[hsl(var(--success))] shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-destructive shrink-0" />
            )}
            <p className="font-medium">{scanResult.message}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="w-5 h-5" />
            Bokningsnummer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleLookup} className="flex gap-2">
            <Input
              placeholder="T.ex. A1B2C3"
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              maxLength={10}
            />
            <Button type="submit" disabled={lookupLoading}>
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sök"}
            </Button>
          </form>

          {lookup && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{lookup.booking_number} · {lookup.email}</p>
              {(lookup.tickets || []).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-sm">{t.first_name} {t.last_name}</span>
                  {t.checked_in ? (
                    <span className="text-xs text-[hsl(var(--success))] flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Incheckad
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => manualCheckIn(t.id)}>Checka in</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScannerTab;
