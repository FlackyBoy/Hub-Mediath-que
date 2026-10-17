"use client";

import { useEffect, useState } from "react";
import { sendTestPush, subscribePush, unsubscribePush } from "./actions";

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function detectStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? "on" : "off";
}

const buttonClass = "rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60";

export function PushManager({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    detectStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await subscribePush(sub.toJSON());
      setStatus("on");
    } catch (error) {
      setMessage(`Échec de l'activation : ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const result = await sendTestPush();
    setMessage(result.error ?? (result.sent > 0 ? "Notification envoyée." : "Aucun appareil abonné."));
    setBusy(false);
  }

  if (!publicKey) {
    return <p className="text-sm text-muted">Non configurées : VAPID_PUBLIC_KEY manquant dans le .env.</p>;
  }
  if (status === "loading") return <p className="text-sm text-muted">Vérification…</p>;
  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted">
        Non disponibles ici. Sur iPhone, installe d&apos;abord l&apos;app sur l&apos;écran d&apos;accueil, puis ouvre-la
        depuis son icône.
      </p>
    );
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-muted">
        Bloquées. Réactive-les dans Réglages iPhone &gt; Notifications &gt; Hub.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {status === "on" ? "Activées sur cet appareil." : "Désactivées sur cet appareil."}
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "on" ? (
          <>
            <button onClick={test} disabled={busy} className={`${buttonClass} bg-accent text-accent-foreground`}>
              Envoyer un test
            </button>
            <button onClick={disable} disabled={busy} className={`${buttonClass} border border-border`}>
              Désactiver
            </button>
          </>
        ) : (
          <button onClick={enable} disabled={busy} className={`${buttonClass} bg-accent text-accent-foreground`}>
            Activer les notifications
          </button>
        )}
      </div>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
