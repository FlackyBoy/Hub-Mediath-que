import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { FileError, resolvePath } from "@/lib/files";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska",
  avi: "video/x-msvideo", mp3: "audio/mpeg", m4a: "audio/mp4", m4b: "audio/mp4", aac: "audio/aac",
  flac: "audio/flac", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", jpg: "image/jpeg",
  jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic",
  svg: "image/svg+xml", pdf: "application/pdf", epub: "application/epub+zip", txt: "text/plain; charset=utf-8",
  nfo: "text/plain; charset=utf-8", srt: "text/plain; charset=utf-8", vtt: "text/vtt", json: "application/json",
};

// Sert un fichier (aperçu ou téléchargement), avec prise en charge des plages
// (Range) pour la lecture vidéo dans Safari.
export async function GET(request: NextRequest) {
  if (!(await getSession())) return new Response("Non authentifié", { status: 401 });

  const rel = request.nextUrl.searchParams.get("p") ?? "";
  let abs: string;
  let size: number;
  try {
    abs = (await resolvePath(rel)).abs;
    const st = await stat(abs);
    if (!st.isFile()) return new Response("Pas un fichier", { status: 400 });
    size = st.size;
  } catch (error) {
    return new Response(error instanceof FileError ? error.message : "Introuvable", { status: 404 });
  }

  const name = path.basename(abs);
  const ext = path.extname(name).slice(1).toLowerCase();
  const download = request.nextUrl.searchParams.has("dl");
  const headers = new Headers({
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "private, no-store",
  });
  // Empêche l'exécution de scripts contenus dans un SVG/HTML servi depuis le disque
  if (["svg", "html", "htm", "xhtml", "xml"].includes(ext)) headers.set("Content-Security-Policy", "sandbox");

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    start = Math.min(start, end);
    if (start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, { status: 200, headers });
}
