"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncPlexAction } from "../ecrans/actions";

export function PlexSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const res = await syncPlexAction();
          setBusy(false);
          setMessage("error" in res ? `Échec : ${res.error}` : `${res.items} titres dans Plex, ${res.watched} vus, ${res.inProgress} en cours, ${res.added} ajoutés à ta liste.`);
          router.refresh();
        }}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
      >
        {busy ? "Synchronisation…" : "Synchroniser maintenant"}
      </button>
      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  );
}
