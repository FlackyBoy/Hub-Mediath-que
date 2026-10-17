import { getDb } from "./db";
import { getDetails, isTmdbConfigured } from "./tmdb";
import { upsertScreen } from "./screens";

// Synchronisation Plex -> Hub : index des films/séries présents dans Plex (pour le badge
// « Sur ton Plex ») et passage en « Vu » / « En cours » de ce qui a été regardé.
// Ne rétrograde jamais un statut et ne touche pas aux notes ni aux avis.

const PLEX = process.env.PLEX_URL || "http://127.0.0.1:32400";

export function isPlexConfigured(): boolean {
  return Boolean(process.env.PLEX_TOKEN);
}

type PlexItem = {
  title: string;
  type: "movie" | "show";
  viewCount?: number;
  leafCount?: number;
  viewedLeafCount?: number;
  Guid?: { id: string }[];
};

async function plex<T>(path: string): Promise<T> {
  const url = new URL(PLEX + path);
  url.searchParams.set("X-Plex-Token", process.env.PLEX_TOKEN ?? "");
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (res.status === 401) throw new Error("Jeton Plex refusé");
  if (!res.ok) throw new Error(`Plex a répondu ${res.status}`);
  return (await res.json()) as T;
}

export type PlexSyncResult = { items: number; watched: number; inProgress: number; added: number; at: string };

function setSetting(key: string, value: string) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function lastPlexSync(): PlexSyncResult | { error: string; at: string } | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'plex.last_sync'").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) : null;
}

const globalForPlex = globalThis as unknown as { hubPlexSync?: Promise<PlexSyncResult>; hubPlexTimer?: NodeJS.Timeout };

export function syncPlex(): Promise<PlexSyncResult> {
  globalForPlex.hubPlexSync ??= runSync()
    .catch((error) => {
      setSetting("plex.last_sync", JSON.stringify({ error: (error as Error).message, at: new Date().toISOString() }));
      throw error;
    })
    .finally(() => {
      globalForPlex.hubPlexSync = undefined;
    });
  return globalForPlex.hubPlexSync;
}

async function runSync(): Promise<PlexSyncResult> {
  const sections = await plex<{ MediaContainer: { Directory?: { key: string; type: string }[] } }>("/library/sections");
  const db = getDb();
  const result: PlexSyncResult = { items: 0, watched: 0, inProgress: 0, added: 0, at: "" };
  const seen: { tmdbId: number; type: "movie" | "tv"; title: string; viewed: boolean; progress: number }[] = [];

  for (const s of sections.MediaContainer.Directory ?? []) {
    if (s.type !== "movie" && s.type !== "show") continue;
    const data = await plex<{ MediaContainer: { Metadata?: PlexItem[] } }>(`/library/sections/${s.key}/all?includeGuids=1`);
    for (const item of data.MediaContainer.Metadata ?? []) {
      const tmdb = item.Guid?.find((g) => g.id.startsWith("tmdb://"));
      const tmdbId = tmdb ? Number(tmdb.id.slice(7)) : NaN;
      if (!Number.isInteger(tmdbId)) continue;
      const type = item.type === "movie" ? "movie" : "tv";
      const progress = type === "movie" ? ((item.viewCount ?? 0) > 0 ? 1 : 0) : (item.viewedLeafCount ?? 0) / Math.max(1, item.leafCount ?? 1);
      seen.push({ tmdbId, type, title: item.title, viewed: progress >= 1, progress });
    }
  }

  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM plex_library");
    const ins = db.prepare("INSERT OR REPLACE INTO plex_library (tmdb_id, media_type, title, viewed, progress) VALUES (?, ?, ?, ?, ?)");
    for (const x of seen) ins.run(x.tmdbId, x.type, x.title, x.viewed ? 1 : 0, x.progress);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  result.items = seen.length;

  // Statuts : Vu (film vu / série terminée), En cours (série entamée)
  const current = db.prepare("SELECT id, status FROM screens WHERE tmdb_id = ? AND media_type = ?");
  const promote = db.prepare("UPDATE screens SET status = ?, watched_at = COALESCE(watched_at, date('now')), updated_at = datetime('now') WHERE id = ?");
  for (const x of seen) {
    if (x.progress <= 0) continue;
    const target = x.viewed ? "vu" : "en_cours";
    if (x.viewed) result.watched++;
    else result.inProgress++;
    const row = current.get(x.tmdbId, x.type) as { id: number; status: string } | undefined;
    if (row) {
      // Pas de rétrogradation ; « Abandonné » reste un choix de l'utilisateur
      if (row.status === "a_voir" || row.status === "pas_interesse" || (row.status === "en_cours" && target === "vu")) promote.run(target, row.id);
    } else if (isTmdbConfigured()) {
      try {
        upsertScreen(await getDetails(x.type, x.tmdbId), target, { source: "plex" });
        result.added++;
      } catch (error) {
        console.error("Plex : fiche TMDB introuvable pour", x.title, error);
      }
    }
  }
  result.at = new Date().toISOString();
  setSetting("plex.last_sync", JSON.stringify(result));
  return result;
}

// Synchronisation automatique toutes les 6 heures
export function startPlexSchedule() {
  if (!isPlexConfigured() || globalForPlex.hubPlexTimer) return;
  globalForPlex.hubPlexTimer = setInterval(() => void syncPlex().catch(() => {}), 6 * 3600_000);
  setTimeout(() => void syncPlex().catch(() => {}), 60_000);
}
