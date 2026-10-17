"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { formatBytes } from "@/lib/media-links";
import { createBackupAction } from "./actions";

export type BackupRow = { name: string; size: number; label: string };

export function Backups({ backups, error }: { backups: BackupRow[]; error: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Chaque nuit vers 4 h : ta base (livres, films, notes, avis, conversations) et les couvertures. Les 10 dernières sont
        gardées sur le serveur ; télécharges-en une de temps en temps pour avoir une copie ailleurs.
      </p>
      {error && <p className="text-sm text-danger">Dernier échec : {error}</p>}
      {backups.length === 0 ? (
        <p className="text-sm text-muted">Aucune sauvegarde pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {backups.map((b) => (
            <li key={b.name} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block">{b.label}</span>
                <span className="block text-xs text-muted">{formatBytes(b.size)}</span>
              </span>
              <a href={`/api/backups/${b.name}`} aria-label={`Télécharger la sauvegarde du ${b.label}`} className="rounded-lg border border-border p-2 text-accent">
                <DownloadIcon className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const res = await createBackupAction();
          setBusy(false);
          setMessage("error" in res ? `Échec : ${res.error}` : `Sauvegarde créée (${formatBytes(res.size)}).`);
          router.refresh();
        }}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
      >
        {busy ? "Sauvegarde…" : "Sauvegarder maintenant"}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
