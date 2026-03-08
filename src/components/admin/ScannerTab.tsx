import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QrScanner from "@/components/QrScanner";
import { ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ScannerTabProps {
  onCheckedIn: () => void;
}

const playTone = (frequency: number, duration: number, type: OscillatorType = "sine") => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // Audio not supported
  }
};

const feedbackSuccess = () => {
  playTone(880, 150);
  setTimeout(() => playTone(1320, 200), 120);
  try { navigator.vibrate?.([80, 50, 80]); } catch {}
};

const feedbackError = () => {
  playTone(280, 300, "square");
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
};

const ScannerTab = ({ onCheckedIn }: ScannerTabProps) => {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<null | { success: boolean; message: string }>(null);
  const processingRef = useRef(false);
  const lastProcessedRef = useRef<{ id: string; at: number } | null>(null);

  const handleScan = useCallback(
    async (bookingId: string) => {
      const now = Date.now();
      const lastProcessed = lastProcessedRef.current;

      if (processingRef.current) return;
      if (lastProcessed && lastProcessed.id === bookingId && now - lastProcessed.at < 3500) return;

      processingRef.current = true;
      lastProcessedRef.current = { id: bookingId, at: now };
      setLoading(true);

      try {
        const { data: booking } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .single();

        if (!booking) {
          feedbackError();
          setScanResult({ success: false, message: "Ogiltig bokning – hittades inte." });
          return;
        }

        if (booking.checked_in) {
          feedbackError();
          setScanResult({ success: false, message: "Redan incheckad! Biljetten har redan använts." });
          return;
        }

        await supabase.from("bookings").update({ checked_in: true }).eq("id", bookingId);
        await supabase.from("seats").update({ checked_in: true }).in("id", booking.seat_ids);

        feedbackSuccess();
        setScanResult({
          success: true,
          message: `Välkommen! ${booking.seat_ids.length} plats${booking.seat_ids.length > 1 ? "er" : ""} incheckade.`,
        });
        onCheckedIn();
      } finally {
        setLoading(false);
        processingRef.current = false;
      }
    },
    [onCheckedIn]
  );

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
    </div>
  );
};

export default ScannerTab;
