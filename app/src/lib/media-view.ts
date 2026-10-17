import { getDirSizes } from "./disk";
import type { Entry } from "./files";
import { formatBytes, formatDate } from "./format";
import type { ViewEntry } from "./media-links";

// Données prêtes à afficher (libellés calculés côté serveur, pas d'écart d'hydratation).

export type SortKey = "nom" | "taille" | "date";

export function parseSort(value: unknown): SortKey {
  return value === "taille" || value === "date" ? value : "nom";
}

export function toViewEntries(entries: Entry[]): ViewEntry[] {
  const sizes = getDirSizes(entries.filter((e) => e.kind === "dir").map((e) => e.rel));
  return entries.map((e) => {
    const size = e.kind === "dir" ? (sizes.get(e.rel)?.size ?? null) : e.size;
    return {
      name: e.name,
      rel: e.rel,
      kind: e.kind,
      size,
      sizeLabel: size === null ? null : formatBytes(size),
      dateLabel: formatDate(e.mtime),
    };
  });
}

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function sortEntries(entries: Entry[], view: ViewEntry[], sort: SortKey): ViewEntry[] {
  const mtime = new Map(entries.map((e) => [e.rel, e.mtime]));
  return [...view].sort((a, b) => {
    if (sort === "taille") return (b.size ?? -1) - (a.size ?? -1);
    if (sort === "date") return (mtime.get(b.rel) ?? 0) - (mtime.get(a.rel) ?? 0);
    if ((a.kind === "dir") !== (b.kind === "dir")) return a.kind === "dir" ? -1 : 1;
    return collator.compare(a.name, b.name);
  });
}
