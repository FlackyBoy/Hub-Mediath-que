"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SearchIcon, TrashIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { GAME_STATUS_LABELS, type GameStatus } from "@/lib/game-labels";
import { deleteGameAction, logPlayAction, quickUpdateGameAction, relinkGameAction, searchBggAction, type BggSearchHit } from "../actions";

export function GameStatusPicker({ id, value }: { id: number; value: GameStatus }) {
  const [status, setStatus] = useState(value);
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1" role="radiogroup" aria-label="Statut">
      {(Object.entries(GAME_STATUS_LABELS) as [GameStatus, string][]).map(([k, label]) => (
        <button key={k} role="radio" aria-checked={status === k}
          onClick={async () => { setStatus(k); await quickUpdateGameAction(id, { status: k }); }}
          className={`rounded-lg px-1 py-2 text-xs font-medium leading-tight ${status === k ? "bg-accent text-accent-foreground" : "text-muted"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function PlayCounter({ id, plays, lastPlayed }: { id: number; plays: number; lastPlayed: string | null }) {
  const [state, setState] = useState({ plays, lastPlayed });
  const [busy, setBusy] = useState(false);
  async function log(delta: 1 | -1) {
    setBusy(true);
    setState(await logPlayAction(id, delta));
    setBusy(false);
  }
  const last = state.lastPlayed
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(state.lastPlayed + "T12:00:00"))
    : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{state.plays === 0 ? "Jamais joué" : `${state.plays} partie${state.plays > 1 ? "s" : ""}`}</p>
        {last && <p className="text-xs text-muted">Dernière le {last}</p>}
      </div>
      {state.plays > 0 && (
        <button aria-label="Retirer une partie" disabled={busy} onClick={() => log(-1)} className="size-10 rounded-xl border border-border text-lg text-muted">−</button>
      )}
      <button disabled={busy} onClick={() => log(1)} className="rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground">+ J&apos;y ai joué</button>
    </div>
  );
}

export function GameRatingPicker({ id, value }: { id: number; value: number | null }) {
  const [rating, setRating] = useState(value);
  async function pick(n: number) {
    const next = rating === n ? null : n;
    setRating(next);
    await quickUpdateGameAction(id, { rating: next });
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Ma note {rating !== null ? `: ${rating}/10` : ""}</p>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Note sur 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} onClick={() => pick(n)}
            className={`rounded-lg py-2 text-sm font-semibold ${rating !== null && n <= rating ? "bg-accent text-accent-foreground" : "bg-accent/10 text-muted"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GameNotes({ id, value }: { id: number; value: string }) {
  const [notes, setNotes] = useState(value);
  const [state, setState] = useState<"" | "…" | "Enregistré">("");
  const last = useRef(value);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium">Mon avis</span>
        <span className="text-xs text-muted">{state}</span>
      </div>
      <textarea value={notes} rows={4} placeholder="Avec qui y jouer, ce qui plaît, ce qui coince…"
        onChange={(e) => { setNotes(e.target.value); setState(""); }}
        onBlur={async () => {
          if (notes === last.current) return;
          setState("…");
          await quickUpdateGameAction(id, { notes });
          last.current = notes;
          setState("Enregistré");
        }}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-accent" />
    </div>
  );
}

// Choix manuel de la fiche BGG (quand la recherche automatique s'est trompée ou n'a rien trouvé)
export function RelinkGame({ id, title, linked }: { id: number; title: string; linked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(title);
  const [hits, setHits] = useState<BggSearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await searchBggAction(query);
    setBusy(false);
    setHits(res.hits);
    setError(res.error ?? null);
  }

  async function choose(bggId: number) {
    setBusy(true);
    const res = await relinkGameAction(id, bggId);
    setBusy(false);
    if (res.error) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-muted underline">{linked ? "Pas le bon jeu ?" : "Choisir la fiche BGG"}</button>
      {open && (
        <Modal title="Fiche BoardGameGeek" onClose={() => setOpen(false)}>
          <form onSubmit={search} className="mb-3 flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-accent" />
            <button aria-label="Rechercher" disabled={busy} className="rounded-xl bg-accent px-3.5 text-accent-foreground"><SearchIcon className="size-5" /></button>
          </form>
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          {busy && <p className="text-sm text-muted">Recherche…</p>}
          {hits && !busy && hits.length === 0 && <p className="text-sm text-muted">Aucun résultat.</p>}
          {hits && hits.length > 0 && (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {hits.map((h) => (
                <li key={h.bggId}>
                  <button disabled={busy || (h.knownId !== null && h.knownId !== id)} onClick={() => choose(h.bggId)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm disabled:opacity-50">
                    <span className="min-w-0 truncate">{h.name}{h.year ? ` (${h.year})` : ""}</span>
                    {h.expansion && <span className="shrink-0 text-xs text-muted">Extension</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}

export function DeleteGame({ id, title }: { id: number; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-medium text-danger">
        <TrashIcon className="size-5" /> Retirer de ma liste
      </button>
      {open && (
        <Modal title="Retirer ce jeu ?" onClose={() => setOpen(false)}>
          <p className="mb-5 text-sm">« {title} » sera retiré, avec ta note, ton avis et tes parties.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.ghost} onClick={() => setOpen(false)}>Annuler</button>
            <button className={btn.danger} onClick={() => deleteGameAction(id)}>Retirer</button>
          </div>
        </Modal>
      )}
    </>
  );
}
