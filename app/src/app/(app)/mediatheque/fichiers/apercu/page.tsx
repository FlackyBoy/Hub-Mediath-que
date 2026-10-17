import { open, stat } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { KindIcon } from "@/components/kind-icon";
import { fsErrorMessage, kindOf, KIND_LABELS, resolvePath } from "@/lib/files";
import { formatDate } from "@/lib/format";
import { filesHref, formatBytes, rawHref, type ViewEntry } from "@/lib/media-links";
import { FileActions } from "./file-actions";

export const metadata: Metadata = { title: "Aperçu" };

// Formats vidéo que Safari sait lire nativement
const PLAYABLE_VIDEO = ["mp4", "m4v", "mov", "webm"];
const TEXT_PREVIEW_BYTES = 64 * 1024;

async function readStart(abs: string): Promise<string> {
  const handle = await open(abs, "r");
  try {
    const buffer = Buffer.alloc(TEXT_PREVIEW_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, TEXT_PREVIEW_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export default async function ApercuPage({ searchParams }: PageProps<"/mediatheque/fichiers/apercu">) {
  const params = await searchParams;
  const rel = typeof params.p === "string" ? params.p : "";

  let resolved;
  let st;
  try {
    resolved = await resolvePath(rel);
    st = await stat(resolved.abs);
  } catch (e) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <p className="mb-2 text-danger">{fsErrorMessage(e)}</p>
        <Link href={filesHref("")} className="text-accent">
          Retour aux fichiers
        </Link>
      </div>
    );
  }
  if (st.isDirectory()) redirect(filesHref(resolved.rel));

  const name = path.basename(resolved.abs);
  const ext = path.extname(name).slice(1).toLowerCase();
  const kind = kindOf(name);
  const parentRel = resolved.segments.slice(0, -1).join("/");
  const src = rawHref(resolved.rel);
  const text = (kind === "text" || kind === "subtitle") && st.size > 0 ? await readStart(resolved.abs) : null;
  const entry: ViewEntry = {
    name,
    rel: resolved.rel,
    kind,
    size: st.size,
    sizeLabel: formatBytes(st.size),
    dateLabel: formatDate(st.mtimeMs),
  };

  return (
    <>
      <Breadcrumb rel={parentRel} linkLast />
      <h1 className="mb-1 break-all text-xl font-bold">{name}</h1>
      <p className="mb-4 text-sm text-muted">
        {KIND_LABELS[kind]} · {entry.sizeLabel} · {entry.dateLabel}
      </p>

      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
        {kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="mx-auto max-h-[70vh] w-auto" />
        )}
        {kind === "video" && PLAYABLE_VIDEO.includes(ext) && (
          <video src={src} controls playsInline preload="metadata" className="max-h-[70vh] w-full bg-black" />
        )}
        {kind === "audio" && (
          <div className="p-4">
            <audio src={src} controls preload="metadata" className="w-full" />
          </div>
        )}
        {text !== null && (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 text-xs">
            {text}
            {st.size > TEXT_PREVIEW_BYTES && "\n…"}
          </pre>
        )}
        {kind === "book" && ext === "pdf" && (
          <a href={src} target="_blank" rel="noreferrer" className="block p-6 text-center font-medium text-accent">
            Ouvrir le PDF
          </a>
        )}
        {!(
          kind === "image" ||
          kind === "audio" ||
          text !== null ||
          (kind === "video" && PLAYABLE_VIDEO.includes(ext)) ||
          (kind === "book" && ext === "pdf")
        ) && (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted">
            <KindIcon kind={kind} className="size-10" />
            {kind === "video"
              ? `Safari ne lit pas le format .${ext}. Regarde-le dans Plex ou télécharge-le.`
              : "Pas d'aperçu pour ce type de fichier."}
          </div>
        )}
      </div>

      <FileActions entry={entry} parentRel={parentRel} />
    </>
  );
}
