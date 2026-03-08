import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QrScanner from "@/components/QrScanner";
import { ShieldCheck, ScanLine, CheckCircle, XCircle, LogOut, Loader2 } from "lucide-react";

const ADMIN_PASSWORD = "admin123";

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [scanResult, setScanResult] = useState<null | { success: boolean; message: string }>(null);
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState({ available: 0, booked: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    const { data } = await supabase.from("seats").select("is_booked, checked_in");
    if (!data) return;
    setStats({
      available: data.filter((s) => !s.is_booked).length,
      booked: data.filter((s) => s.is_booked).length,
      checkedIn: data.filter((s) => s.checked_in).length,
    });
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchStats();
  }, [isLoggedIn, fetchStats]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) setIsLoggedIn(true);
  };

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
      fetchStats();
    },
    [fetchStats]
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Admin-inloggning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <Input
                type="password"
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit">Logga in</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Admin
          </h1>
          <Button variant="ghost" size="sm" onClick={() => setIsLoggedIn(false)}>
            <LogOut className="w-4 h-4 mr-1" /> Logga ut
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{stats.available}</p><p className="text-xs text-muted-foreground">Lediga</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{stats.booked}</p><p className="text-xs text-muted-foreground">Bokade</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-[hsl(var(--success))]">{stats.checkedIn}</p><p className="text-xs text-muted-foreground">Incheckade</p></CardContent></Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScanLine className="w-5 h-5" />
              QR-scanner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : scanning ? (
              <QrScanner onScan={handleScan} />
            ) : (
              <Button onClick={() => { setScanning(true); setScanResult(null); }} className="w-full">
                Starta scanner
              </Button>
            )}
          </CardContent>
        </Card>

        {scanResult && (
          <Card className={scanResult.success ? "border-[hsl(var(--success))]/50" : "border-destructive/50"}>
            <CardContent className="pt-4 flex items-center gap-3">
              {scanResult.success ? (
                <CheckCircle className="w-8 h-8 text-[hsl(var(--success))]" />
              ) : (
                <XCircle className="w-8 h-8 text-destructive" />
              )}
              <p className="font-medium">{scanResult.message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Admin;
