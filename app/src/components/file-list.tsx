"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { filesHref, formatBytes, previewHref, rawHref, type ViewEntry } from "@/lib/media-links";
import { deleteSummary, DeleteDialog, RenameDialog } from "./file-dialogs";
import { DotsIcon, DownloadIcon, PencilIcon, TrashIcon } from "./icons";
import { KindIcon } from "./kind-icon";
import { Modal } from "./modal";

export function FileList({
  entries,
  emptyText = "Dossier vide",
  canEdit = true,
}: {
  entries: ViewEntry[];
  emptyText?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<ViewEntry | null>(null);
  const [renaming, setRenaming] = useState<ViewEntry | null>(null);
  const [toDelete, setToDelete] = useState<ViewEntry[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedEntries = entries.filter((e) => selected.has(e.rel));
  const selectedSize = selectedEntries.reduce((sum, e) => sum + (e.size ?? 0), 0);

  function toggle(rel: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  if (entries.length === 0) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{emptyText}</p>;
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-2 flex min-h-9 items-center justify-between gap-2 text-sm">
          {selecting ? (
            <>
              <button
                className="font-medium text-accent"
                onClick={() =>
                  setSelected(selected.size === entries.length ? new Set() : new Set(entries.map((e) => e.rel)))
                }
              >
                {selected.size === entries.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
              <button className="font-medium text-accent" onClick={stopSelecting}>
                Terminé
              </button>
            </>
          ) : (
            <>
              <span className="text-muted">
                {entries.length} élément{entries.length > 1 ? "s" : ""}
              </span>
              <button className="font-medium text-accent" onClick={() => setSelecting(true)}>
                Sélectionner
              </button>
            </>
          )}
        </div>
      )}

      {notice && (
        <p role="status" className="mb-2 rounded-xl border border-border bg-surface p-3 text-sm">
          {notice}
        </p>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {entries.map((entry) => {
          const isSelected = selected.has(entry.rel);
          const content = (
            <>
              {selecting && (
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected ? "border-accent bg-accent" : "border-border"
                  }`}
                >
                  {isSelected && <span className="size-2 rounded-full bg-accent-foreground" />}
                </span>
              )}
              <KindIcon
                kind={entry.kind}
                className={`size-6 shrink-0 ${entry.kind === "dir" ? "text-accent" : "text-muted"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-all text-[15px]">{entry.name}</span>
                <span className="block truncate text-xs text-muted">
                  {entry.subtitle ?? [entry.sizeLabel, entry.dateLabel].filter(Boolean).join(" · ")}
                </span>
              </span>
            </>
          );
          return (
            <li key={entry.rel} className="flex items-center">
              {selecting ? (
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                  onClick={() => toggle(entry.rel)}
                  aria-pressed={isSelected}
                >
                  {content}
                </button>
              ) : (
                <Link
                  href={entry.kind === "dir" ? filesHref(entry.rel) : previewHref(entry.rel)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-background"
                >
                  {content}
                </Link>
              )}
              {canEdit && !selecting && (
                <button
                  aria-label={`Actions pour ${entry.name}`}
                  className="self-stretch px-4 text-muted"
                  onClick={() => setMenu(entry)}
                >
                  <DotsIcon className="size-5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {selecting && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 px-4">
          <button
            className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-2xl bg-danger py-3.5 font-semibold text-white shadow-lg"
            onClick={() => setToDelete(selectedEntries)}
          >
            <TrashIcon className="size-5" />
            Supprimer {selected.size} élément{selected.size > 1 ? "s" : ""}
            {selectedSize > 0 && ` · ${formatBytes(selectedSize)}`}
          </button>
        </div>
      )}

      {menu && (
        <Modal title={menu.name} onClose={() => setMenu(null)}>
          <div className="space-y-2">
            {menu.kind !== "dir" && (
              <a href={rawHref(menu.rel, true)} className="flex items-center gap-3 rounded-xl px-2 py-3" onClick={() => setMenu(null)}>
                <DownloadIcon className="size-5" /> Télécharger
              </a>
            )}
            <button
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3"
              onClick={() => {
                setRenaming(menu);
                setMenu(null);
              }}
            >
              <PencilIcon className="size-5" /> Renommer
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-danger"
              onClick={() => {
                setToDelete([menu]);
                setMenu(null);
              }}
            >
              <TrashIcon className="size-5" /> Supprimer
            </button>
          </div>
        </Modal>
      )}

      {renaming && (
        <RenameDialog
          entry={renaming}
          onClose={() => setRenaming(null)}
          onDone={() => {
            setRenaming(null);
            router.refresh();
          }}
        />
      )}

      {toDelete && (
        <DeleteDialog
          entries={toDelete}
          onClose={() => setToDelete(null)}
          onDone={(result) => {
            setToDelete(null);
            stopSelecting();
            setNotice(deleteSummary(result));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
