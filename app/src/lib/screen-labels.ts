// Libellés partagés serveur / client pour les films et séries (sans dépendance serveur).

export const SCREEN_STATUS_LABELS = {
  a_voir: "À voir",
  en_cours: "En cours",
  vu: "Vu",
  abandonne: "Abandonné",
  pas_interesse: "Pas pour moi",
} as const;

export type ScreenStatus = keyof typeof SCREEN_STATUS_LABELS;
export type MediaType = "movie" | "tv";

export const MEDIA_LABELS: Record<MediaType, string> = { movie: "Film", tv: "Série" };

export const SCREEN_SORTS = {
  ajout: "Ajout récent",
  titre: "Titre",
  note: "Ma note",
  annee: "Année",
} as const;
export type ScreenSort = keyof typeof SCREEN_SORTS;

// Ordre du deck de swipe (TMDB)
export const DECK_ORDERS = {
  populaires: "Populaires",
  mieux_notes: "Mieux notés",
  recents: "Récents",
  pour_moi: "Pour moi",
} as const;
export type DeckOrder = keyof typeof DECK_ORDERS;

export function isScreenStatus(v: unknown): v is ScreenStatus {
  return typeof v === "string" && v in SCREEN_STATUS_LABELS;
}

export function isMediaType(v: unknown): v is MediaType {
  return v === "movie" || v === "tv";
}

export function posterUrl(path: string | null | undefined, size: "w185" | "w342" | "w500" | "w780" = "w342"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

// Carte du deck / résultat de recherche (données TMDB prêtes à afficher)
export type ScreenCard = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  tmdbRating: number | null;
  voteCount: number;
};

// Lien vers une plateforme de streaming : TMDB ne donne pas de lien direct par plateforme, on
// ouvre donc sa recherche sur le titre (l'app s'ouvre sur mobile). Plateforme inconnue : la
// page « Où regarder » de TMDB (JustWatch), qui a les liens directs.
const PROVIDER_SEARCH: [RegExp, string][] = [
  [/netflix/i, "https://www.netflix.com/search?q="],
  [/amazon|prime video/i, "https://www.primevideo.com/search?phrase="],
  [/disney/i, "https://www.disneyplus.com/search?q="],
  [/apple tv/i, "https://tv.apple.com/fr/search?term="],
  [/crunchyroll/i, "https://www.crunchyroll.com/fr/search?q="],
  [/youtube/i, "https://www.youtube.com/results?search_query="],
];

export function providerUrl(providerName: string, title: string, fallback: string | null): string | null {
  const search = PROVIDER_SEARCH.find(([re]) => re.test(providerName))?.[1];
  return search ? search + encodeURIComponent(title) : fallback;
}
