import { mkdirSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Couvertures stockées à côté de la base (data/covers/<id>), servies par /api/covers/<id>.

const MAX_BYTES = 8 * 1024 * 1024;

function coversDir(): string {
  const db = process.env.DATABASE_PATH ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "data", "hub.sqlite");
  const dir = path.join(/* turbopackIgnore: true */ path.dirname(db), "covers");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function coverFile(id: number): string {
  return path.join(/* turbopackIgnore: true */ coversDir(), String(Math.trunc(id)));
}

// Type d'image d'après les premiers octets (on ne fait pas confiance à l'extension)
export function imageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

export async function saveCover(id: number, buf: Buffer): Promise<void> {
  if (buf.length > MAX_BYTES) throw new Error("Image trop lourde (8 Mo maximum)");
  if (buf.length < 1024 || !imageType(buf)) throw new Error("Ce fichier n'est pas une image valide");
  await writeFile(coverFile(id), buf);
}

// Télécharge une couverture distante ; false si absente ou invalide
export async function downloadCover(id: number, url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const res = await fetch(u, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    await saveCover(id, buf);
    return true;
  } catch {
    return false;
  }
}

export async function readCover(id: number): Promise<{ data: Buffer; type: string } | null> {
  try {
    const data = await readFile(coverFile(id));
    const type = imageType(data);
    return type ? { data, type } : null;
  } catch {
    return null;
  }
}

export async function deleteCover(id: number): Promise<void> {
  await rm(coverFile(id), { force: true });
}
