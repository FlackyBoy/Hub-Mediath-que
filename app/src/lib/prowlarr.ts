// Client Prowlarr : recherche sur les indexeurs configurés et récupération du torrent.

export type Category = "films" | "series" | "autres";

export type SearchResult = {
  id: string;
  title: string;
  size: number;
  seeders: number;
  leechers: number;
  indexer: string;
  category: Category;
  categoryName: string;
  publishDate: string;
  infoUrl: string | null;
  // URL de téléchargement Prowlarr, sans la clé API (rajoutée côté serveur)
  downloadUrl: string;
};

type ProwlarrRelease = {
  guid: string;
  title: string;
  size?: number;
  seeders?: number;
  leechers?: number;
  indexer?: string;
  categories?: { id: number; name: string }[];
  publishDate?: string;
  infoUrl?: string;
  downloadUrl?: string;
  magnetUrl?: string;
  protocol?: string;
};

function baseUrl(): string {
  return (process.env.PROWLARR_URL || "http://127.0.0.1:9696").replace(/\/$/, "");
}

export function isProwlarrConfigured(): boolean {
  return Boolean(process.env.PROWLARR_API_KEY);
}

function classify(categories: { id: number; name: string }[] = []): { category: Category; name: string } {
  const movie = categories.find((c) => c.id >= 2000 && c.id < 3000);
  if (movie) return { category: "films", name: movie.name };
  const tv = categories.find((c) => c.id >= 5000 && c.id < 6000);
  if (tv) return { category: "series", name: tv.name };
  return { category: "autres", name: categories[0]?.name ?? "Autre" };
}

function stripApiKey(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("apikey");
  return u.toString();
}

export async function searchReleases(query: string): Promise<SearchResult[]> {
  const url = new URL(`${baseUrl()}/api/v1/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("type", "search");
  url.searchParams.set("limit", "100");
  const res = await fetch(url, {
    headers: { "X-Api-Key": process.env.PROWLARR_API_KEY ?? "" },
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Clé API Prowlarr refusée");
  if (!res.ok) throw new Error(`Prowlarr a répondu ${res.status}`);
  const releases = (await res.json()) as ProwlarrRelease[];

  return releases
    .filter((r) => (r.protocol ?? "torrent") === "torrent" && (r.downloadUrl || r.magnetUrl))
    .map((r) => {
      const { category, name } = classify(r.categories);
      const link = r.downloadUrl || r.magnetUrl!;
      return {
        id: r.guid,
        title: r.title,
        size: r.size ?? 0,
        seeders: r.seeders ?? 0,
        leechers: r.leechers ?? 0,
        indexer: r.indexer ?? "",
        category,
        categoryName: name,
        publishDate: r.publishDate ?? "",
        infoUrl: r.infoUrl ?? null,
        downloadUrl: link.startsWith("magnet:") ? link : stripApiKey(link),
      };
    })
    .sort((a, b) => b.seeders - a.seeders);
}

export type FetchedTorrent = { torrent: Buffer } | { magnet: string };

// Récupère le .torrent (ou le magnet) via Prowlarr. N'accepte que des URL de Prowlarr.
export async function fetchRelease(downloadUrl: string): Promise<FetchedTorrent> {
  if (downloadUrl.startsWith("magnet:")) return { magnet: downloadUrl };
  const u = new URL(downloadUrl);
  if (u.origin !== new URL(baseUrl()).origin) throw new Error("Lien de téléchargement non reconnu");
  u.searchParams.set("apikey", process.env.PROWLARR_API_KEY ?? "");

  let current = u.toString();
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(60000), cache: "no-store" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      if (location.startsWith("magnet:")) return { magnet: location };
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Téléchargement refusé par l'indexeur (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] !== 0x64) throw new Error("Le fichier reçu n'est pas un torrent");
    return { torrent: buf };
  }
  throw new Error("Trop de redirections");
}
