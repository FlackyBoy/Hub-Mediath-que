import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bggUrl, isBggConfigured } from "@/lib/bgg";
import { durationLabel, playersLabel, weightLabel } from "@/lib/game-labels";
import { getGame } from "@/lib/games";
import { DeleteGame, GameNotes, GameRatingPicker, GameStatusPicker, PlayCounter, RelinkGame } from "./game-controls";

export const metadata: Metadata = { title: "Jeu de société" };

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

export default async function GamePage({ params }: PageProps<"/jeux/[id]">) {
  const g = getGame(Number((await params).id));
  if (!g) notFound();
  const players = playersLabel(g.min_players, g.max_players);

  return (
    <>
      <nav className="mb-3 text-sm"><Link href="/jeux" className="text-accent">Jeux</Link></nav>
      <div className="mb-5 flex gap-4">
        {g.image || g.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(g.image || g.thumbnail)!} alt="" className="aspect-square w-32 shrink-0 rounded-lg bg-surface object-contain shadow" />
        ) : <div className="aspect-square w-32 shrink-0 rounded-lg bg-accent/15" />}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{g.title}</h1>
          {g.bgg_name && g.bgg_name !== g.title && <p className="text-sm text-muted">{g.bgg_name}</p>}
          <p className="mt-2 text-xs text-muted">{[g.year, g.designers.split(",").slice(0, 2).join(","), g.publisher].filter(Boolean).join(" · ")}</p>
          {g.bgg_rating && (
            <p className="mt-1 text-xs text-muted">
              BGG ★ {g.bgg_rating.toLocaleString("fr-FR")}{g.bgg_rank ? ` · n° ${g.bgg_rank.toLocaleString("fr-FR")}` : ""}
            </p>
          )}
          {g.meta === "pending" && <p className="mt-2 text-xs text-muted">{isBggConfigured() ? "Recherche de la fiche BGG…" : "Fiche BGG en attente (jeton BGG non configuré)"}</p>}
          {g.meta === "doubtful" && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Fiche BGG trouvée automatiquement : à vérifier</p>}
          {g.meta === "missing" && <p className="mt-2 text-xs text-muted">Pas de fiche BGG trouvée</p>}
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Joueurs" value={players && g.best_players ? `${players} (idéal : ${g.best_players})` : players} />
          <Fact label="Durée" value={durationLabel(g.min_time, g.max_time)} />
          <Fact label="Âge" value={g.min_age ? `${g.min_age} ans et +` : null} />
          <Fact label="Complexité" value={weightLabel(g.weight)} />
        </div>
        <GameStatusPicker id={g.id} value={g.status} />
        <PlayCounter id={g.id} plays={g.plays} lastPlayed={g.last_played} />
        <GameRatingPicker id={g.id} value={g.rating} />
        <GameNotes id={g.id} value={g.notes} />
        {(g.categories || g.mechanics) && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Type de jeu</h2>
            <div className="flex flex-wrap gap-1.5">
              {[...g.categories.split(","), ...g.mechanics.split(",")].map((t) => t.trim()).filter(Boolean).map((t) => (
                <Link key={t} href={`/jeux?tag=${encodeURIComponent(t)}&statut=${g.status}`} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted">{t}</Link>
              ))}
            </div>
          </section>
        )}
        {g.description && (
          <section>
            <h2 className="mb-1 text-sm font-semibold">Description</h2>
            <p className="line-clamp-[12] whitespace-pre-line text-sm text-muted">{g.description}</p>
          </section>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {g.bgg_id ? <a href={bggUrl(g.bgg_id)} target="_blank" rel="noopener noreferrer" className="text-accent">Voir sur BoardGameGeek ↗</a> : <span />}
          {isBggConfigured() && <RelinkGame id={g.id} title={g.title} linked={Boolean(g.bgg_id)} />}
        </div>
        <DeleteGame id={g.id} title={g.title} />
      </div>
    </>
  );
}
