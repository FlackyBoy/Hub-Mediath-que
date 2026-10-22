import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { createBook, findDuplicate, inferType, sanitizeBook } from "./books";
import { getDb } from "./db";
import { resolvePath } from "./files";
import { getSetting, setSetting } from "./settings";

// Livres numériques déposés sur le serveur (epub, pdf, BD en cbz...) : les dossiers choisis
// sont parcourus, et les fichiers absents de la bibliothèque sont proposés à l'ajout.

const BOOK_EXTS = new Set(["epub", "mobi", "azw3", "pdf", "cbz", "cbr", "cb7", "djvu"]);
const COMIC_EXTS = new Set(["cbz", "cbr", "cb7"]);
const MAX_FILES = 20000;
const MAX_DEPTH = 8;

export type BookFile = { rel: string; title: string; author: string; ext: string; size: number; status: string; book_id: number | null; found_at: string };

// Par défaut : download/livre, le dossier de livres du serveur
export function bookDirs(): string[] {
  return (getSetting("books.dirs") ?? "download/livre").split("\n").map((s) => s.trim()).filter(Boolean);
}

// Dossiers relatifs à MEDIA_ROOT (ex. download/livres), un par ligne ; vérifiés avant enregistrement
export async function setBookDirs(input: string): Promise<string[]> {
  const dirs = [...new Set(input.split(/[\n,]/).map((s) => s.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean))];
  for (const d of dirs) {
    const { abs } = await resolvePath(d).catch(() => {
      throw new Error(`Dossier introuvable ou non autorisé : ${d}`);
    });
    if (!(await stat(abs)).isDirectory()) throw new Error(`Ce n'est pas un dossier : ${d}`);
  }
  setSetting("books.dirs", dirs.join("\n"));
  return dirs;
}

/* ---------- titre et auteur ---------- */

function clean(s: string): string {
  return s
    .replace(/\[[^\]]*\]|\{[^}]*\}/g, " ") // [Ebook FR], {epub}...
    .replace(/\((?:19|20)\d\d\)|\((?:fr|french|vf|ebook|epub|pdf)[^)]*\)/gi, " ")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–\s]+|[-–\s]+$/g, "");
}

// « Auteur - Titre.epub » (convention la plus courante) ; BD : le nom entier est le titre
function fromFilename(name: string, ext: string): { title: string; author: string } {
  const base = clean(path.basename(name, path.extname(name)));
  if (COMIC_EXTS.has(ext)) return { title: base, author: "" };
  const parts = base.split(/\s+[-–]\s+/);
  if (parts.length >= 2 && parts[0].split(" ").length <= 4) return { author: parts[0], title: parts.slice(1).join(" - ") };
  return { title: base, author: "" };
}

const decodeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e: string) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e.toLowerCase()] ??
    (e[1] === "x" || e[1] === "X" ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(Number(e.slice(1)))),
  ).trim();

// Lecture minimale d'un zip (epub) : seuls le répertoire central et deux petits fichiers sont lus
async function readZipEntries(file: string, wanted: (name: string) => boolean): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  const fh = await open(file, "r");
  try {
    const { size } = await fh.stat();
    const tailLen = Math.min(size, 66000);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) return out;
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdSize > 10 * 1024 * 1024) return out;
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdOffset);
    for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50; ) {
      const method = cd.readUInt16LE(p + 10);
      const compSize = cd.readUInt32LE(p + 20);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const localOffset = cd.readUInt32LE(p + 42);
      const name = cd.toString("utf8", p + 46, p + 46 + nameLen);
      p += 46 + nameLen + extraLen + commentLen;
      if (!wanted(name) || compSize > 2 * 1024 * 1024) continue;
      const local = Buffer.alloc(30);
      await fh.read(local, 0, 30, localOffset);
      const dataStart = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const data = Buffer.alloc(compSize);
      await fh.read(data, 0, compSize, dataStart);
      if (method === 0) out.set(name, data);
      else if (method === 8) out.set(name, inflateRawSync(data));
    }
  } finally {
    await fh.close();
  }
  return out;
}

async function fromEpub(file: string): Promise<{ title: string; author: string } | null> {
  try {
    const container = (await readZipEntries(file, (n) => n === "META-INF/container.xml")).get("META-INF/container.xml");
    const opfPath = container?.toString("utf8").match(/full-path="([^"]+)"/)?.[1];
    if (!opfPath) return null;
    const opf = (await readZipEntries(file, (n) => n === opfPath)).get(opfPath)?.toString("utf8");
    if (!opf) return null;
    const title = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/)?.[1];
    const author = opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/)?.[1];
    return title ? { title: decodeXml(title), author: author ? decodeXml(author) : "" } : null;
  } catch {
    return null;
  }
}

/* ---------- parcours ---------- */

async function walk(rel: string, abs: string, depth: number, found: { rel: string; abs: string; size: number }[]) {
  if (depth > MAX_DEPTH || found.length >= MAX_FILES) return;
  let dirents;
  try {
    dirents = await readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    if (d.name.startsWith(".") || found.length >= MAX_FILES) continue;
    const childRel = `${rel}/${d.name}`;
    const childAbs = path.join(/* turbopackIgnore: true */ abs, d.name);
    if (d.isDirectory()) await walk(childRel, childAbs, depth + 1, found);
    else if (d.isFile() && BOOK_EXTS.has(path.extname(d.name).slice(1).toLowerCase())) {
      const st = await stat(childAbs).catch(() => null);
      if (st) found.push({ rel: childRel, abs: childAbs, size: st.size });
    }
  }
}

export type ScanResult = { scanned: number; added: number; alreadyInLibrary: number; removed: number; at: string };

const globalForScan = globalThis as unknown as { hubBookScan?: Promise<ScanResult>; hubBookScanTimer?: NodeJS.Timeout };

export function scanBookFiles(): Promise<ScanResult> {
  return (globalForScan.hubBookScan ??= runScan().finally(() => {
    globalForScan.hubBookScan = undefined;
  }));
}

async function runScan(): Promise<ScanResult> {
  const db = getDb();
  const found: { rel: string; abs: string; size: number }[] = [];
  for (const dir of bookDirs()) {
    try {
      const { rel, abs } = await resolvePath(dir);
      await walk(rel, abs, 0, found);
    } catch {
      // dossier supprimé depuis : ignoré
    }
  }
  const known = new Set((db.prepare("SELECT rel FROM book_files").all() as { rel: string }[]).map((r) => r.rel));
  const at = new Date().toISOString().replace("T", " ").slice(0, 19); // format SQLite (formatRelative)
  const result: ScanResult = { scanned: found.length, added: 0, alreadyInLibrary: 0, removed: 0, at };
  const insert = db.prepare("INSERT OR IGNORE INTO book_files (rel, title, author, ext, size, status, book_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const f of found) {
    if (known.has(f.rel)) continue;
    const ext = path.extname(f.rel).slice(1).toLowerCase();
    const meta = (ext === "epub" ? await fromEpub(f.abs) : null) ?? fromFilename(f.rel, ext);
    // Déjà dans la bibliothèque (import du Sheet, ajout à la main) : rattaché sans être proposé
    const existing = findDuplicate(meta.title, meta.author);
    insert.run(f.rel, meta.title.slice(0, 300), meta.author.slice(0, 200), ext, f.size, existing ? "linked" : "new", existing);
    if (existing) result.alreadyInLibrary++;
    else result.added++;
  }
  // Proposés lors d'une analyse précédente, ajoutés depuis par le Sheet ou à la main
  for (const f of newBookFiles()) {
    const existing = findDuplicate(f.title, f.author);
    if (existing) db.prepare("UPDATE book_files SET status = 'linked', book_id = ? WHERE rel = ?").run(existing, f.rel);
  }
  // Fichiers proposés puis supprimés ou déplacés du serveur
  const present = new Set(found.map((f) => f.rel));
  for (const rel of known) {
    if (!present.has(rel) && db.prepare("DELETE FROM book_files WHERE rel = ? AND status = 'new'").run(rel).changes) result.removed++;
  }
  setSetting("books.scan", JSON.stringify(result));
  return result;
}

export function lastScan(): ScanResult | null {
  const v = getSetting("books.scan");
  return v ? JSON.parse(v) : null;
}

export function newBookFiles(): BookFile[] {
  const rows = getDb().prepare("SELECT * FROM book_files WHERE status = 'new' ORDER BY rel").all() as BookFile[];
  // node:sqlite renvoie des objets sans prototype : React refuse de les passer aux composants client
  return rows.map((r) => ({ ...r }));
}

export function countNewBookFiles(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM book_files WHERE status = 'new'").get() as { n: number }).n;
}

export function fileOfBook(bookId: number): string | null {
  const row = getDb().prepare("SELECT rel FROM book_files WHERE book_id = ? ORDER BY rel LIMIT 1").get(bookId) as { rel: string } | undefined;
  return row?.rel ?? null;
}

// Ajoute un fichier proposé à la bibliothèque (titre / auteur éventuellement corrigés)
export function addBookFromFile(rel: string, title: string, author: string): number {
  const f = getDb().prepare("SELECT * FROM book_files WHERE rel = ?").get(rel) as BookFile | undefined;
  if (!f) throw new Error("Fichier inconnu");
  const input = sanitizeBook({ title, author, status: "a_lire", type: COMIC_EXTS.has(f.ext) ? "bd" : inferType("") });
  const id = findDuplicate(input.title, input.author) ?? createBook(input);
  getDb().prepare("UPDATE book_files SET status = 'linked', book_id = ? WHERE rel = ?").run(id, rel);
  return id;
}

export function ignoreBookFile(rel: string) {
  getDb().prepare("UPDATE book_files SET status = 'ignored' WHERE rel = ?").run(rel);
}

// Nouvelle analyse toutes les 6 heures (et peu après le démarrage)
export function startBookScanSchedule() {
  if (globalForScan.hubBookScanTimer) return;
  const tick = () => {
    if (bookDirs().length) scanBookFiles().catch((e) => console.error("Analyse des livres échouée", e));
  };
  setTimeout(tick, 60_000);
  globalForScan.hubBookScanTimer = setInterval(tick, 6 * 3600_000);
}
