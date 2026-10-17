"use client";

import { useEffect, useState } from "react";
import { ChevronRightIcon, FolderIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { addDownloadAction, listFoldersAction, type FolderListing } from "./actions";
import type { ResultView } from "./search-results";

// Choix du dossier de destination : on part du dossier par défaut de la catégorie
// et on peut remonter, descendre dans un sous-dossier ou en créer un nouveau.
export function DownloadDialog({
  result,
  defaultDest,
  onClose,
  onDone,
}: {
  result: ResultView;
  defaultDest: string;
  onClose: () => void;
  onDone: (dest: string) => void;
}) {
  const [current, setCurrent] = useState(defaultDest);
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFoldersAction(current).then((l) => {
      if (cancelled) return;
      // Dossier par défaut disparu : on repart des dossiers racines
      if (l.error && current) setCurrent("");
      else setListing(l);
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  const segments = current.split("/").filter(Boolean);

  async function confirm() {
    setPending(true);
    setError(null);
    const res = await addDownloadAction({
      downloadUrl: result.downloadUrl,
      title: result.title,
      category: result.category,
      dest: current,
      newFolder: newFolder.trim() || undefined,
    });
    setPending(false);
    if (res.ok) onDone(res.dest);
    else setError(res.error);
  }

  return (
    <Modal title="Télécharger dans…" onClose={onClose}>
      <p className="mb-3 line-clamp-2 break-all text-sm text-muted">{result.title}</p>

      <div className="mb-2 flex flex-wrap items-center gap-1 text-sm">
        <button className="text-accent" onClick={() => setCurrent("")}>
          Dossiers
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5 text-muted" />
            <button className={i === segments.length - 1 ? "font-semibold" : "text-accent"} onClick={() => setCurrent(segments.slice(0, i + 1).join("/"))}>
              {seg}
            </button>
          </span>
        ))}
      </div>

      <ul className="mb-3 max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {listing === null ? (
          <li className="px-3 py-3 text-sm text-muted">Chargement…</li>
        ) : listing.folders.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted">Aucun sous-dossier</li>
        ) : (
          listing.folders.map((name) => (
            <li key={name}>
              <button
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
                onClick={() => setCurrent(current ? `${current}/${name}` : name)}
              >
                <FolderIcon className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <ChevronRightIcon className="size-4 text-muted" />
              </button>
            </li>
          ))
        )}
      </ul>

      {current && (
        <input
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          placeholder="Nouveau sous-dossier (facultatif)"
          className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-accent"
        />
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <button className={`${btn.primary} w-full`} disabled={!current || pending} onClick={confirm}>
        {pending
          ? "Envoi à rTorrent…"
          : current
            ? `Télécharger dans ${[segments.at(-1), newFolder.trim()].filter(Boolean).join("/")}`
            : "Choisis un dossier"}
      </button>
    </Modal>
  );
}
