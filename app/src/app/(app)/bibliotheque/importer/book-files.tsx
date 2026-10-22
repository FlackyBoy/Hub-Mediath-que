"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "@/components/modal";
import type { BookFile, ScanResult } from "@/lib/book-files";
import { formatRelative } from "@/lib/format";
import { addBookFilesAction, ignoreBookFilesAction, saveBookDirsAction, scanBookFilesAction } from "../actions";

type Row = { rel: string; title: string; author: string; ext: string; checked: boolean };

// Dossiers de livres numériques sur le serveur et fichiers pas encore dans la bibliothèque
export function BookFiles({ dirs, last, files }: { dirs: string[]; last: ScanResult | null; files: BookFile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(dirs.length === 0);
  const [dirsText, setDirsText] = useState(dirs.join("\n"));
  const [busy, setBusy] = useState<"" | "dirs" | "scan" | "add" | "ignore">("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // La page remonte le composant (key) quand la liste des fichiers change côté serveur
  const [rows, setRows] = useState<Row[]>(files.map((f) => ({ rel: f.rel, title: f.title, author: f.author, ext: f.ext, checked: true })));

  async function saveDirs(e: React.FormEvent) {
    e.preventDefault();
    setBusy("dirs");
    const res = await saveBookDirsAction(dirsText);
    setBusy("");
    if (res.error) return setError(res.error);
    setError(null);
    setEditing(false);
    await scan();
  }

  async function scan() {
    setBusy("scan");
    const res = await scanBookFilesAction();
    setBusy("");
    if ("error" in res) return setError(res.error);
    setError(null);
    setMessage(`${res.scanned} fichier${res.scanned > 1 ? "s" : ""} parcouru${res.scanned > 1 ? "s" : ""} · ${res.added} nouveau${res.added > 1 ? "x" : ""}`);
    router.refresh();
  }

  const selected = rows.filter((r) => r.checked);
  async function addSelected() {
    setBusy("add");
    const res = await addBookFilesAction(selected.map(({ rel, title, author }) => ({ rel, title, author })));
    setBusy("");
    setMessage(`${res.added} livre${res.added > 1 ? "s" : ""} ajouté${res.added > 1 ? "s" : ""} à la bibliothèque (statut « À lire »)`);
    setError(res.errors.length ? res.errors.slice(0, 3).join(" ; ") : null);
    router.refresh();
  }

  async function ignoreSelected() {
    setBusy("ignore");
    await ignoreBookFilesAction(selected.map((r) => r.rel));
    setBusy("");
    router.refresh();
  }

  const update = (rel: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.rel === rel ? { ...r, ...patch } : r)));

  return (
    <section id="fichiers" className="rounded-2xl border border-border bg-surface p-4 text-sm">
      <h2 className="mb-1 font-semibold">Livres sur le serveur</h2>
      {editing ? (
        <form onSubmit={saveDirs} className="space-y-2">
          <p className="text-muted">
            Dossiers où tu ranges tes livres numériques (epub, pdf, cbz…), un par ligne, depuis la racine de l&apos;explorateur. Exemple :
            download/livre
          </p>
          <textarea value={dirsText} onChange={(e) => setDirsText(e.target.value)} rows={3} placeholder="download/livre"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent" />
          <div className="flex gap-2">
            <button className={`${btn.primary} flex-1`} disabled={busy !== "" || !dirsText.trim()}>{busy ? "Analyse…" : "Enregistrer et analyser"}</button>
            {dirs.length > 0 && <button type="button" className={btn.ghost} onClick={() => setEditing(false)}>Annuler</button>}
          </div>
        </form>
      ) : (
        <>
          <p className="mb-3 text-muted">
            Analyse automatique toutes les 6 heures de {dirs.join(", ")}.{" "}
            <button className="underline" onClick={() => setEditing(true)}>Modifier</button>
          </p>
          <button className={`${btn.ghost} w-full`} disabled={busy !== ""} onClick={scan}>{busy === "scan" ? "Analyse…" : "Chercher de nouveaux livres"}</button>
          <p className="mt-2 text-xs text-muted">
            {message ?? (last ? `Dernière analyse ${formatRelative(last.at)} : ${last.scanned} fichiers` : "Pas encore analysé")}
          </p>
        </>
      )}
      {error && <p className="mt-2 text-danger">{error}</p>}

      {rows.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">{rows.length} nouveau{rows.length > 1 ? "x" : ""} fichier{rows.length > 1 ? "s" : ""}</p>
            <button className="text-xs text-accent" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: selected.length < rs.length })))}>
              {selected.length < rows.length ? "Tout cocher" : "Tout décocher"}
            </button>
          </div>
          <p className="mb-2 text-xs text-muted">Titre et auteur sont devinés depuis le fichier : corrige-les si besoin avant d&apos;ajouter.</p>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.rel} className={`rounded-xl border border-border p-2.5 ${r.checked ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={r.checked} onChange={(e) => update(r.rel, { checked: e.target.checked })} className="mt-2.5 size-4 accent-accent" aria-label="Sélectionner" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <input value={r.title} onChange={(e) => update(r.rel, { title: e.target.value })} aria-label="Titre"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[15px] font-medium outline-none focus:border-accent" />
                    <input value={r.author} onChange={(e) => update(r.rel, { author: e.target.value })} placeholder="Auteur" aria-label="Auteur"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-accent" />
                    <Link href={`/fichiers/apercu?p=${encodeURIComponent(r.rel)}`} className="block truncate text-xs text-muted underline">
                      {r.ext.toUpperCase()} · {r.rel}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className={btn.ghost} disabled={busy !== "" || !selected.length} onClick={ignoreSelected}>Ignorer ({selected.length})</button>
            <button className={btn.primary} disabled={busy !== "" || !selected.length || selected.some((r) => !r.title.trim())} onClick={addSelected}>
              {busy === "add" ? "Ajout…" : `Ajouter (${selected.length})`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
