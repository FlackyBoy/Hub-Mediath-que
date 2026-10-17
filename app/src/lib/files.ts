import { access, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

// Accès aux fichiers du serveur, limité aux dossiers MEDIA_DIRS sous MEDIA_ROOT.
// Les chemins "rel" utilisent "/" et commencent par le dossier racine (ex. "download/series").

export type EntryKind =
  | "dir"
  | "video"
  | "audio"
  | "image"
  | "book"
  | "archive"
  | "software"
  | "subtitle"
  | "text"
  | "other";

export const KIND_LABELS: Record<EntryKind, string> = {
  dir: "Dossiers",
  video: "Vidéos",
  audio: "Musique",
  image: "Images",
  book: "Livres et BD",
  archive: "Archives",
  software: "Logiciels et jeux",
  subtitle: "Sous-titres",
  text: "Textes",
  other: "Autres",
};

const EXTENSIONS: Record<Exclude<EntryKind, "dir" | "other">, string[]> = {
  video: ["mkv", "mp4", "avi", "mov", "m4v", "wmv", "flv", "webm", "ts", "m2ts", "mpg", "mpeg", "vob"],
  audio: ["mp3", "flac", "aac", "m4a", "ogg", "opus", "wav", "wma", "alac", "m4b"],
  image: ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "tif", "tiff", "svg"],
  book: ["epub", "mobi", "azw3", "pdf", "cbz", "cbr", "cb7", "djvu"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"],
  software: ["iso", "exe", "msi", "dmg", "apk", "img", "bin", "nsp", "xci", "pkg", "unitypackage"],
  subtitle: ["srt", "ass", "ssa", "sub", "idx", "vtt"],
  text: ["txt", "nfo", "md", "log", "json", "xml", "csv", "ini", "cfg", "sfv"],
};

const KIND_BY_EXT = new Map<string, EntryKind>(
  Object.entries(EXTENSIONS).flatMap(([kind, exts]) => exts.map((e) => [e, kind as EntryKind])),
);

export function kindOf(name: string): EntryKind {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (/^r\d\d$/.test(ext)) return "archive"; // archives rar découpées (.r00, .r01...)
  return KIND_BY_EXT.get(ext) ?? "other";
}

export class FileError extends Error {}

export function mediaRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_ROOT ?? "/home/viou");
}

export function mediaDirs(): string[] {
  return (process.env.MEDIA_DIRS ?? "download,films")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== ".." && !/[\\/]/.test(s));
}

function splitRel(rel: string): string[] {
  const segments = rel.replace(/\\/g, "/").split("/").filter(Boolean);
  if (segments.some((s) => s === "." || s === "..")) throw new FileError("Chemin invalide");
  return segments;
}

export type Resolved = { rel: string; abs: string; segments: string[] };

// Vérifie que le chemin reste dans un dossier autorisé, liens symboliques compris.
export async function resolvePath(rel: string): Promise<Resolved> {
  const segments = splitRel(rel);
  if (segments.length === 0 || !mediaDirs().includes(segments[0])) {
    throw new FileError("Dossier non autorisé");
  }
  const abs = path.join(/* turbopackIgnore: true */ mediaRoot(), ...segments);
  let real: string;
  let rootReal: string;
  try {
    [real, rootReal] = await Promise.all([realpath(abs), realpath(path.join(/* turbopackIgnore: true */ mediaRoot(), segments[0]))]);
  } catch {
    throw new FileError("Introuvable");
  }
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) {
    throw new FileError("Chemin hors des dossiers autorisés");
  }
  return { rel: segments.join("/"), abs, segments };
}

export type Entry = { name: string; rel: string; kind: EntryKind; size: number; mtime: number };

export async function listDir(rel: string): Promise<Entry[]> {
  const { abs, rel: base } = await resolvePath(rel);
  const dirents = await readdir(abs, { withFileTypes: true });
  const entries = await Promise.all(
    dirents
      .filter((d) => !d.name.startsWith("."))
      .map(async (d): Promise<Entry | null> => {
        try {
          const st = await stat(path.join(/* turbopackIgnore: true */ abs, d.name));
          const isDir = st.isDirectory();
          return {
            name: d.name,
            rel: `${base}/${d.name}`,
            kind: isDir ? "dir" : kindOf(d.name),
            size: isDir ? 0 : st.size,
            mtime: st.mtimeMs,
          };
        } catch {
          return null; // lien cassé ou fichier disparu entre-temps
        }
      }),
  );
  return entries.filter((e): e is Entry => e !== null);
}

export async function listRoots(): Promise<Entry[]> {
  const roots = await Promise.all(
    mediaDirs().map(async (name): Promise<Entry | null> => {
      try {
        const st = await stat(path.join(/* turbopackIgnore: true */ mediaRoot(), name));
        return st.isDirectory() ? { name, rel: name, kind: "dir", size: 0, mtime: st.mtimeMs } : null;
      } catch {
        return null;
      }
    }),
  );
  return roots.filter((e): e is Entry => e !== null);
}

export function validateName(name: string): string {
  const n = name.trim();
  if (!n || n === "." || n === ".." || /[\\/\0]/.test(n) || Buffer.byteLength(n) > 255) {
    throw new FileError("Nom invalide");
  }
  return n;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function renameEntry(rel: string, newName: string): Promise<string> {
  const r = await resolvePath(rel);
  if (r.segments.length < 2) throw new FileError("Impossible de renommer un dossier racine");
  const name = validateName(newName);
  const target = path.join(/* turbopackIgnore: true */ path.dirname(r.abs), name);
  if (await exists(target)) throw new FileError("Un élément porte déjà ce nom");
  await rename(r.abs, target);
  return [...r.segments.slice(0, -1), name].join("/");
}

export async function deleteEntry(rel: string): Promise<void> {
  const r = await resolvePath(rel);
  if (r.segments.length < 2) throw new FileError("Impossible de supprimer un dossier racine");
  await rm(r.abs, { recursive: true, force: false });
}

export function fsErrorMessage(error: unknown): string {
  if (error instanceof FileError) return error.message;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EACCES" || code === "EPERM") return "Permission refusée (élément créé par un autre programme)";
  if (code === "ENOENT") return "Introuvable";
  if (code === "EBUSY") return "Fichier en cours d'utilisation";
  if (code === "ENOTEMPTY" || code === "EEXIST") return "Un élément porte déjà ce nom";
  console.error(error);
  return "Erreur inattendue";
}
