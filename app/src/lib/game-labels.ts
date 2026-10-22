// Libellés partagés serveur / client pour les jeux de société (sans dépendance serveur).

export const GAME_STATUS_LABELS = {
  possede: "Dans ma ludothèque",
  envie: "Envie",
  ancien: "Plus à moi",
} as const;

// Version courte pour les onglets et les puces
export const GAME_STATUS_SHORT = {
  possede: "Ludothèque",
  envie: "Envies",
  ancien: "Plus à moi",
} as const;

export type GameStatus = keyof typeof GAME_STATUS_LABELS;

export const GAME_SORTS = {
  titre: "Titre",
  note: "Ma note",
  ajout: "Ajout récent",
  parties: "Parties",
  duree: "Durée",
  complexite: "Complexité",
} as const;
export type GameSort = keyof typeof GAME_SORTS;

// Filtres de durée (minutes, durée maximale annoncée)
export const GAME_DURATIONS = { "30": "≤ 30 min", "60": "≤ 1 h", "90": "≤ 1 h 30", "120": "≤ 2 h" } as const;

export function isGameStatus(v: unknown): v is GameStatus {
  return typeof v === "string" && v in GAME_STATUS_LABELS;
}

export function playersLabel(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (!max) return `${min}+ joueurs`;
  if (!min) return `jusqu'à ${max} joueurs`;
  if (min === max) return `${min} joueur${min > 1 ? "s" : ""}`;
  return `${min}-${max} joueurs`;
}

export function durationLabel(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (!max || min === max) return `${min ?? max} min`;
  if (!min) return `${max} min`;
  return `${min}-${max} min`;
}

// Complexité BGG (1 = très simple, 5 = très lourd)
export function weightLabel(w: number | null): string | null {
  if (!w) return null;
  const label = w < 1.8 ? "Simple" : w < 2.6 ? "Accessible" : w < 3.4 ? "Intermédiaire" : w < 4.2 ? "Expert" : "Très lourd";
  return `${label} (${w.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/5)`;
}

// Résultat de recherche BGG prêt à afficher
export type GameHit = { bggId: number; name: string; year: number | null };
