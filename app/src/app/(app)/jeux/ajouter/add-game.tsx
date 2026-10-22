"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { GAME_STATUS_LABELS, type GameStatus } from "@/lib/game-labels";
import { addGameAction, searchBggAction, type BggSearchHit } from "../actions";

const STATUSES: GameStatus[] = ["possede", "envie"];

export function AddGame({ bgg }: { bgg: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BggSearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Jeu choisi dans les résultats, ou saisi à la main (bggId null)
  const [chosen, setChosen] = useState<{ title: string; bggId: number | null } | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (!bgg) return setChosen({ title: query.trim(), bggId: null });
    setBusy(true);
    const res = await searchBggAction(query);
    setBusy(false);
    setHits(res.hits);
    setError(res.error ?? null);
  }

  async function add(status: GameStatus) {
    if (!chosen) return;
    setBusy(true);
    // Redirige vers la fiche en cas de succès
    const res = await addGameAction({ title: chosen.title, bggId: chosen.bggId, status });
    setBusy(false);
    setChosen(null);
    setError(res.error);
    setDuplicateId(res.duplicateId ?? null);
  }

  return (
    <div>
      <form onSubmit={search} className="mb-3 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom du jeu" autoFocus enterKeyHint={bgg ? "search" : "done"}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent" />
        <button aria-label={bgg ? "Rechercher" : "Ajouter"} className="rounded-xl bg-accent px-3.5 text-accent-foreground" disabled={busy}>
          {bgg ? <SearchIcon className="size-5" /> : "OK"}
        </button>
      </form>
      {!bgg && <p className="mb-3 text-sm text-muted">BoardGameGeek n&apos;est pas configuré : le jeu sera ajouté sans image ni infos pour l&apos;instant.</p>}
      {error && (
        <p className="mb-3 text-sm text-danger">
          {error}
          {duplicateId && <> · <Link href={`/jeux/${duplicateId}`} className="underline">voir la fiche</Link></>}
        </p>
      )}
      {busy && !chosen && <p className="text-sm text-muted">Recherche…</p>}
      {hits && !busy && hits.length === 0 && <p className="text-sm text-muted">Aucun résultat sur BoardGameGeek.</p>}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {hits.map((h) => (
            <li key={h.bggId}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => (h.knownId ? router.push(`/jeux/${h.knownId}`) : setChosen({ title: h.name, bggId: h.bggId }))}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="block text-sm text-muted">{[h.year, h.expansion ? "Extension" : null].filter(Boolean).join(" · ") || " "}</span>
                </span>
                {h.knownId && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Déjà dans ta liste</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hits && bgg && (
        <button className="mt-3 w-full text-center text-sm text-accent" onClick={() => query.trim() && setChosen({ title: query.trim(), bggId: null })}>
          Pas dans la liste ? Ajouter « {query.trim()} » sans fiche BGG
        </button>
      )}
      {chosen && (
        <Modal title={chosen.title} onClose={() => setChosen(null)}>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-muted">Nom affiché</span>
            <input value={chosen.title} onChange={(e) => setChosen({ ...chosen, title: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button key={s} className={s === "possede" ? btn.primary : btn.ghost} disabled={busy || !chosen.title.trim()} onClick={() => add(s)}>{GAME_STATUS_LABELS[s]}</button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
