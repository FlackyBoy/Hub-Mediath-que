import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { MEDIA_LABELS, posterUrl, SCREEN_SORTS, SCREEN_STATUS_LABELS, type ScreenSort, type ScreenStatus } from "@/lib/screen-labels";
import { listScreens, plexKeys, screenCounts, screenGenres } from "@/lib/screens";
import { ScreensViewToggle } from "./view-toggle";

export const metadata: Metadata = { title: "Écrans" };

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim().slice(0, 100) : "";
}

const TABS: ScreenStatus[] = ["a_voir", "en_cours", "vu", "abandonne", "pas_interesse"];

export default async function EcransPage({ searchParams }: PageProps<"/ecrans">) {
  const sp = await searchParams;
  const p = {
    statut: (param(sp.statut) in SCREEN_STATUS_LABELS ? param(sp.statut) : "a_voir") as ScreenStatus,
    type: param(sp.type),
    genre: param(sp.genre),
    q: param(sp.q),
    tri: (param(sp.tri) in SCREEN_SORTS ? param(sp.tri) : "ajout") as ScreenSort,
  };
  const saved = (await cookies()).get("hub_screens_view")?.value;
  const vue = param(sp.vue) === "liste" || param(sp.vue) === "grille" ? param(sp.vue) : saved === "liste" ? "liste" : "grille";
  const href = (patch: Partial<typeof p & { vue: string }>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...p, vue, ...patch })) if (v && !(k === "statut" && v === "a_voir") && !(k === "tri" && v === "ajout")) s.set(k, v);
    const qs = s.toString();
    return qs ? `/ecrans?${qs}` : "/ecrans";
  };

  const counts = screenCounts();
  const items = listScreens({ status: p.statut, type: p.type, genre: p.genre, q: p.q, sort: p.tri });
  const plex = plexKeys();
  const genres = screenGenres();

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Écrans</h1>
          <p className="text-sm text-muted">{counts.a_voir} à voir · {counts.vu} vus</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/ecrans/ajouter" className="rounded-xl border border-border px-3 py-2 text-sm font-medium">+ Ajouter</Link>
          <Link href="/ecrans/swipe" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">Swipe</Link>
        </div>
      </div>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {TABS.map((s) => (
          <Link key={s} href={href({ statut: s })} replace role="tab" aria-selected={p.statut === s}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${p.statut === s ? "bg-accent text-accent-foreground" : "border border-border text-muted"}`}>
            {SCREEN_STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <form action="/ecrans" className="mb-3 flex gap-2">
        {Object.entries({ ...p, vue }).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <input name="q" type="search" defaultValue={p.q} placeholder="Titre…" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent" />
        <button aria-label="Rechercher" className="rounded-xl bg-accent px-3.5 text-accent-foreground"><SearchIcon className="size-5" /></button>
      </form>

      <div className="mb-3 flex items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-border text-sm">
          {[["", "Tout"], ["movie", "Films"], ["tv", "Séries"]].map(([k, l]) => (
            <Link key={k} href={href({ type: k })} replace className={`px-3 py-2 ${p.type === k ? "bg-accent text-accent-foreground" : ""}`}>{l}</Link>
          ))}
        </div>
        <ScreensViewToggle vue={vue} hrefListe={href({ vue: "liste" })} hrefGrille={href({ vue: "grille" })} />
      </div>
      {genres.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {["", ...genres].map((g) => (
            <Link key={g || "tous"} href={href({ genre: g })} replace
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${p.genre === g ? "bg-accent/20 text-accent" : "border border-border text-muted"}`}>
              {g || "Tous genres"}
            </Link>
          ))}
        </div>
      )}
      <div className="mb-3 flex justify-end">
        <div className="flex gap-1 text-xs">
          {(Object.keys(SCREEN_SORTS) as ScreenSort[]).map((s) => (
            <Link key={s} href={href({ tri: s })} replace className={`rounded-full px-2 py-1 ${p.tri === s ? "bg-accent/15 text-accent" : "text-muted"}`}>{SCREEN_SORTS[s]}</Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          <p className="mb-2">Rien ici pour l&apos;instant.</p>
          <Link href="/ecrans/swipe" className="font-medium text-accent">Lance une session de swipe</Link>
        </div>
      ) : vue === "grille" ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/ecrans/${s.id}`} className="relative block active:opacity-70">
                {posterUrl(s.poster_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl(s.poster_path)!} alt={s.title} loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover shadow-sm" />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center rounded-md bg-accent/15 p-2 text-center text-xs font-semibold text-accent">{s.title}</div>
                )}
                {s.rating !== null && <span className="absolute right-1 top-1 rounded-md bg-black/75 px-1.5 text-xs font-bold text-white">★ {s.rating}</span>}
                {plex.has(`${s.tmdb_id}:${s.media_type}`) && <span className="absolute left-1 top-1 rounded-md bg-amber-400 px-1 text-[10px] font-bold text-black">PLEX</span>}
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-tight">{s.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/ecrans/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-background">
                {posterUrl(s.poster_path, "w185") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl(s.poster_path, "w185")!} alt="" loading="lazy" className="aspect-[2/3] w-10 rounded object-cover" />
                ) : <span className="aspect-[2/3] w-10 rounded bg-accent/15" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {[MEDIA_LABELS[s.media_type], s.year, s.genres.split(",").slice(0, 2).join(","), s.rating !== null ? `★ ${s.rating}/10` : null, plex.has(`${s.tmdb_id}:${s.media_type}`) ? "Plex" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
