"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startScanAction } from "@/app/(app)/fichiers/actions";
import { RefreshIcon } from "./icons";

// Lance l'analyse du disque et rafraîchit la page tant qu'elle tourne.
export function ScanButton({ running, label = "Analyser" }: { running: boolean; label?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [, startTransition] = useTransition();
  const busy = running || starting;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => startTransition(() => router.refresh()), 2000);
    return () => clearInterval(id);
  }, [running, router]);

  async function start() {
    setStarting(true);
    await startScanAction();
    router.refresh();
    setTimeout(() => setStarting(false), 1500);
  }

  return (
    <button
      onClick={start}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
    >
      <RefreshIcon className={`size-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Analyse en cours…" : label}
    </button>
  );
}
