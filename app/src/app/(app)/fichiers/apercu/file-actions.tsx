"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSummary, DeleteDialog, RenameDialog } from "@/components/file-dialogs";
import { DownloadIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { filesHref, previewHref, rawHref, type ViewEntry } from "@/lib/media-links";

export function FileActions({ entry, parentRel }: { entry: ViewEntry; parentRel: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cls = "flex flex-1 flex-col items-center gap-1 rounded-2xl border border-border bg-surface py-3 text-sm font-medium";

  return (
    <>
      <div className="flex gap-2">
        <a href={rawHref(entry.rel, true)} className={cls}>
          <DownloadIcon className="size-5" /> Télécharger
        </a>
        <button className={cls} onClick={() => setRenaming(true)}>
          <PencilIcon className="size-5" /> Renommer
        </button>
        <button className={`${cls} text-danger`} onClick={() => setDeleting(true)}>
          <TrashIcon className="size-5" /> Supprimer
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {renaming && (
        <RenameDialog
          entry={entry}
          onClose={() => setRenaming(false)}
          onDone={(newRel) => router.replace(previewHref(newRel))}
        />
      )}
      {deleting && (
        <DeleteDialog
          entries={[entry]}
          onClose={() => setDeleting(false)}
          onDone={(result) => {
            setDeleting(false);
            if (result.deleted > 0) router.replace(filesHref(parentRel));
            else setError(deleteSummary(result));
          }}
        />
      )}
    </>
  );
}
