import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { durationLabel, GAME_DURATIONS, GAME_SORTS, GAME_STATUS_LABELS, GAME_STATUS_SHORT, playersLabel, type GameSort, type GameStatus } from "@/lib/game-labels";
import { gameCounts, listGames, topTags } from "@/lib/games";

export const metadata: Metadata = { title: "Jeux de société" };

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim().slice(0, 100) : "";
}

const TABS: GameStatus[] = ["possede", "envie", "ancien"];
const PLAYERS = ["1", "2", "3", "4", "5", "6", "8"];

export default async function JeuxPage({ searchParams }: PageProps<"/jeux">) {
  const sp = await searchParams;
  const p = {
    statut: (param(sp.statut) in GAME_STATUS_LABELS ? param(sp.statut) : "possede") as GameStatus,
    joueurs: PLAYERS.includes(param(sp.joueurs)) ? param(sp.joueurs) : "",
    duree: param(sp.duree) in GAME_DURATIONS ? param(sp.duree) : "",
    tag: param(sp.tag),
    q: param(sp.q),
    tri: (param(sp.tri) in GAME_SORTS ? param(sp.tri) : "titre") as GameSort,
  };
  const href = (patch: Partial<typeof p>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...p, ...patch })) if (v && !(k === "statut" && v === "possede") && !(k === "tri" && v === "titre")) s.set(k, v);
    const qs = s.toString();
    return qs ? `/jeux?${qs}` : "/jeux";
  };

  const counts = gameCounts();
  const games = listGames({ status: p.statut, players: Number(p.joueurs) || undefined, maxTime: Number(p.duree) || undefined, tag: p.tag, q: p.q, sort: p.tri });
  const tags = topTags();
  const chip = (active: boolean) => `shrink-0 rounded-full px-2.5 py-1 text-xs ${active ? "bg-accent/20 text-accent" : "border border-border text-muted"}`;

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jeux</h1>
          <p className="text-sm text-muted">{counts.possede} dans la ludothèque · {counts.envie} envie{counts.envie > 1 ? "s" : ""}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/jeux/importer" className="rounded-xl border border-border px-3 py-2 text-sm font-medium">Synchro</Link>
          <Link href="/jeux/ajouter" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">+ Ajouter</Link>
        </div>
      </div>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {TABS.map((s) => (
          <Link key={s} href={href({ statut: s })} replace role="tab" aria-selected={p.statut === s}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${p.statut === s ? "bg-accent text-accent-foreground" : "border border-border text-muted"}`}>
            {GAME_STATUS_SHORT[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <form action="/jeux" className="mb-3 flex gap-2">
        {Object.entries(p).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <input name="q" type="search" defaultValue={p.q} placeholder="Nom, auteur, éditeur…" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent" />
        <button aria-label="Rechercher" className="rounded-xl bg-accent px-3.5 text-accent-foreground"><SearchIcon className="size-5" /></button>
      </form>

      <div className="-mx-4 mb-2 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <span className="shrink-0 text-xs text-muted">Joueurs</span>
        {PLAYERS.map((n) => (
          <Link key={n} href={href({ joueurs: p.joueurs === n ? "" : n })} replace className={chip(p.joueurs === n)}>{n === "8" ? "8+" : n}</Link>
        ))}
      </div>
      <div className="-mx-4 mb-2 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <span className="shrink-0 text-xs text-muted">Durée</span>
        {(Object.entries(GAME_DURATIONS) as [string, string][]).map(([k, l]) => (
          <Link key={k} href={href({ duree: p.duree === k ? "" : k })} replace className={chip(p.duree === k)}>{l}</Link>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {["", ...tags].map((t) => (
            <Link key={t || "tous"} href={href({ tag: t })} replace className={chip(p.tag === t)}>{t || "Tous types"}</Link>
          ))}
        </div>
      )}
      <div className="mb-3 flex justify-end">
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 text-xs">
          {(Object.keys(GAME_SORTS) as GameSort[]).map((s) => (
            <Link key={s} href={href({ tri: s })} replace className={`shrink-0 rounded-full px-2 py-1 ${p.tri === s ? "bg-accent/15 text-accent" : "text-muted"}`}>{GAME_SORTS[s]}</Link>
          ))}
        </div>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {counts.possede + counts.envie + counts.ancien === 0 ? (
            <>
              <p className="mb-2">Ta ludothèque est vide.</p>
              <Link href="/jeux/importer" className="font-medium text-accent">Importe ton Sheet</Link> ou{" "}
              <Link href="/jeux/ajouter" className="font-medium text-accent">ajoute un jeu</Link>
            </>
          ) : (
            <p>Aucun jeu ne correspond à ces filtres.</p>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
          {games.map((g) => (
            <li key={g.id}>
              <Link href={`/jeux/${g.id}`} className="relative block active:opacity-70">
                {g.thumbnail || g.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(g.thumbnail || g.image)!} alt={g.title} loading="lazy" className="aspect-square w-full rounded-md bg-surface object-contain shadow-sm" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-md bg-accent/15 p-2 text-center text-xs font-semibold text-accent">{g.title}</div>
                )}
                {g.rating !== null && <span className="absolute right-1 top-1 rounded-md bg-black/75 px-1.5 text-xs font-bold text-white">★ {g.rating}</span>}
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-tight">{g.title}</p>
                <p className="truncate text-[11px] text-muted">
                  {[playersLabel(g.min_players, g.max_players)?.replace(" joueurs", " j.").replace(" joueur", " j."), durationLabel(g.min_time, g.max_time)].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
