"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { btn, Modal } from "@/components/modal";
import { DECK_ORDERS, MEDIA_LABELS, posterUrl, type DeckOrder, type MediaType, type ScreenStatus } from "@/lib/screen-labels";
import type { Genre, Provider } from "@/lib/tmdb";
import { deckAction, deckOptionsAction, swipeAction, undoSwipeAction, type DeckCard, type DeckRequest } from "../actions";

type Filters = { type: MediaType; genres: number[]; providers: number[]; order: DeckOrder };
// saved : enregistrement en cours côté serveur (résout l'id créé, ou null en cas d'échec)
type Done = { card: DeckCard; status: ScreenStatus; saved: Promise<number | null> };

const THRESHOLD = 110;
const SWIPE_COLORS: Record<string, string> = { a_voir: "#16a34a", pas_interesse: "#dc2626", vu: "#2563eb" };
const SWIPE_LABELS: Record<string, string> = { a_voir: "À VOIR", pas_interesse: "PAS POUR MOI", vu: "DÉJÀ VU" };

function chip(active: boolean) {
  return `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-accent text-accent-foreground" : "border border-border text-muted"}`;
}

// Écran 1 : choix des filtres de la session
function Setup({ initial, onStart }: { initial: Filters; onStart: (f: Filters) => void }) {
  const [f, setF] = useState(initial);
  const [options, setOptions] = useState<{ genres: Genre[]; providers: Provider[]; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    deckOptionsAction(f.type).then((o) => !cancelled && setOptions(o));
    return () => {
      cancelled = true;
    };
  }, [f.type]);

  const toggle = (key: "genres" | "providers", id: number) =>
    setF({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] });

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-sm font-semibold">Quoi ?</p>
        <div className="flex gap-2">
          {(["movie", "tv"] as MediaType[]).map((t) => (
            <button key={t} className={chip(f.type === t)} onClick={() => setF({ ...f, type: t, genres: [], providers: [] })}>
              {MEDIA_LABELS[t]}s
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-2 text-sm font-semibold">Ordre</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DECK_ORDERS) as DeckOrder[]).map((o) => (
            <button key={o} className={chip(f.order === o)} onClick={() => setF({ ...f, order: o })}>
              {DECK_ORDERS[o]}
            </button>
          ))}
        </div>
      </section>
      {options?.error && <p className="text-sm text-danger">{options.error}</p>}
      <section>
        <p className="mb-2 text-sm font-semibold">Genres <span className="font-normal text-muted">(facultatif)</span></p>
        <div className="flex flex-wrap gap-2">
          {options === null ? <p className="text-sm text-muted">Chargement…</p> : options.genres.map((g) => (
            <button key={g.id} className={chip(f.genres.includes(g.id))} onClick={() => toggle("genres", g.id)}>{g.name}</button>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-2 text-sm font-semibold">Disponible sur <span className="font-normal text-muted">(facultatif)</span></p>
        <div className="flex flex-wrap gap-2">
          {options?.providers.map((p) => (
            <button key={p.id} className={`${chip(f.providers.includes(p.id))} flex items-center gap-1.5`} onClick={() => toggle("providers", p.id)}>
              {p.logoPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://image.tmdb.org/t/p/w45${p.logoPath}`} alt="" className="size-5 rounded" />
              )}
              {p.name}
            </button>
          ))}
        </div>
      </section>
      <button className={`${btn.primary} w-full`} onClick={() => onStart(f)}>Commencer</button>
    </div>
  );
}

// Écran 2 : le deck
export function SwipeDeck() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(false);
  const nextPage = useRef<number | null>(1);
  const loadingRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Done[]>([]);
  const [rating, setRating] = useState<DeckCard | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const seen = useRef(new Set<string>());

  // Charge la page suivante du deck (une seule requête à la fois)
  const loadMore = useCallback(async (f: Filters) => {
    if (loadingRef.current || !nextPage.current) return;
    loadingRef.current = true;
    setLoading(true);
    const res = await deckAction({ ...f, page: nextPage.current } as DeckRequest);
    if (res.error) setError(res.error);
    if (res.notice) setNotice(res.notice);
    const fresh = res.cards.filter((c) => !seen.current.has(`${c.tmdbId}:${c.mediaType}`));
    fresh.forEach((c) => seen.current.add(`${c.tmdbId}:${c.mediaType}`));
    setCards((prev) => [...prev, ...fresh]);
    nextPage.current = res.nextPage;
    loadingRef.current = false;
    setLoading(false);
  }, []);

  const top = cards[0];

  function commit(status: ScreenStatus, ratingValue?: number | null) {
    const card = top;
    if (!card) return;
    setCards((prev) => prev.slice(1));
    if (cards.length - 1 < 5 && filters) void loadMore(filters); // recharge quand il reste peu de cartes
    setExpanded(false);
    const saved = swipeAction(card.mediaType, card.tmdbId, status, ratingValue).then((res) => {
      if (res.ok) return res.id;
      setError(res.error);
      return null;
    });
    setHistory((h) => [{ card, status, saved }, ...h].slice(0, 20));
  }

  function fling(status: ScreenStatus) {
    if (!top || leaving) return;
    if (status === "vu") {
      setRating(top);
      return;
    }
    setLeaving(status === "a_voir" ? { x: 600, y: 0 } : { x: -600, y: 0 });
    setTimeout(() => {
      setLeaving(null);
      setDrag({ x: 0, y: 0, active: false });
      commit(status);
    }, 220);
  }

  async function undo() {
    const last = history[0];
    if (!last) return;
    setHistory((h) => h.slice(1));
    setCards((prev) => [last.card, ...prev]);
    const id = await last.saved;
    if (id) await undoSwipeAction(id);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  }
  function onPointerUp() {
    if (!start.current) return;
    start.current = null;
    const { x, y } = drag;
    if (Math.abs(x) < 6 && Math.abs(y) < 6) {
      setExpanded((v) => !v); // simple toucher : affiche le résumé
      setDrag({ x: 0, y: 0, active: false });
    } else if (y < -THRESHOLD && Math.abs(y) > Math.abs(x)) {
      setDrag({ x: 0, y: 0, active: false });
      fling("vu");
    } else if (x > THRESHOLD) fling("a_voir");
    else if (x < -THRESHOLD) fling("pas_interesse");
    else setDrag({ x: 0, y: 0, active: false });
  }

  if (!filters) {
    return (
      <Setup
        initial={{ type: "movie", genres: [], providers: [], order: "populaires" }}
        onStart={(f) => {
          seen.current.clear();
          setCards([]);
          setHistory([]);
          setNotice(null);
          setError(null);
          nextPage.current = 1;
          setFilters(f);
          void loadMore(f);
        }}
      />
    );
  }

  const pos = leaving ?? drag;
  const intent = pos.y < -40 && Math.abs(pos.y) > Math.abs(pos.x) ? "vu" : pos.x > 40 ? "a_voir" : pos.x < -40 ? "pas_interesse" : null;

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between text-sm">
        <button className="font-medium text-accent" onClick={() => setFilters(null)}>← Filtres</button>
        <span className="text-muted">{MEDIA_LABELS[filters.type]}s · {DECK_ORDERS[filters.order]}</span>
      </div>
      {notice && <p className="mb-2 text-xs text-muted">{notice}</p>}
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      <div className="relative mx-auto aspect-[2/3] w-full max-w-sm select-none">
        {!top ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-border bg-surface p-6 text-center text-sm text-muted">
            {loading ? "Chargement…" : (
              <>
                <p className="mb-3">Plus de suggestions pour ces filtres.</p>
                <button className="font-medium text-accent" onClick={() => setFilters(null)}>Changer les filtres</button>
              </>
            )}
          </div>
        ) : (
          <>
            {cards[1] && (
              <div className="absolute inset-0 scale-95 overflow-hidden rounded-3xl bg-surface opacity-70">
                {posterUrl(cards[1].posterPath, "w500") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl(cards[1].posterPath, "w500")!} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            )}
            <div
              role="group"
              aria-label={`${top.title}, glisse à droite pour « À voir », à gauche pour « Pas pour moi », vers le haut pour « Déjà vu »`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-surface shadow-xl"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.x / 18}deg)`,
                transition: drag.active && !leaving ? "none" : "transform 220ms ease-out",
              }}
            >
              {posterUrl(top.posterPath, "w500") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl(top.posterPath, "w780")!} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-accent/15 p-6 text-center text-xl font-bold text-accent">{top.title}</div>
              )}
              {intent && (
                <span
                  className="absolute left-1/2 top-8 -translate-x-1/2 rounded-xl border-4 px-3 py-1 text-xl font-black tracking-wide"
                  style={{ color: SWIPE_COLORS[intent], borderColor: SWIPE_COLORS[intent], background: "rgba(255,255,255,0.85)" }}
                >
                  {SWIPE_LABELS[intent]}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-16 text-white">
                <p className="text-xl font-bold leading-tight">{top.title}</p>
                <p className="mt-0.5 text-sm text-white/80">
                  {[top.year, top.genres.slice(0, 3).join(", "), top.tmdbRating ? `★ ${top.tmdbRating.toLocaleString("fr-FR")}` : null].filter(Boolean).join(" · ")}
                </p>
                {top.onPlex && <p className="mt-1 inline-block rounded-md bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-black">Sur ton Plex</p>}
                <p className={`mt-2 text-sm text-white/90 ${expanded ? "max-h-48 overflow-y-auto" : "line-clamp-2"}`}>{top.overview || "Pas de résumé."}</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <button aria-label="Annuler le dernier choix" onClick={undo} disabled={!history.length} className="flex size-11 items-center justify-center rounded-full border border-border text-lg disabled:opacity-30">↶</button>
        <button aria-label="Pas pour moi" onClick={() => fling("pas_interesse")} disabled={!top} className="flex size-16 items-center justify-center rounded-full border-2 text-2xl disabled:opacity-30" style={{ borderColor: SWIPE_COLORS.pas_interesse, color: SWIPE_COLORS.pas_interesse }}>✕</button>
        <button aria-label="Déjà vu" onClick={() => fling("vu")} disabled={!top} className="flex size-12 items-center justify-center rounded-full border-2 text-lg disabled:opacity-30" style={{ borderColor: SWIPE_COLORS.vu, color: SWIPE_COLORS.vu }}>👁</button>
        <button aria-label="À voir" onClick={() => fling("a_voir")} disabled={!top} className="flex size-16 items-center justify-center rounded-full border-2 text-2xl disabled:opacity-30" style={{ borderColor: SWIPE_COLORS.a_voir, color: SWIPE_COLORS.a_voir }}>♥</button>
        <Link aria-label="Ma liste" href="/ecrans" className="flex size-11 items-center justify-center rounded-full border border-border text-lg">☰</Link>
      </div>
      <p className="mt-3 text-center text-xs text-muted">→ À voir · ← Pas pour moi · ↑ Déjà vu · toucher : résumé</p>

      {rating && (
        <Modal title={`Ta note pour « ${rating.title} »`} onClose={() => setRating(null)}>
          <div className="mb-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} className="rounded-xl bg-accent/10 py-3 font-semibold" onClick={() => { setRating(null); commit("vu", n); }}>{n}</button>
            ))}
          </div>
          <button className={`${btn.ghost} w-full`} onClick={() => { setRating(null); commit("vu", null); }}>Vu, sans note</button>
        </Modal>
      )}
    </div>
  );
}
