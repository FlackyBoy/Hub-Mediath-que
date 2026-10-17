import { getDb } from "./db";
import { isMediaType, isScreenStatus, type MediaType, type ScreenCard, type ScreenSort, type ScreenStatus } from "./screen-labels";

// Films et séries de l'utilisateur (statut, note, avis), identifiés par leur id TMDB.

export type Screen = {
  id: number;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string;
  year: number | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string;
  tmdb_rating: number | null;
  status: ScreenStatus;
  rating: number | null;
  notes: string;
  source: string;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ScreenFilters = {
  q?: string;
  status?: string;
  type?: string;
  genre?: string;
  minRating?: number;
  sort?: ScreenSort;
  includeHidden?: boolean;
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Ajoute ou met à jour un film/une série à partir des données TMDB
export function upsertScreen(card: ScreenCard, status: ScreenStatus, extra: { rating?: number | null; source?: string } = {}): number {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM screens WHERE tmdb_id = ? AND media_type = ?").get(card.tmdbId, card.mediaType) as
    | { id: number }
    | undefined;
  const watchedAt = status === "vu" ? new Date().toISOString().slice(0, 10) : null;
  if (existing) {
    db.prepare(
      `UPDATE screens SET status = ?, rating = COALESCE(?, rating), watched_at = COALESCE(watched_at, ?),
       title = ?, original_title = ?, year = ?, overview = ?, poster_path = ?, backdrop_path = ?, genres = ?, tmdb_rating = ?,
       updated_at = datetime('now') WHERE id = ?`,
    ).run(status, extra.rating ?? null, watchedAt, card.title, card.originalTitle, card.year, card.overview, card.posterPath,
      card.backdropPath, card.genres.join(", "), card.tmdbRating, existing.id);
    return existing.id;
  }
  const r = db
    .prepare(
      `INSERT INTO screens (tmdb_id, media_type, title, original_title, year, overview, poster_path, backdrop_path, genres,
       tmdb_rating, status, rating, source, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(card.tmdbId, card.mediaType, card.title, card.originalTitle, card.year, card.overview, card.posterPath,
      card.backdropPath, card.genres.join(", "), card.tmdbRating, status, extra.rating ?? null, extra.source ?? "manuel", watchedAt);
  return Number(r.lastInsertRowid);
}

export function updateScreen(id: number, patch: { status?: string; rating?: number | null; notes?: string }) {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.status !== undefined && isScreenStatus(patch.status)) {
    sets.push("status = ?");
    params.push(patch.status);
    if (patch.status === "vu") sets.push("watched_at = COALESCE(watched_at, date('now'))");
  }
  if ("rating" in patch) {
    const r = patch.rating;
    sets.push("rating = ?");
    params.push(r === null || r === undefined ? null : Math.min(10, Math.max(0, Math.round(Number(r)))));
  }
  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    params.push(String(patch.notes).slice(0, 10000));
  }
  if (!sets.length) return;
  getDb().prepare(`UPDATE screens SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...params, id);
}

export function deleteScreen(id: number) {
  getDb().prepare("DELETE FROM screens WHERE id = ?").run(id);
}

export function getScreen(id: number): Screen | null {
  return (getDb().prepare("SELECT * FROM screens WHERE id = ?").get(id) as Screen | undefined) ?? null;
}

const SORT_SQL: Record<ScreenSort, string> = {
  ajout: "updated_at DESC, id DESC",
  titre: "title COLLATE NOCASE",
  note: "rating IS NULL, rating DESC, title COLLATE NOCASE",
  annee: "year IS NULL, year DESC",
};

export function listScreens(f: ScreenFilters): Screen[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.status && isScreenStatus(f.status)) {
    where.push("status = ?");
    params.push(f.status);
  } else if (!f.includeHidden) where.push("status != 'pas_interesse'");
  if (f.type && isMediaType(f.type)) {
    where.push("media_type = ?");
    params.push(f.type);
  }
  if (f.minRating !== undefined && Number.isFinite(f.minRating)) {
    where.push("rating >= ?");
    params.push(f.minRating);
  }
  const rows = getDb()
    .prepare(`SELECT * FROM screens ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${SORT_SQL[f.sort ?? "ajout"]}`)
    .all(...params) as Screen[];
  // Recherche et genre : filtrés ici, sans tenir compte des accents
  const q = f.q ? norm(f.q) : "";
  const g = f.genre ? norm(f.genre) : "";
  return rows.filter(
    (s) => (!q || norm(`${s.title} ${s.original_title}`).includes(q)) && (!g || norm(s.genres).includes(g)),
  );
}

// Clés "tmdbId:type" déjà dans la liste (y compris « Pas pour moi ») : exclues du deck
export function knownKeys(): Set<string> {
  const rows = getDb().prepare("SELECT tmdb_id, media_type FROM screens").all() as { tmdb_id: number; media_type: string }[];
  return new Set(rows.map((r) => `${r.tmdb_id}:${r.media_type}`));
}

export function screenCounts(): Record<ScreenStatus, number> {
  const counts: Record<ScreenStatus, number> = { a_voir: 0, en_cours: 0, vu: 0, abandonne: 0, pas_interesse: 0 };
  const rows = getDb().prepare("SELECT status, COUNT(*) AS n FROM screens GROUP BY status").all() as { status: ScreenStatus; n: number }[];
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export function screenGenres(): string[] {
  const rows = getDb().prepare("SELECT genres FROM screens WHERE status != 'pas_interesse'").all() as { genres: string }[];
  const set = new Set<string>();
  for (const r of rows) for (const g of r.genres.split(",")) if (g.trim()) set.add(g.trim());
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

// Films/séries les mieux notés : base du mode « Pour moi » du deck
export function topRated(limit = 8): Screen[] {
  return getDb()
    .prepare("SELECT * FROM screens WHERE rating >= 7 ORDER BY rating DESC, updated_at DESC LIMIT ?")
    .all(limit) as Screen[];
}

export function inPlex(tmdbId: number, type: MediaType): { viewed: boolean; progress: number } | null {
  const r = getDb().prepare("SELECT viewed, progress FROM plex_library WHERE tmdb_id = ? AND media_type = ?").get(tmdbId, type) as
    | { viewed: number; progress: number }
    | undefined;
  return r ? { viewed: r.viewed === 1, progress: r.progress } : null;
}

export function plexKeys(): Set<string> {
  const rows = getDb().prepare("SELECT tmdb_id, media_type FROM plex_library").all() as { tmdb_id: number; media_type: string }[];
  return new Set(rows.map((r) => `${r.tmdb_id}:${r.media_type}`));
}
