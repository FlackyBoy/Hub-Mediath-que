import path from "node:path";
import { getDb } from "./db";
import { mediaDirs, mediaRoot } from "./files";
import type { Category } from "./prowlarr";
import { sendPushToAll } from "./push";
import { listTorrents } from "./rtorrent";

// Téléchargements lancés depuis le Hub : dossier par défaut par catégorie,
// suivi et notification à la fin.

const FALLBACK_DEST: Record<Category, string> = {
  films: "download/films",
  series: "download/series",
  autres: "download",
};

const ENV_DEST: Record<Category, string | undefined> = {
  films: process.env.DOWNLOAD_DIR_FILMS,
  series: process.env.DOWNLOAD_DIR_SERIES,
  autres: process.env.DOWNLOAD_DIR_AUTRES,
};

// Chemin absolu du serveur -> chemin "rel" (download/...), ou null s'il sort des dossiers autorisés
export function toRel(abs: string): string | null {
  const relative = path.posix.relative(mediaRoot().replace(/\\/g, "/"), abs.replace(/\\/g, "/"));
  if (!relative || relative.startsWith("..") || path.posix.isAbsolute(relative)) return null;
  return mediaDirs().includes(relative.split("/")[0]) ? relative : null;
}

export function getDefaultDest(category: Category): string {
  const saved = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(`dest.${category}`) as
    | { value: string }
    | undefined;
  if (saved) return saved.value;
  const env = ENV_DEST[category];
  return (env && (env.startsWith("/") ? toRel(env) : env)) || FALLBACK_DEST[category];
}

export function setDefaultDest(category: Category, rel: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`dest.${category}`, rel);
}

export function trackDownload(hash: string, name: string, category: Category, dest: string) {
  getDb()
    .prepare(
      `INSERT INTO downloads (hash, name, category, dest) VALUES (?, ?, ?, ?)
       ON CONFLICT(hash) DO UPDATE SET name = excluded.name, dest = excluded.dest, notified = 0, completed_at = NULL`,
    )
    .run(hash, name, category, dest);
}

export function hubHashes(): Set<string> {
  const rows = getDb().prepare("SELECT hash FROM downloads").all() as { hash: string }[];
  return new Set(rows.map((r) => r.hash));
}

async function checkCompleted() {
  const db = getDb();
  const pending = db
    .prepare("SELECT hash, name, added_at FROM downloads WHERE notified = 0")
    .all() as { hash: string; name: string; added_at: string }[];
  if (pending.length === 0) return;

  let torrents;
  try {
    torrents = await listTorrents();
  } catch {
    return; // rTorrent indisponible : on réessaiera
  }
  const byHash = new Map(torrents.map((t) => [t.hash, t]));
  for (const d of pending) {
    const t = byHash.get(d.hash);
    if (!t) {
      // Retiré de rTorrent avant la fin : on arrête de le suivre au bout d'une heure
      const age = Date.now() - new Date(d.added_at.replace(" ", "T") + "Z").getTime();
      if (age > 3600_000) db.prepare("UPDATE downloads SET notified = 2 WHERE hash = ?").run(d.hash);
      continue;
    }
    if (!t.complete) continue;
    db.prepare("UPDATE downloads SET notified = 1, completed_at = datetime('now') WHERE hash = ?").run(d.hash);
    try {
      await sendPushToAll({ title: "Téléchargement terminé", body: t.name, url: "/mediatheque" });
    } catch (error) {
      console.error("Notification de fin de téléchargement non envoyée", error);
    }
  }
}

const globalForWatcher = globalThis as unknown as { hubWatcher?: NodeJS.Timeout };

export function startDownloadWatcher() {
  if (globalForWatcher.hubWatcher) return;
  globalForWatcher.hubWatcher = setInterval(() => void checkCompleted(), 30_000);
  setTimeout(() => void checkCompleted(), 5_000);
}
