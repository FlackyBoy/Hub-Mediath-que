import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon } from "@/components/icons";
import { isProwlarrConfigured } from "@/lib/prowlarr";
import { MEDIA_LABELS, posterUrl } from "@/lib/screen-labels";
import { getScreen, inPlex } from "@/lib/screens";
import { getDetails, isTmdbConfigured, type ScreenDetails } from "@/lib/tmdb";
import { DeleteScreen, ScreenNotes, ScreenRatingPicker, ScreenStatusPicker } from "./screen-controls";

export const metadata: Metadata = { title: "Film / série" };

export default async function ScreenPage({ params }: PageProps<"/ecrans/[id]">) {
  const s = getScreen(Number((await params).id));
  if (!s) notFound();
  // Infos du moment (plateformes, durée) : TMDB en direct, facultatif
  let details: ScreenDetails | null = null;
  if (isTmdbConfigured()) details = await getDetails(s.media_type, s.tmdb_id).catch(() => null);
  const plex = inPlex(s.tmdb_id, s.media_type);
  const facts = [
    MEDIA_LABELS[s.media_type],
    s.year,
    details?.runtime ? (s.media_type === "movie" ? `${details.runtime} min` : `${details.runtime} min / épisode`) : null,
    details?.seasons ? `${details.seasons} saison${details.seasons > 1 ? "s" : ""}` : null,
    s.tmdb_rating ? `TMDB ★ ${s.tmdb_rating.toLocaleString("fr-FR")}` : null,
  ].filter(Boolean);
  // Recherche Prowlarr déjà remplie : film avec l'année (évite remakes et homonymes), série sans
  const tab = s.media_type === "movie" ? "films" : "series";
  const searchHref = (title: string) =>
    `/mediatheque/recherche?${new URLSearchParams({ q: s.media_type === "movie" && s.year ? `${title} ${s.year}` : title, tab })}`;
  const otherTitle = s.original_title && s.original_title !== s.title ? s.original_title : null;

  return (
    <>
      <nav className="mb-3 text-sm"><Link href="/ecrans" className="text-accent">Écrans</Link></nav>
      <div className="mb-5 flex gap-4">
        {posterUrl(s.poster_path) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl(s.poster_path)!} alt="" className="aspect-[2/3] w-32 shrink-0 rounded-lg object-cover shadow" />
        ) : <div className="aspect-[2/3] w-32 shrink-0 rounded-lg bg-accent/15" />}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{s.title}</h1>
          {s.original_title && s.original_title !== s.title && <p className="text-sm text-muted">{s.original_title}</p>}
          <p className="mt-2 text-xs text-muted">{facts.join(" · ")}</p>
          <p className="mt-1 text-xs text-muted">{s.genres}</p>
          {plex && (
            <p className="mt-2 inline-block rounded-md bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-black">
              Sur ton Plex{s.media_type === "tv" && plex.progress > 0 && plex.progress < 1 ? ` · ${Math.round(plex.progress * 100)} % vu` : ""}
            </p>
          )}
        </div>
      </div>

      {isProwlarrConfigured() && (
        <div className="mb-5">
          <Link
            href={searchHref(s.title)}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            <DownloadIcon className="size-5" />
            Télécharger
          </Link>
          {otherTitle && (
            <Link href={searchHref(otherTitle)} className="mt-2 block text-center text-xs text-accent">
              Chercher avec le titre original ({otherTitle})
            </Link>
          )}
        </div>
      )}

      <div className="space-y-5">
        <ScreenStatusPicker id={s.id} value={s.status} />
        <ScreenRatingPicker id={s.id} value={s.rating} />
        <ScreenNotes id={s.id} value={s.notes} />
        {details && details.providers.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Où regarder (abonnement)</h2>
            <div className="flex flex-wrap gap-2">
              {details.providers.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs">
                  {p.logoPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://image.tmdb.org/t/p/w45${p.logoPath}`} alt="" className="size-4 rounded" />
                  )}
                  {p.name}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted">Données JustWatch via TMDB</p>
          </section>
        )}
        {s.overview && (
          <section>
            <h2 className="mb-1 text-sm font-semibold">Résumé</h2>
            <p className="text-sm text-muted">{s.overview}</p>
          </section>
        )}
        <DeleteScreen id={s.id} title={s.title} />
      </div>
    </>
  );
}
