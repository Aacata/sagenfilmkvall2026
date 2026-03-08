import { useState, useCallback, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QrScanner from "@/components/QrScanner";
import { ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ScannerTabProps {
  onCheckedIn: () => void;
}

const ScannerTab = forwardRef<HTMLDivElement, ScannerTabProps>(({ onCheckedIn }, ref) => {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<null | { success: boolean; message: string }>(null);

  const handleScan = useCallback(
    async (bookingId: string) => {
      setScanning(false);
      setLoading(true);

      const { data: booking } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (!booking) {
        setScanResult({ success: false, message: "Ogiltig bokning – hittades inte." });
        setLoading(false);
        return;
      }

      if (booking.checked_in) {
        setScanResult({ success: false, message: "Redan incheckad! Biljetten har redan använts." });
        setLoading(false);
        return;
      }

      await supabase.from("bookings").update({ checked_in: true }).eq("id", bookingId);
      await supabase.from("seats").update({ checked_in: true }).in("id", booking.seat_ids);

      setScanResult({
        success: true,
        message: `Välkommen! ${booking.seat_ids.length} plats${booking.seat_ids.length > 1 ? "er" : ""} incheckade.`,
      });
      setLoading(false);
      onCheckedIn();
    },
    [onCheckedIn]
  );

  return (
    <div ref={ref} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5" />
            QR-scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : scanning ? (
            <div className="space-y-3">
              <QrScanner onScan={handleScan} />
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
});

ScannerTab.displayName = "ScannerTab";

export default ScannerTab;
