"use client";

import { useState } from "react";
import { deleteAction, renameAction, type DeleteResult } from "@/app/(app)/mediatheque/actions";
import { formatBytes as formatBytesClient, type ViewEntry } from "@/lib/media-links";
import { btn, Modal } from "./modal";

export function DeleteDialog({
  entries,
  onClose,
  onDone,
}: {
  entries: ViewEntry[];
  onClose: () => void;
  onDone: (result: DeleteResult) => void;
}) {
  const [pending, setPending] = useState(false);
  const known = entries.reduce((sum, e) => sum + (e.size ?? 0), 0);
  const hasUnknown = entries.some((e) => e.size === null);

  async function confirm() {
    setPending(true);
    try {
      onDone(await deleteAction(entries.map((e) => e.rel)));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={entries.length === 1 ? "Supprimer cet élément ?" : `Supprimer ${entries.length} éléments ?`} onClose={onClose}>
      <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
        {entries.slice(0, 6).map((e) => (
          <li key={e.rel} className="break-all">
            • {e.name}
            {e.kind === "dir" && " (dossier et tout son contenu)"}
          </li>
        ))}
        {entries.length > 6 && <li className="text-muted">et {entries.length - 6} autres</li>}
      </ul>
      {known > 0 && (
        <p className="mb-2 text-sm">
          Espace libéré : <b>{hasUnknown ? "au moins " : ""}{formatBytesClient(known)}</b>
        </p>
      )}
      <p className="mb-5 text-sm text-danger">
        Suppression définitive, impossible à annuler.
        {" Les torrents qui utilisent ces fichiers seront retirés de rTorrent."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className={btn.ghost} onClick={onClose} disabled={pending}>
          Annuler
        </button>
        <button className={btn.danger} onClick={confirm} disabled={pending}>
          {pending ? "Suppression…" : "Supprimer"}
        </button>
      </div>
    </Modal>
  );
}

export function RenameDialog({
  entry,
  onClose,
  onDone,
}: {
  entry: ViewEntry;
  onClose: () => void;
  onDone: (newRel: string) => void;
}) {
  const [name, setName] = useState(entry.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === entry.name) return onClose();
    setPending(true);
    setError(null);
    const result = await renameAction(entry.rel, name);
    setPending(false);
    if (result.ok) onDone(result.rel);
    else setError(result.error);
  }

  return (
    <Modal title="Renommer" onClose={onClose}>
      <form onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onFocus={(e) => {
            // Sélectionne le nom sans l'extension
            const dot = entry.kind === "dir" ? -1 : entry.name.lastIndexOf(".");
            e.currentTarget.setSelectionRange(0, dot > 0 ? dot : entry.name.length);
          }}
          className="mb-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus:border-accent"
        />
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={btn.ghost} onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button type="submit" className={btn.primary} disabled={pending || !name.trim()}>
            {pending ? "…" : "Renommer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function deleteSummary(result: DeleteResult): string {
  const parts: string[] = [];
  if (result.deleted > 0) {
    parts.push(
      `${result.deleted} élément${result.deleted > 1 ? "s" : ""} supprimé${result.deleted > 1 ? "s" : ""}` +
        (result.freed > 0 ? ` (${formatBytesClient(result.freed)} libérés)` : ""),
    );
  }
  if (result.torrents > 0) {
    parts.push(`${result.torrents} torrent${result.torrents > 1 ? "s" : ""} retiré${result.torrents > 1 ? "s" : ""} de rTorrent`);
  }
  if (result.errors.length > 0) parts.push(`Échec : ${result.errors.join(" ; ")}`);
  return parts.join(". ");
}
