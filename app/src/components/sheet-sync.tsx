"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSheetUrlAction, syncSheetAction } from "@/app/(app)/sheet-actions";
import { formatRelative } from "@/lib/format";
import type { SheetStatus } from "@/lib/sheet-sync";
import { btn } from "./modal";

// Google Sheet relié (livres ou jeux) : lien enregistré une fois, puis synchronisation d'un bouton
export function SheetSync({ target, status, noun }: { target: "books" | "games"; status: SheetStatus; noun: [string, string] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!status.url);
  const [url, setUrl] = useState(status.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [one, many] = noun;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveSheetUrlAction(target, url);
    setBusy(false);
    if (res.error) return setError(res.error);
    setError(null);
    setEditing(false);
    await sync();
  }

  async function sync() {
    setBusy(true);
    const res = await syncSheetAction(target);
    setBusy(false);
    setError("error" in res ? res.error : null);
    router.refresh();
  }

  const last = status.last;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
      <h2 className="mb-1 font-semibold">Google Sheet</h2>
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <p className="text-muted">
            Colle le lien de ton Sheet. Il doit être partagé en lecture : Partager &gt; « Tous les utilisateurs disposant du lien » &gt; Lecteur.
          </p>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" inputMode="url"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent" />
          <div className="flex gap-2">
            <button className={`${btn.primary} flex-1`} disabled={busy || !url.trim()}>{busy ? "Synchronisation…" : "Enregistrer et synchroniser"}</button>
            {status.url && <button type="button" className={btn.ghost} onClick={() => setEditing(false)}>Annuler</button>}
          </div>
        </form>
      ) : (
        <>
          <p className="mb-3 text-muted">
            Les {many} ajoutés ou modifiés dans le Sheet arrivent ici. Une ligne supprimée du Sheet reste dans le Hub, et une cellule vide
            n&apos;efface rien.
          </p>
          <button className={`${btn.primary} w-full`} disabled={busy} onClick={sync}>{busy ? "Synchronisation…" : "Synchroniser maintenant"}</button>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              {last && "error" in last && <span className="text-danger">Échec {formatRelative(last.at)} : {last.error}</span>}
              {last && !("error" in last) &&
                `Dernière synchro ${formatRelative(last.at)} : ${last.created} ${last.created > 1 ? many : one} ajouté${last.created > 1 ? "s" : ""}, ${last.updated} mis à jour`}
            </span>
            <button className="shrink-0 underline" onClick={() => setEditing(true)}>Changer de lien</button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-danger">{error}</p>}
    </section>
  );
}
