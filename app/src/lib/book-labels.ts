// Libellés partagés serveur / client (sans dépendance serveur).

export const STATUS_LABELS = {
  a_lire: "À lire",
  en_cours: "En cours",
  lu: "Lu",
  abandonne: "Abandonné",
} as const;

export const TYPE_LABELS = {
  roman: "Roman",
  bd: "BD",
  manga: "Manga",
  comics: "Comics",
  nouvelles: "Nouvelles",
  theatre: "Théâtre",
  essai: "Essai",
  beau_livre: "Beau livre",
} as const;

export type BookStatus = keyof typeof STATUS_LABELS;
export type BookType = keyof typeof TYPE_LABELS;

export const SORT_LABELS = {
  titre: "Titre",
  auteur: "Auteur",
  note: "Note",
  ajout: "Ajout récent",
} as const;

export type BookSort = keyof typeof SORT_LABELS;

export function isStatus(v: unknown): v is BookStatus {
  return typeof v === "string" && v in STATUS_LABELS;
}

export function isType(v: unknown): v is BookType {
  return typeof v === "string" && v in TYPE_LABELS;
}

export function coverSrc(id: number, version: string): string {
  return `/api/covers/${id}?v=${encodeURIComponent(version)}`;
}
