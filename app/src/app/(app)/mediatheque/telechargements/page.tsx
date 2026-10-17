import type { Metadata } from "next";
import Link from "next/link";
import { hubHashes, toRel } from "@/lib/downloads";
import { formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/media-links";
import { listTorrents, type Torrent } from "@/lib/rtorrent";
import { TorrentList, type TorrentView } from "./torrent-list";

export const metadata: Metadata = { title: "Téléchargements" };

const STATE_LABELS: Record<Torrent["state"], string> = {
  download: "En cours",
  paused: "En pause",
  stopped: "En pause",
  seeding: "En partage",
  checking: "Vérification",
  error: "Erreur",
};

function eta(t: Torrent): string | null {
  if (t.complete || t.downRate <= 0) return null;
  const s = (t.size - t.done) / t.downRate;
  if (s < 60) return "moins d'1 min";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
  return `${Math.round(s / 86400)} j`;
}

function toView(t: Torrent, hub: Set<string>): TorrentView {
  const progress = t.size > 0 ? t.done / t.size : 0;
  const parts = t.complete
    ? [formatBytes(t.size), `ratio ${t.ratio.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`, t.finishedAt ? formatDate(t.finishedAt) : null]
    : [
        `${formatBytes(t.done)} / ${formatBytes(t.size)}`,
        t.downRate > 0 ? `${formatBytes(t.downRate)}/s` : null,
        eta(t) ? `reste ${eta(t)}` : null,
        `${t.peers} pair${t.peers > 1 ? "s" : ""}`,
      ];
  const rel = toRel(t.basePath);
  return {
    hash: t.hash,
    name: t.name,
    progress,
    state: t.state,
    stateLabel: STATE_LABELS[t.state],
    meta: parts.filter(Boolean).join(" · "),
    message: t.state === "error" ? t.message : null,
    fromHub: hub.has(t.hash),
    canDeleteData: Boolean(rel && rel.includes("/")),
    folder: rel ? rel.split("/").slice(0, -1).join("/") : null,
  };
}

export default async function TelechargementsPage({ searchParams }: PageProps<"/mediatheque/telechargements">) {
  const params = await searchParams;
  const showAll = params.tous === "1";

  let torrents: Torrent[] = [];
  let error: string | null = null;
  try {
    torrents = await listTorrents();
  } catch (e) {
    error = (e as Error).message;
  }
  const hub = hubHashes();
  const active = torrents.filter((t) => !t.complete).sort((a, b) => b.addedAt - a.addedAt);
  const done = torrents.filter((t) => t.complete).sort((a, b) => b.finishedAt - a.finishedAt);
  const doneShown = showAll ? done : done.slice(0, 20);

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/mediatheque" className="text-accent">
          Médiathèque
        </Link>
      </nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Téléchargements</h1>

      {error ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-danger">{error}</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-semibold">En cours ({active.length})</h2>
            <TorrentList torrents={active.map((t) => toView(t, hub))} emptyText="Aucun téléchargement en cours." autoRefresh={active.length > 0} />
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Terminés ({done.length})</h2>
            <TorrentList torrents={doneShown.map((t) => toView(t, hub))} emptyText="Aucun torrent terminé." />
            {!showAll && done.length > doneShown.length && (
              <Link href="/mediatheque/telechargements?tous=1" className="mt-3 block text-center text-sm font-medium text-accent">
                Afficher les {done.length} torrents
              </Link>
            )}
          </section>
        </div>
      )}
    </>
  );
}
