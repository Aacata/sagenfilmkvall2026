import { useEffect, useRef, useState, useCallback, forwardRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QrScannerProps {
  onScan: (data: string) => void;
}

const QrScanner = forwardRef<HTMLDivElement, QrScannerProps>(({ onScan }, ref) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const readerIdRef = useRef(`qr-reader-${crypto.randomUUID()}`);
  const startedRef = useRef(false);

  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  onScanRef.current = onScan;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (startedRef.current) {
        await scanner.stop();
      }
    } catch {
      // Ignore "Cannot stop, scanner is not running or paused"
    } finally {
      startedRef.current = false;
      setRunning(false);
      setStarting(false);
      try {
        await scanner.clear();
      } catch {
        // ignore clear errors
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (starting || running) return;

    setErrorMessage(null);
    setStarting(true);

    const scanner = new Html5Qrcode(readerIdRef.current);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          onScanRef.current(decodedText);
          await stopScanner();
        },
        () => {}
      );
      startedRef.current = true;
      setRunning(true);
    } catch (err) {
      setErrorMessage("Kunde inte starta kameran. Tryck igen eller kontrollera kamerabehörighet.");
      console.error("QR scanner error:", err);
      await stopScanner();
    } finally {
      setStarting(false);
    }
  }, [running, starting, stopScanner]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div ref={ref} className="w-full max-w-sm mx-auto space-y-3">
      <div id={readerIdRef.current} className="rounded-lg overflow-hidden min-h-12" />

      {!running && (
        <Button type="button" onClick={() => void startScanner()} disabled={starting} className="w-full">
          {starting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Starta kamera
        </Button>
      )}

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
});

QrScanner.displayName = "QrScanner";

export default QrScanner;
