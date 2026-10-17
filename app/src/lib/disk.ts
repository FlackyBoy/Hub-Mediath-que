import { lstat, readdir, statfs } from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import { kindOf, mediaDirs, mediaRoot, type EntryKind } from "./files";

// Analyse de l'espace disque : parcourt les dossiers autorisés et enregistre
// la taille de chaque dossier, la répartition par type et les plus gros fichiers.

export type ScanInfo = {
  status: "never" | "running" | "done" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  files: number;
  size: number;
};

export type TopFile = { rel: string; size: number; mtime: number; kind: EntryKind };

const TOP_FILES = 100;
const globalForScan = globalThis as unknown as { hubScan?: Promise<void> };

export async function diskUsage(): Promise<{ total: number; free: number; used: number } | null> {
  try {
    const s = await statfs(mediaRoot());
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return { total, free, used: total - s.bfree * s.bsize };
  } catch {
    return null;
  }
}

export function getScanInfo(): ScanInfo {
  const row = getDb()
    .prepare("SELECT status, started_at, finished_at, error, files, size FROM disk_scan WHERE id = 1")
    .get() as
    | { status: ScanInfo["status"]; started_at: string; finished_at: string; error: string; files: number; size: number }
    | undefined;
  if (!row) return { status: "never", startedAt: null, finishedAt: null, error: null, files: 0, size: 0 };
  // Analyse interrompue par un redémarrage de l'app
  const status = row.status === "running" && !globalForScan.hubScan ? "error" : row.status;
  return {
    status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: status === "error" && !row.error ? "Analyse interrompue" : row.error,
    files: row.files ?? 0,
    size: row.size ?? 0,
  };
}

export function getDirSizes(rels: string[]): Map<string, { size: number; files: number }> {
  const result = new Map<string, { size: number; files: number }>();
  if (rels.length === 0) return result;
  const stmt = getDb().prepare("SELECT size, files FROM dir_sizes WHERE rel = ?");
  for (const rel of rels) {
    const row = stmt.get(rel) as { size: number; files: number } | undefined;
    if (row) result.set(rel, row);
  }
  return result;
}

export function getTypeBreakdown(): { kind: EntryKind; size: number; files: number }[] {
  return getDb().prepare("SELECT kind, size, files FROM disk_types ORDER BY size DESC").all() as {
    kind: EntryKind;
    size: number;
    files: number;
  }[];
}

// Sous-dossiers directs des dossiers racines (ex. download/series), du plus gros au plus petit
export function getCategoryFolders(): { rel: string; size: number; files: number }[] {
  return getDb()
    .prepare(
      `SELECT rel, size, files FROM dir_sizes
       WHERE length(rel) - length(replace(rel, '/', '')) = 1 ORDER BY size DESC`,
    )
    .all() as { rel: string; size: number; files: number }[];
}

export function getTopFiles(limit = 20): TopFile[] {
  return getDb()
    .prepare("SELECT rel, size, mtime, kind FROM disk_files_top ORDER BY size DESC LIMIT ?")
    .all(limit) as TopFile[];
}

function likePrefix(rel: string): string {
  return rel.replace(/[\\%_]/g, (m) => `\\${m}`) + "/%";
}

// Met à jour les tailles enregistrées après une suppression, sans relancer d'analyse.
export function recordDeletion(rel: string, size: number, files: number) {
  const db = getDb();
  const segments = rel.split("/");
  db.exec("BEGIN");
  try {
    const update = db.prepare(
      "UPDATE dir_sizes SET size = MAX(0, size - ?), files = MAX(0, files - ?) WHERE rel = ?",
    );
    for (let i = 1; i < segments.length; i++) update.run(size, files, segments.slice(0, i).join("/"));
    db.prepare("DELETE FROM dir_sizes WHERE rel = ? OR rel LIKE ? ESCAPE '\\'").run(rel, likePrefix(rel));
    db.prepare("DELETE FROM disk_files_top WHERE rel = ? OR rel LIKE ? ESCAPE '\\'").run(rel, likePrefix(rel));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function recordRename(oldRel: string, newRel: string) {
  const db = getDb();
  for (const table of ["dir_sizes", "disk_files_top"]) {
    db.prepare(
      `UPDATE ${table} SET rel = ? || substr(rel, ?) WHERE rel = ? OR rel LIKE ? ESCAPE '\\'`,
    ).run(newRel, oldRel.length + 1, oldRel, likePrefix(oldRel));
  }
}

export function isScanRunning(): boolean {
  return Boolean(globalForScan.hubScan);
}

export function startScan(): boolean {
  if (globalForScan.hubScan) return false;
  globalForScan.hubScan = runScan().finally(() => {
    globalForScan.hubScan = undefined;
  });
  return true;
}

async function runScan() {
  const db = getDb();
  db.prepare(
    `INSERT INTO disk_scan (id, status, started_at, finished_at, error) VALUES (1, 'running', datetime('now'), NULL, NULL)
     ON CONFLICT(id) DO UPDATE SET status = 'running', started_at = datetime('now'), finished_at = NULL, error = NULL`,
  ).run();

  const dirs: { rel: string; size: number; files: number }[] = [];
  const types = new Map<EntryKind, { size: number; files: number }>();
  let top: TopFile[] = [];

  async function walk(abs: string, rel: string): Promise<{ size: number; files: number }> {
    let size = 0;
    let files = 0;
    let dirents;
    try {
      dirents = await readdir(abs, { withFileTypes: true });
    } catch {
      dirs.push({ rel, size: 0, files: 0 }); // dossier illisible
      return { size: 0, files: 0 };
    }

    const fileEntries = dirents.filter((d) => d.isFile());
    for (let i = 0; i < fileEntries.length; i += 64) {
      const batch = fileEntries.slice(i, i + 64);
      const stats = await Promise.all(batch.map((d) => lstat(path.join(/* turbopackIgnore: true */ abs, d.name)).catch(() => null)));
      stats.forEach((st, j) => {
        if (!st) return;
        const name = batch[j].name;
        const kind = kindOf(name);
        size += st.size;
        files++;
        const t = types.get(kind) ?? { size: 0, files: 0 };
        t.size += st.size;
        t.files++;
        types.set(kind, t);
        top.push({ rel: `${rel}/${name}`, size: st.size, mtime: Math.round(st.mtimeMs), kind });
      });
      if (top.length > TOP_FILES * 20) top = top.sort((a, b) => b.size - a.size).slice(0, TOP_FILES);
    }

    // Les liens symboliques sont ignorés (pas de double comptage, pas de boucle)
    for (const d of dirents) {
      if (!d.isDirectory()) continue;
      const child = await walk(path.join(/* turbopackIgnore: true */ abs, d.name), `${rel}/${d.name}`);
      size += child.size;
      files += child.files;
    }
    dirs.push({ rel, size, files });
    return { size, files };
  }

  try {
    let totalSize = 0;
    let totalFiles = 0;
    for (const root of mediaDirs()) {
      const r = await walk(path.join(/* turbopackIgnore: true */ mediaRoot(), root), root);
      totalSize += r.size;
      totalFiles += r.files;
    }
    top = top.sort((a, b) => b.size - a.size).slice(0, TOP_FILES);

    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM dir_sizes; DELETE FROM disk_types; DELETE FROM disk_files_top;");
      const insDir = db.prepare("INSERT INTO dir_sizes (rel, size, files) VALUES (?, ?, ?)");
      for (const d of dirs) insDir.run(d.rel, d.size, d.files);
      const insType = db.prepare("INSERT INTO disk_types (kind, size, files) VALUES (?, ?, ?)");
      for (const [kind, t] of types) insType.run(kind, t.size, t.files);
      const insTop = db.prepare("INSERT INTO disk_files_top (rel, size, mtime, kind) VALUES (?, ?, ?, ?)");
      for (const f of top) insTop.run(f.rel, f.size, f.mtime, f.kind);
      db.prepare(
        "UPDATE disk_scan SET status = 'done', finished_at = datetime('now'), files = ?, size = ? WHERE id = 1",
      ).run(totalFiles, totalSize);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Analyse du disque échouée", error);
    db.prepare("UPDATE disk_scan SET status = 'error', finished_at = datetime('now'), error = ? WHERE id = 1").run(
      (error as Error).message,
    );
  }
}
