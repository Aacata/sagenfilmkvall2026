import { useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (data: string) => void;
}

const QrScanner = ({ onScan }: QrScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const elementId = "qr-reader";
    let stopped = false;

    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScanRef.current(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {}
      )
      .catch((err) => {
        if (!stopped) console.error("QR scanner error:", err);
      });

    return () => {
      stopped = true;
      scanner.getState?.() !== undefined
        ? scanner.stop().catch(() => {})
        : undefined;
    };
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div id="qr-reader" className="rounded-lg overflow-hidden" />
    </div>
  );
};

export default QrScanner;
