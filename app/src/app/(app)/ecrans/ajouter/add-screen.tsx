"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { MEDIA_LABELS, posterUrl, SCREEN_STATUS_LABELS, type ScreenStatus } from "@/lib/screen-labels";
import { searchTmdbAction, swipeAction, type SearchHit } from "../actions";

export function AddScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<SearchHit | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const res = await searchTmdbAction(query);
    setBusy(false);
    setHits(res.hits);
    setError(res.error ?? null);
  }

  async function add(status: ScreenStatus) {
    if (!chosen) return;
    setBusy(true);
    const res = await swipeAction(chosen.mediaType, chosen.tmdbId, status);
    setBusy(false);
    if (res.ok) router.push(`/ecrans/${res.id}`);
    else setError(res.error);
  }

  return (
    <div>
      <form onSubmit={search} className="mb-3 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titre d'un film ou d'une série" autoFocus enterKeyHint="search"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent" />
        <button aria-label="Rechercher" className="rounded-xl bg-accent px-3.5 text-accent-foreground" disabled={busy}><SearchIcon className="size-5" /></button>
      </form>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {busy && !chosen && <p className="text-sm text-muted">Recherche…</p>}
      {hits && !busy && hits.length === 0 && <p className="text-sm text-muted">Aucun résultat.</p>}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {hits.map((h) => (
            <li key={`${h.mediaType}-${h.tmdbId}`}>
              <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => (h.knownId ? router.push(`/ecrans/${h.knownId}`) : setChosen(h))}>
                {posterUrl(h.posterPath, "w185") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl(h.posterPath, "w185")!} alt="" loading="lazy" className="aspect-[2/3] w-10 rounded object-cover" />
                ) : <span className="aspect-[2/3] w-10 rounded bg-accent/15" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.title}</span>
                  <span className="block truncate text-sm text-muted">{[MEDIA_LABELS[h.mediaType], h.year, h.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
                {h.knownStatus && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">{SCREEN_STATUS_LABELS[h.knownStatus]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen && (
        <Modal title={chosen.title} onClose={() => setChosen(null)}>
          <p className="mb-4 line-clamp-4 text-sm text-muted">{chosen.overview || "Pas de résumé."}</p>
          <div className="grid grid-cols-3 gap-2">
            {(["a_voir", "en_cours", "vu"] as ScreenStatus[]).map((s) => (
              <button key={s} className={s === "a_voir" ? btn.primary : btn.ghost} disabled={busy} onClick={() => add(s)}>{SCREEN_STATUS_LABELS[s]}</button>
            ))}
          </div>
        </Modal>
      )}
      <p className="mt-4 text-center text-sm"><Link href="/ecrans/swipe" className="text-accent">Ou découvre des titres en swipant</Link></p>
    </div>
  );
}
