"use client";

import { useSyncExternalStore } from "react";
import { ShareIcon } from "./icons";

function isIosBrowserNotInstalled(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

const noop = () => () => {};

// Affiché uniquement dans Safari sur iPhone, tant que l'app n'est pas installée.
export function InstallHint() {
  const show = useSyncExternalStore(noop, isIosBrowserNotInstalled, () => false);
  if (!show) return null;

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
      <p className="font-semibold">Installer Hub sur l&apos;iPhone</p>
      <p className="mt-1 text-muted">
        Touche <ShareIcon className="inline size-4 align-text-bottom" /> <b>Partager</b>, puis{" "}
        <b>Sur l&apos;écran d&apos;accueil</b>. Indispensable pour recevoir les notifications.
      </p>
    </div>
  );
}
