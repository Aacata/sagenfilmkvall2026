import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QrScanner from "@/components/QrScanner";
import { initialSeats, type Seat } from "@/data/seatLayout";
import { ShieldCheck, ScanLine, CheckCircle, XCircle, LogOut } from "lucide-react";

const ADMIN_PASSWORD = "admin123";

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [scanResult, setScanResult] = useState<null | { success: boolean; message: string }>(null);
  const [scanning, setScanning] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
    }
  };

  const handleScan = useCallback(
    (bookingId: string) => {
      setScanning(false);
      const bookedSeats = seats.filter((s) => s.bookingId === bookingId);

      if (bookedSeats.length === 0) {
        setScanResult({ success: false, message: "Ogiltig bokning – hittades inte." });
        return;
      }

      if (bookedSeats.some((s) => s.checkedIn)) {
        setScanResult({ success: false, message: "Redan incheckad! Biljetten har redan använts." });
        return;
      }

      setSeats((prev) =>
        prev.map((s) => (s.bookingId === bookingId ? { ...s, checkedIn: true } : s))
      );
      setScanResult({
        success: true,
        message: `Välkommen! ${bookedSeats.length} plats${bookedSeats.length > 1 ? "er" : ""} incheckade.`,
      });
    },
    [seats]
  );

  const booked = seats.filter((s) => s.isBooked).length;
  const checkedIn = seats.filter((s) => s.checkedIn).length;
  const available = seats.filter((s) => !s.isBooked).length;

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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{available}</p>
              <p className="text-xs text-muted-foreground">Lediga</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{booked}</p>
              <p className="text-xs text-muted-foreground">Bokade</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-[hsl(var(--success))]">{checkedIn}</p>
              <p className="text-xs text-muted-foreground">Incheckade</p>
            </CardContent>
          </Card>
        </div>

        {/* Scanner */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScanLine className="w-5 h-5" />
              QR-scanner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scanning ? (
              <QrScanner onScan={handleScan} />
            ) : (
              <Button onClick={() => { setScanning(true); setScanResult(null); }} className="w-full">
                Starta scanner
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Scan result */}
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
