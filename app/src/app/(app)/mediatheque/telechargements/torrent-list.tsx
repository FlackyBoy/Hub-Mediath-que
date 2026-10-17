"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DotsIcon, FolderIcon, TrashIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import type { TorrentState } from "@/lib/rtorrent";
import { filesHref } from "@/lib/media-links";
import { pauseAction, removeAction, resumeAction } from "./actions";

export type TorrentView = {
  hash: string;
  name: string;
  progress: number;
  state: TorrentState;
  stateLabel: string;
  meta: string;
  message: string | null;
  fromHub: boolean;
  canDeleteData: boolean;
  folder: string | null;
};

export function TorrentList({
  torrents,
  emptyText,
  autoRefresh = false,
}: {
  torrents: TorrentView[];
  emptyText: string;
  autoRefresh?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [menu, setMenu] = useState<TorrentView | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ t: TorrentView; withData: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rafraîchit la progression toutes les 5 s tant qu'il y a des téléchargements en cours
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => startTransition(() => router.refresh()), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setMenu(null);
    setConfirmRemove(null);
    setNotice(res.message ?? (res.ok ? null : "Échec"));
    router.refresh();
  }

  if (torrents.length === 0) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{emptyText}</p>;
  }

  return (
    <div>
      {notice && (
        <p role="status" className="mb-2 rounded-xl border border-border bg-surface p-3 text-sm">
          {notice}
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {torrents.map((t) => {
          const pct = Math.floor(t.progress * 1000) / 10;
          return (
            <li key={t.hash} className="flex items-center">
              <div className="min-w-0 flex-1 px-4 py-3">
                <p className="line-clamp-2 break-all text-[15px]">{t.name}</p>
                {t.progress < 1 && (
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={`Progression ${pct} %`}
                    className="my-1.5 h-1.5 overflow-hidden rounded-full bg-accent/15"
                  >
                    <div className="h-full rounded-r-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <p className="truncate text-xs text-muted">
                  <span className={t.state === "error" ? "text-danger" : "text-foreground"}>{t.stateLabel}</span>
                  {t.progress < 1 && ` · ${pct.toLocaleString("fr-FR")} %`} · {t.meta}
                  {t.fromHub && " · Hub"}
                </p>
                {t.message && <p className="truncate text-xs text-danger">{t.message}</p>}
              </div>
              <button aria-label={`Actions pour ${t.name}`} className="self-stretch px-4 text-muted" onClick={() => setMenu(t)}>
                <DotsIcon className="size-5" />
              </button>
            </li>
          );
        })}
      </ul>

      {menu && (
        <Modal title={menu.name} onClose={() => setMenu(null)}>
          <div className="space-y-2">
            {menu.folder && (
              <Link href={filesHref(menu.folder)} className="flex items-center gap-3 rounded-xl px-2 py-3">
                <FolderIcon className="size-5" /> Ouvrir le dossier
              </Link>
            )}
            {menu.state === "paused" || menu.state === "stopped" ? (
              <button className="w-full rounded-xl px-2 py-3 text-left" disabled={busy} onClick={() => run(() => resumeAction(menu.hash))}>
                ▶ Reprendre
              </button>
            ) : (
              <button className="w-full rounded-xl px-2 py-3 text-left" disabled={busy} onClick={() => run(() => pauseAction(menu.hash))}>
                ⏸ Mettre en pause
              </button>
            )}
            <button className="w-full rounded-xl px-2 py-3 text-left" onClick={() => setConfirmRemove({ t: menu, withData: false })}>
              Retirer de rTorrent (garder les fichiers)
            </button>
            {menu.canDeleteData && (
              <button className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-danger" onClick={() => setConfirmRemove({ t: menu, withData: true })}>
                <TrashIcon className="size-5" /> Supprimer le torrent et ses fichiers
              </button>
            )}
          </div>
        </Modal>
      )}

      {confirmRemove && (
        <Modal title={confirmRemove.withData ? "Supprimer le torrent et ses fichiers ?" : "Retirer ce torrent ?"} onClose={() => setConfirmRemove(null)}>
          <p className="mb-2 break-all text-sm">{confirmRemove.t.name}</p>
          <p className={`mb-5 text-sm ${confirmRemove.withData ? "text-danger" : "text-muted"}`}>
            {confirmRemove.withData
              ? "Les fichiers seront supprimés définitivement."
              : "Le partage s'arrête, les fichiers restent sur le disque."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.ghost} onClick={() => setConfirmRemove(null)} disabled={busy}>
              Annuler
            </button>
            <button
              className={confirmRemove.withData ? btn.danger : btn.primary}
              disabled={busy}
              onClick={() => run(() => removeAction(confirmRemove.t.hash, confirmRemove.withData))}
            >
              {busy ? "…" : confirmRemove.withData ? "Supprimer" : "Retirer"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
