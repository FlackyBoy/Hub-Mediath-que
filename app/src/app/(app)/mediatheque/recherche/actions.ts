"use server";

import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { magnetInfoHash, torrentInfoHash } from "@/lib/bencode";
import { setDefaultDest, trackDownload } from "@/lib/downloads";
import { fsErrorMessage, mediaDirs, resolvePath, validateName } from "@/lib/files";
import { fetchRelease, type Category } from "@/lib/prowlarr";
import { addMagnet, addTorrentFile } from "@/lib/rtorrent";

export type FolderListing = { rel: string; folders: string[]; error?: string };

// Sous-dossiers d'un dossier (pour choisir la destination). rel vide = dossiers racines.
export async function listFoldersAction(rel: string): Promise<FolderListing> {
  await requireSession();
  if (!rel) return { rel: "", folders: mediaDirs() };
  try {
    const { abs, rel: clean } = await resolvePath(rel);
    const dirents = await readdir(abs, { withFileTypes: true });
    const folders = dirents
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));
    return { rel: clean, folders };
  } catch (error) {
    return { rel, folders: [], error: fsErrorMessage(error) };
  }
}

export type AddDownloadInput = {
  downloadUrl: string;
  title: string;
  category: Category;
  dest: string;
  newFolder?: string;
};

export type AddDownloadResult = { ok: true; dest: string } | { ok: false; error: string };

export async function addDownloadAction(input: AddDownloadInput): Promise<AddDownloadResult> {
  await requireSession();
  const category: Category = ["films", "series", "autres"].includes(input.category) ? input.category : "autres";

  let destRel: string;
  let destAbs: string;
  try {
    const target = await resolvePath(input.dest);
    if (!(await stat(target.abs)).isDirectory()) return { ok: false, error: "La destination n'est pas un dossier" };
    destRel = target.rel;
    destAbs = target.abs;
    if (input.newFolder?.trim()) {
      const name = validateName(input.newFolder);
      destAbs = path.join(/* turbopackIgnore: true */ target.abs, name);
      destRel = `${target.rel}/${name}`;
      await mkdir(destAbs, { recursive: true });
    }
  } catch (error) {
    return { ok: false, error: fsErrorMessage(error) };
  }

  try {
    const release = await fetchRelease(input.downloadUrl);
    let hash: string;
    if ("magnet" in release) {
      hash = magnetInfoHash(release.magnet);
      await addMagnet(release.magnet, destAbs);
    } else {
      hash = torrentInfoHash(release.torrent);
      await addTorrentFile(release.torrent, destAbs);
    }
    trackDownload(hash, input.title, category, destRel);
    // Le dossier choisi devient le défaut de la catégorie (sans le sous-dossier créé)
    setDefaultDest(category, input.newFolder?.trim() ? input.dest : destRel);
    return { ok: true, dest: destRel };
  } catch (error) {
    console.error("Ajout du téléchargement échoué", error);
    return { ok: false, error: (error as Error).message };
  }
}
