import type { MediaType, ScreenCard } from "./screen-labels";

// Client TMDB (The Movie Database) : recherche, découverte filtrée, détails,
// plateformes de streaming en France. Clé : TMDB_API_KEY (clé v3 ou jeton v4 « eyJ… »).

const BASE = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

export class TmdbError extends Error {}

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new TmdbError("TMDB n'est pas configuré (TMDB_API_KEY)");
  const url = new URL(BASE + path);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const bearer = key.startsWith("eyJ");
  if (!bearer) url.searchParams.set("api_key", key);
  const res = await fetch(url, {
    headers: bearer ? { Authorization: `Bearer ${key}`, Accept: "application/json" } : { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    // Listes de genres et de plateformes : peu changeantes
    next: { revalidate: path.includes("/list") || path.startsWith("/watch/providers") ? 86400 : 0 },
  });
  if (res.status === 401) throw new TmdbError("Clé TMDB refusée");
  if (!res.ok) throw new TmdbError(`TMDB a répondu ${res.status}`);
  return (await res.json()) as T;
}

type RawItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  vote_average?: number;
  vote_count?: number;
};

export type Genre = { id: number; name: string };

export async function getGenres(type: MediaType): Promise<Genre[]> {
  const data = await tmdb<{ genres: Genre[] }>(`/genre/${type}/list`);
  return data.genres;
}

async function genreMap(type: MediaType): Promise<Map<number, string>> {
  try {
    return new Map((await getGenres(type)).map((g) => [g.id, g.name]));
  } catch {
    return new Map();
  }
}

function toCard(r: RawItem, type: MediaType, genres: Map<number, string>): ScreenCard {
  const date = type === "movie" ? r.release_date : r.first_air_date;
  return {
    tmdbId: r.id,
    mediaType: type,
    title: (type === "movie" ? r.title : r.name) ?? "",
    originalTitle: (type === "movie" ? r.original_title : r.original_name) ?? "",
    year: date ? Number(date.slice(0, 4)) || null : null,
    overview: r.overview ?? "",
    posterPath: r.poster_path ?? null,
    backdropPath: r.backdrop_path ?? null,
    genres: r.genres ? r.genres.map((g) => g.name) : (r.genre_ids ?? []).map((id) => genres.get(id)).filter((g): g is string => Boolean(g)),
    tmdbRating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    voteCount: r.vote_count ?? 0,
  };
}

export async function searchScreens(query: string): Promise<ScreenCard[]> {
  const [data, movieGenres, tvGenres] = await Promise.all([
    tmdb<{ results: RawItem[] }>("/search/multi", { query, include_adult: "false" }),
    genreMap("movie"),
    genreMap("tv"),
  ]);
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => toCard(r, r.media_type as MediaType, r.media_type === "movie" ? movieGenres : tvGenres));
}

export type Provider = { id: number; name: string; logoPath: string | null };

// Plateformes de streaming disponibles en France (abonnement), les plus courantes d'abord
export async function getProviders(type: MediaType): Promise<Provider[]> {
  const data = await tmdb<{ results: { provider_id: number; provider_name: string; logo_path: string | null; display_priorities?: Record<string, number> }[] }>(
    `/watch/providers/${type}`,
    { watch_region: "FR" },
  );
  return data.results
    .sort((a, b) => (a.display_priorities?.FR ?? 999) - (b.display_priorities?.FR ?? 999))
    .slice(0, 25)
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
}

export type DiscoverParams = {
  type: MediaType;
  genres?: number[];
  providers?: number[];
  order: "populaires" | "mieux_notes" | "recents";
  page: number;
};

export async function discover(p: DiscoverParams): Promise<{ cards: ScreenCard[]; totalPages: number }> {
  const dateField = p.type === "movie" ? "primary_release_date" : "first_air_date";
  const today = new Date().toISOString().slice(0, 10);
  const params: Record<string, string | number | undefined> = {
    page: p.page,
    include_adult: "false",
    watch_region: "FR",
    with_genres: p.genres?.length ? p.genres.join("|") : undefined,
    with_watch_providers: p.providers?.length ? p.providers.join("|") : undefined,
    with_watch_monetization_types: p.providers?.length ? "flatrate" : undefined,
  };
  if (p.order === "populaires") Object.assign(params, { sort_by: "popularity.desc", "vote_count.gte": 50 });
  if (p.order === "mieux_notes") Object.assign(params, { sort_by: "vote_average.desc", "vote_count.gte": 800 });
  if (p.order === "recents") Object.assign(params, { sort_by: `${dateField}.desc`, [`${dateField}.lte`]: today, "vote_count.gte": 30 });
  const [data, genres] = await Promise.all([
    tmdb<{ results: RawItem[]; total_pages: number }>(`/discover/${p.type}`, params),
    genreMap(p.type),
  ]);
  return { cards: data.results.map((r) => toCard(r, p.type, genres)), totalPages: Math.min(data.total_pages, 500) };
}

export async function recommendations(type: MediaType, tmdbId: number): Promise<ScreenCard[]> {
  const [data, genres] = await Promise.all([
    tmdb<{ results: RawItem[] }>(`/${type}/${tmdbId}/recommendations`),
    genreMap(type),
  ]);
  return data.results.map((r) => toCard(r, type, genres));
}

export type ScreenDetails = ScreenCard & {
  runtime: number | null;
  seasons: number | null;
  providers: Provider[];
  watchLink: string | null;
};

type RawDetails = RawItem & {
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  "watch/providers"?: { results?: { FR?: { link?: string; flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[] } } };
};

export async function getDetails(type: MediaType, tmdbId: number): Promise<ScreenDetails> {
  const d = await tmdb<RawDetails>(`/${type}/${tmdbId}`, { append_to_response: "watch/providers" });
  const fr = d["watch/providers"]?.results?.FR;
  return {
    ...toCard(d, type, new Map()),
    runtime: type === "movie" ? (d.runtime ?? null) : (d.episode_run_time?.[0] ?? null),
    seasons: type === "tv" ? (d.number_of_seasons ?? null) : null,
    providers: (fr?.flatrate ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path })),
    watchLink: fr?.link ?? null,
  };
}
