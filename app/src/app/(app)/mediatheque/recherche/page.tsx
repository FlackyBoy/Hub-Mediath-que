import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { getDefaultDest } from "@/lib/downloads";
import { formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/media-links";
import { isProwlarrConfigured, searchReleases, type SearchResult } from "@/lib/prowlarr";
import { SearchResults, type ResultView } from "./search-results";

export const metadata: Metadata = { title: "Recherche" };

function toView(r: SearchResult): ResultView {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    meta: [
      formatBytes(r.size),
      `${r.seeders} sources`,
      r.indexer,
      r.publishDate ? formatDate(new Date(r.publishDate).getTime()) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    detail: r.categoryName,
    infoUrl: r.infoUrl,
    downloadUrl: r.downloadUrl,
  };
}

export default async function RecherchePage({ searchParams }: PageProps<"/mediatheque/recherche">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const configured = isProwlarrConfigured();

  let results: ResultView[] = [];
  let error: string | null = null;
  if (q && configured) {
    try {
      results = (await searchReleases(q)).map(toView);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/mediatheque" className="text-accent">
          Médias
        </Link>
      </nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Recherche</h1>

      {!configured ? (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="font-semibold">Prowlarr n&apos;est pas encore relié au Hub.</p>
          <p className="mt-1 text-muted">Ajoute tes indexeurs dans Prowlarr, puis renseigne PROWLARR_API_KEY dans le .env.</p>
        </div>
      ) : (
        <>
          <form action="/mediatheque/recherche" className="mb-4 flex gap-2">
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Titre, saison, auteur…"
              enterKeyHint="search"
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
            />
            <button aria-label="Rechercher" className="rounded-xl bg-accent px-4 text-accent-foreground">
              <SearchIcon className="size-5" />
            </button>
          </form>
          <p className="mb-4 text-xs text-muted">Uniquement pour du contenu que tu as le droit de télécharger.</p>

          {error && <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-danger">{error}</p>}
          {q && !error && (
            <SearchResults
              key={q}
              results={results}
              defaults={{
                films: getDefaultDest("films"),
                series: getDefaultDest("series"),
                autres: getDefaultDest("autres"),
              }}
            />
          )}
        </>
      )}
    </>
  );
}
