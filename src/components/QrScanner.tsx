import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QrScannerProps {
  onScan: (data: string) => void | Promise<void>;
}

const QrScanner = ({ onScan }: QrScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const [readerId] = useState(() => `qr-reader-${crypto.randomUUID()}`);
  const startedRef = useRef(false);
  const handlingScanRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);

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
      // ignore
    } finally {
      startedRef.current = false;
      handlingScanRef.current = false;
      setRunning(false);
      setStarting(false);
      try {
        await scanner.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (starting || running) return;

    setErrorMessage(null);
    setStarting(true);

    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          disableFlip: true,
          aspectRatio: 1,
        },
        async (decodedText) => {
          const now = Date.now();
          const last = lastScanRef.current;
          if (handlingScanRef.current) return;
          if (last && last.text === decodedText && now - last.at < 2500) return;

          lastScanRef.current = { text: decodedText, at: now };
          handlingScanRef.current = true;

          try {
            scanner.pause(true);
            await Promise.resolve(onScanRef.current(decodedText));
          } catch (err) {
            console.error("QR callback error:", err);
          } finally {
            handlingScanRef.current = false;
            if (startedRef.current) {
              try {
                scanner.resume();
              } catch (err) {
                console.error("QR resume error:", err);
              }
            }
          }
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
  }, [running, starting, stopScanner, readerId]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      <div id={readerId} className="rounded-lg overflow-hidden min-h-12" />

      {!running && (
        <Button type="button" onClick={() => void startScanner()} disabled={starting} className="w-full">
          {starting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Starta kamera
        </Button>
      )}

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
};

export default QrScanner;
