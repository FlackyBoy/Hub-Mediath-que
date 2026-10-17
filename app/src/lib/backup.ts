import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";
import { createGzip } from "node:zlib";
import { getDb } from "./db";

// Sauvegardes : archive .tar.gz contenant une copie cohérente de la base (VACUUM INTO)
// et les couvertures. Une par nuit vers 4 h, 10 conservées, téléchargeables depuis Réglages.

const KEEP = 10;
const NAME_RE = /^hub-\d{4}-\d{2}-\d{2}-\d{4}\.tar\.gz$/;

function dataDir(): string {
  const db = process.env.DATABASE_PATH ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "data", "hub.sqlite");
  return path.dirname(db);
}

export function backupDir(): string {
  const dir = path.join(/* turbopackIgnore: true */ dataDir(), "backups");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function isBackupName(name: string): boolean {
  return NAME_RE.test(name);
}

// En-tête tar (format ustar) pour un fichier
function tarHeader(name: string, size: number, mtime: number): Buffer {
  const h = Buffer.alloc(512);
  const put = (value: string, offset: number, length: number) => h.write(value, offset, length, "utf8");
  const octal = (n: number, length: number) => n.toString(8).padStart(length - 1, "0") + "\0";
  put(name, 0, 100);
  put("0000644\0", 100, 8);
  put(octal(0, 8), 108, 8);
  put(octal(0, 8), 116, 8);
  put(octal(size, 12), 124, 12);
  put(octal(Math.floor(mtime / 1000), 12), 136, 12);
  put("        ", 148, 8); // somme de contrôle calculée avec des espaces
  put("0", 156, 1);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  let sum = 0;
  for (const byte of h) sum += byte;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}

async function* tarEntries(files: { name: string; file: string }[]): AsyncGenerator<Buffer> {
  for (const f of files) {
    const st = await stat(f.file);
    yield tarHeader(f.name, st.size, st.mtimeMs);
    for await (const chunk of createReadStream(f.file)) yield chunk as Buffer;
    const pad = (512 - (st.size % 512)) % 512;
    if (pad) yield Buffer.alloc(pad);
  }
  yield Buffer.alloc(1024); // fin d'archive
}

export type BackupInfo = { name: string; size: number; createdAt: string };

export async function listBackups(): Promise<BackupInfo[]> {
  const dir = backupDir();
  const names = (await readdir(dir)).filter(isBackupName).sort().reverse();
  return Promise.all(
    names.map(async (name) => {
      const st = await stat(path.join(/* turbopackIgnore: true */ dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    }),
  );
}

function stamp(d = new Date()): string {
  const local = new Date(d.toLocaleString("en-US", { timeZone: process.env.TZ || "Europe/Paris" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${local.getFullYear()}-${p(local.getMonth() + 1)}-${p(local.getDate())}-${p(local.getHours())}${p(local.getMinutes())}`;
}

const globalForBackup = globalThis as unknown as { hubBackup?: Promise<BackupInfo>; hubBackupTimer?: NodeJS.Timeout };

export function createBackup(): Promise<BackupInfo> {
  globalForBackup.hubBackup ??= runBackup().finally(() => {
    globalForBackup.hubBackup = undefined;
  });
  return globalForBackup.hubBackup;
}

async function runBackup(): Promise<BackupInfo> {
  const dir = backupDir();
  const name = `hub-${stamp()}.tar.gz`;
  const snapshot = path.join(/* turbopackIgnore: true */ dir, `.snapshot-${Date.now()}.sqlite`);
  const partial = path.join(/* turbopackIgnore: true */ dir, `.${name}.partial`);
  try {
    // Copie cohérente même pendant que l'app écrit, puis vérification d'intégrité
    getDb().exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    const check = new DatabaseSync(snapshot, { readOnly: true });
    const result = (check.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
    check.close();
    if (result !== "ok") throw new Error(`Copie de la base invalide : ${result}`);

    const files = [{ name: "hub.sqlite", file: snapshot }];
    const coversDir = path.join(/* turbopackIgnore: true */ dataDir(), "covers");
    const covers = await readdir(coversDir).catch(() => [] as string[]);
    for (const c of covers.filter((n) => /^\d+$/.test(n))) files.push({ name: `covers/${c}`, file: path.join(/* turbopackIgnore: true */ coversDir, c) });

    await pipeline(Readable.from(tarEntries(files)), createGzip({ level: 6 }), createWriteStream(partial));
    const final = path.join(/* turbopackIgnore: true */ dir, name);
    await rename(partial, final);

    // Rotation : on garde les plus récentes
    const all = (await readdir(dir)).filter(isBackupName).sort().reverse();
    for (const old of all.slice(KEEP)) await rm(path.join(/* turbopackIgnore: true */ dir, old), { force: true });

    const st = await stat(final);
    getDb()
      .prepare("INSERT INTO settings (key, value) VALUES ('backup.last', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify({ name, at: new Date().toISOString() }));
    return { name, size: st.size, createdAt: st.mtime.toISOString() };
  } finally {
    await rm(snapshot, { force: true });
    await rm(partial, { force: true });
  }
}

export function lastBackupError(): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'backup.error'").get() as { value: string } | undefined;
  return row?.value ?? null;
}

// Sauvegarde quotidienne : vérification toutes les 30 min, déclenchée après 4 h si pas encore faite ce jour-là
export function startBackupSchedule() {
  if (globalForBackup.hubBackupTimer) return;
  const tick = async () => {
    const today = stamp().slice(0, 10);
    const hour = Number(stamp().slice(11, 13));
    const done = (await listBackups().catch(() => [])).some((b) => b.name.startsWith(`hub-${today}`));
    if (done || hour < 4) return;
    try {
      await createBackup();
      getDb().prepare("DELETE FROM settings WHERE key = 'backup.error'").run();
    } catch (error) {
      console.error("Sauvegarde automatique échouée", error);
      getDb()
        .prepare("INSERT INTO settings (key, value) VALUES ('backup.error', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(`${new Date().toISOString().slice(0, 16)} : ${(error as Error).message}`);
    }
  };
  globalForBackup.hubBackupTimer = setInterval(() => void tick(), 30 * 60_000);
  setTimeout(() => void tick(), 2 * 60_000);
}
