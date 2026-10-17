"use client";

import { useEffect, useRef, useState } from "react";

// Lecture du code-barres ISBN (EAN-13 commençant par 978/979) avec la caméra arrière.
// Bibliothèque zxing chargée seulement à l'ouverture du scanner.
export function IsbnScanner({ onIsbn }: { onIsbn: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current!,
          (result) => {
            const text = result?.getText();
            if (text && /^97[89]\d{10}$/.test(text) && !done.current) {
              done.current = true;
              controls.stop();
              navigator.vibrate?.(80);
              onIsbn(text);
            }
          },
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "Accès à la caméra refusé. Autorise-le dans Réglages iPhone > Safari > Caméra, ou saisis l'ISBN."
            : "Caméra indisponible. Saisis l'ISBN à la main.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onIsbn]);

  if (error) return <p className="rounded-xl border border-border p-4 text-sm text-muted">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
      <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/90">Vise le code-barres au dos du livre</p>
    </div>
  );
}
