import type { BggGame } from "./bgg";
import { getDb } from "./db";
import { isGameStatus, type GameSort, type GameStatus } from "./game-labels";

// Jeux de société de l'utilisateur : statut, note, avis, parties jouées.
// Les infos (image, joueurs, durée, complexité...) viennent de BoardGameGeek.

export type MetaState = "pending" | "ok" | "doubtful" | "missing";

export type Game = {
  id: number;
  bgg_id: number | null;
  title: string;
  bgg_name: string;
  year: number | null;
  image: string | null;
  thumbnail: string | null;
  min_players: number | null;
  max_players: number | null;
  best_players: string;
  min_time: number | null;
  max_time: number | null;
  min_age: number | null;
  weight: number | null;
  bgg_rating: number | null;
  bgg_rank: number | null;
  categories: string;
  mechanics: string;
  designers: string;
  publisher: string;
  description: string;
  status: GameStatus;
  rating: number | null;
  notes: string;
  plays: number;
  last_played: string | null;
  meta: MetaState;
  created_at: string;
  updated_at: string;
};

// Champs saisis par l'utilisateur (formulaire, import)
export type GameInput = {
  title: string;
  status: GameStatus;
  rating: number | null;
  notes: string;
  plays: number;
  bgg_id: number | null;
  min_players: number | null;
  max_players: number | null;
  min_time: number | null;
  max_time: number | null;
  year: number | null;
  publisher: string;
};

export type GameFilters = {
  q?: string;
  status?: string;
  players?: number;
  maxTime?: number;
  minRating?: number;
  tag?: string;
  sort?: GameSort;
};

function toInt(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(String(v).replace(",", ".")));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function sanitizeGame(raw: Record<string, unknown>): GameInput {
  const title = String(raw.title ?? "").trim().slice(0, 300);
  if (!title) throw new Error("Le nom du jeu est obligatoire");
  return {
    title,
    status: isGameStatus(raw.status) ? raw.status : "possede",
    rating: toInt(raw.rating, 0, 10),
    notes: String(raw.notes ?? "").trim().slice(0, 10000),
    plays: toInt(raw.plays, 0, 100000) ?? 0,
    bgg_id: toInt(raw.bgg_id, 1, 100_000_000),
    min_players: toInt(raw.min_players, 1, 100),
    max_players: toInt(raw.max_players, 1, 100),
    min_time: toInt(raw.min_time, 1, 10000),
    max_time: toInt(raw.max_time, 1, 10000),
    year: toInt(raw.year, 0, 2100),
    publisher: String(raw.publisher ?? "").trim().slice(0, 200),
  };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findDuplicateGame(title: string, bggId?: number | null): number | null {
  const db = getDb();
  if (bggId) {
    const row = db.prepare("SELECT id FROM games WHERE bgg_id = ?").get(bggId) as { id: number } | undefined;
    if (row) return row.id;
  }
  const t = normalize(title);
  if (!t) return null;
  const rows = db.prepare("SELECT id, title, bgg_name FROM games").all() as { id: number; title: string; bgg_name: string }[];
  return rows.find((r) => normalize(r.title) === t || (r.bgg_name && normalize(r.bgg_name) === t))?.id ?? null;
}

export function createGame(input: GameInput, meta: MetaState = "pending"): number {
  const r = getDb()
    .prepare(
      `INSERT INTO games (title, status, rating, notes, plays, bgg_id, min_players, max_players, min_time, max_time, year, publisher, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.title, input.status, input.rating, input.notes, input.plays, input.bgg_id, input.min_players, input.max_players,
      input.min_time, input.max_time, input.year, input.publisher, meta);
  return Number(r.lastInsertRowid);
}

type Patch = Partial<Omit<Game, "id" | "created_at" | "updated_at">>;

export function updateGame(id: number, patch: Patch) {
  const keys = Object.keys(patch) as (keyof Patch)[];
  if (!keys.length) return;
  getDb()
    .prepare(`UPDATE games SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => patch[k] ?? null), id);
}

// Infos BGG : remplacent les précédentes, sauf le titre choisi par l'utilisateur.
// Joueurs, durée, année et éditeur saisis à la main ne sont complétés que s'ils sont vides.
export function applyBgg(id: number, g: BggGame, meta: MetaState) {
  const cur = getGame(id);
  if (!cur) return;
  // Un autre jeu de la liste a déjà cette fiche BGG : on ne la rattache pas deux fois
  const taken = getDb().prepare("SELECT id FROM games WHERE bgg_id = ? AND id != ?").get(g.bggId, id);
  if (taken) {
    updateGame(id, { meta: "missing" });
    return;
  }
  updateGame(id, {
    bgg_id: g.bggId,
    bgg_name: g.name,
    year: cur.year ?? g.year,
    image: g.image,
    thumbnail: g.thumbnail,
    min_players: cur.min_players ?? g.minPlayers,
    max_players: cur.max_players ?? g.maxPlayers,
    best_players: g.bestPlayers,
    min_time: cur.min_time ?? g.minTime,
    max_time: cur.max_time ?? g.maxTime,
    min_age: g.minAge,
    weight: g.weight ? Math.round(g.weight * 100) / 100 : null,
    bgg_rating: g.rating,
    bgg_rank: g.rank,
    categories: g.categories.join(", "),
    mechanics: g.mechanics.join(", "),
    designers: g.designers.slice(0, 6).join(", "),
    publisher: cur.publisher || g.publishers[0] || "",
    description: g.description.slice(0, 8000),
    meta,
  });
}

export function deleteGame(id: number) {
  getDb().prepare("DELETE FROM games WHERE id = ?").run(id);
}

export function getGame(id: number): Game | null {
  return (getDb().prepare("SELECT * FROM games WHERE id = ?").get(id) as Game | undefined) ?? null;
}

const SORT_SQL: Record<GameSort, string> = {
  titre: "title COLLATE NOCASE",
  note: "rating IS NULL, rating DESC, title COLLATE NOCASE",
  ajout: "created_at DESC, id DESC",
  parties: "plays DESC, title COLLATE NOCASE",
  duree: "COALESCE(max_time, min_time) IS NULL, COALESCE(max_time, min_time), title COLLATE NOCASE",
  complexite: "weight IS NULL, weight, title COLLATE NOCASE",
};

export function listGames(f: GameFilters): Game[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.status && isGameStatus(f.status)) {
    where.push("status = ?");
    params.push(f.status);
  }
  if (f.players && Number.isFinite(f.players)) {
    // Jouable au nombre demandé (bornes inconnues = on garde le jeu)
    where.push("(min_players IS NULL OR min_players <= ?) AND (max_players IS NULL OR max_players >= ?)");
    params.push(f.players, f.players);
  }
  if (f.maxTime && Number.isFinite(f.maxTime)) {
    where.push("COALESCE(max_time, min_time) <= ?");
    params.push(f.maxTime);
  }
  if (f.minRating !== undefined && Number.isFinite(f.minRating)) {
    where.push("rating >= ?");
    params.push(f.minRating);
  }
  const rows = getDb()
    .prepare(`SELECT * FROM games ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${SORT_SQL[f.sort ?? "titre"]}`)
    .all(...params) as Game[];
  // Recherche et catégorie/mécanique : filtrées ici, sans tenir compte des accents
  const q = f.q ? normalize(f.q) : "";
  const tag = f.tag ? normalize(f.tag) : "";
  return rows.filter(
    (g) =>
      (!q || q.split(" ").every((w) => normalize(`${g.title} ${g.bgg_name} ${g.designers} ${g.publisher}`).includes(w))) &&
      (!tag || normalize(`${g.categories} ${g.mechanics}`).includes(tag)),
  );
}

export function gameCounts(): Record<GameStatus, number> {
  const counts: Record<GameStatus, number> = { possede: 0, envie: 0, ancien: 0 };
  const rows = getDb().prepare("SELECT status, COUNT(*) AS n FROM games GROUP BY status").all() as { status: GameStatus; n: number }[];
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export function gamesNeedingMeta(): number | null {
  const row = getDb().prepare("SELECT id FROM games WHERE meta = 'pending' ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function metaStats(): Record<MetaState, number> {
  const stats: Record<MetaState, number> = { pending: 0, ok: 0, doubtful: 0, missing: 0 };
  const rows = getDb().prepare("SELECT meta, COUNT(*) AS n FROM games GROUP BY meta").all() as { meta: MetaState; n: number }[];
  for (const r of rows) stats[r.meta] = r.n;
  return stats;
}

// Catégories et mécaniques les plus présentes dans la ludothèque (filtres rapides)
export function topTags(limit = 12): string[] {
  const rows = getDb().prepare("SELECT categories, mechanics FROM games WHERE status = 'possede'").all() as { categories: string; mechanics: string }[];
  const count = new Map<string, number>();
  for (const r of rows)
    for (const t of `${r.categories},${r.mechanics}`.split(","))
      if (t.trim()) count.set(t.trim(), (count.get(t.trim()) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}
