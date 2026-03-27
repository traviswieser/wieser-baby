// ─── Camera Barcode Scanner Component ─────────────────────────
// Uses @zxing/library to decode barcodes from the device camera.
// Falls back gracefully if camera permission is denied.

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

export default function BarcodeScanner({ onDetected, onClose, theme }) {
  const videoRef    = useRef(null);
  const readerRef   = useRef(null);
  const [error, setError]     = useState(null);
  const [status, setStatus]   = useState("Starting camera…");
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    (async () => {
      try {
        // Request camera — prefer the back/environment camera on phones
        const constraints = { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("Point camera at barcode");
        }

        // Decode continuously from the video stream
        reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (result) {
            const code = result.getText();
            stopCamera();
            onDetected(code);
          }
          // NotFoundException fires every frame when no barcode is visible — ignore it
          if (err && !(err instanceof NotFoundException)) {
            console.warn("Barcode decode error:", err);
          }
        });
      } catch (err) {
        if (err.name === "NotAllowedError") {
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Could not start camera: " + err.message);
        }
      }
    })();

    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (readerRef.current) { try { readerRef.current.reset(); } catch {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(t => !t);
    } catch {
      // Torch not supported on this device — silently ignore
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "rgba(0,0,0,0.8)" }}>
        <button onClick={() => { stopCamera(); onClose(); }} style={{ background: "none", border: "none", color: "#fff", fontSize: 28, cursor: "pointer", lineHeight: 1 }}>✕</button>
        <span style={{ color: "#fff", fontFamily: "'Fredoka'", fontSize: 18, fontWeight: 600 }}>Scan Barcode</span>
        <button onClick={toggleTorch} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", opacity: torchOn ? 1 : 0.5 }} title="Toggle flashlight">🔦</button>
      </div>

      {/* Camera view */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline muted />

        {/* Scanning overlay — crosshair box */}
        {!error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: 260, height: 160, position: "relative" }}>
              {/* Corner marks */}
              {[["0%","0%","borderTop","borderLeft"],["0%","100%","borderTop","borderRight"],["100%","0%","borderBottom","borderLeft"],["100%","100%","borderBottom","borderRight"]].map(([t,l,b1,b2],i) => (
                <div key={i} style={{ position: "absolute", top: t, left: l, width: 28, height: 28, [b1]: "3px solid " + theme.accent, [b2]: "3px solid " + theme.accent, transform: i === 0 ? "none" : i === 1 ? "translateX(-100%)" : i === 2 ? "translateY(-100%)" : "translate(-100%,-100%)" }} />
              ))}
              {/* Scanning line animation */}
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: theme.accent, opacity: 0.8, animation: "scanline 1.8s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {/* Status / error overlay */}
        <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", padding: "0 20px" }}>
          {error
            ? <div style={{ background: "rgba(0,0,0,0.85)", color: "#ff6b6b", padding: "14px 20px", borderRadius: 12, fontFamily: "'Nunito'", fontSize: 15 }}>{error}</div>
            : <div style={{ background: "rgba(0,0,0,0.65)", color: "#fff", padding: "10px 20px", borderRadius: 20, fontFamily: "'Nunito'", fontSize: 14, display: "inline-block" }}>{status}</div>
          }
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 10%; }
          50%  { top: 88%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
