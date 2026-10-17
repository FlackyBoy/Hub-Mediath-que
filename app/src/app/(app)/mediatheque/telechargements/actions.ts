"use server";

import { requireSession } from "@/lib/auth";
import { getDirSizes, recordDeletion } from "@/lib/disk";
import { toRel } from "@/lib/downloads";
import { deleteEntry, fsErrorMessage } from "@/lib/files";
import { eraseTorrent, isValidHash, listTorrents, pauseTorrent, resumeTorrent } from "@/lib/rtorrent";

export type TorrentActionResult = { ok: boolean; message?: string };

async function guard(hash: string) {
  await requireSession();
  if (!isValidHash(hash)) throw new Error("Torrent invalide");
}

export async function pauseAction(hash: string): Promise<TorrentActionResult> {
  try {
    await guard(hash);
    await pauseTorrent(hash);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export async function resumeAction(hash: string): Promise<TorrentActionResult> {
  try {
    await guard(hash);
    await resumeTorrent(hash);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// Retire le torrent ; avec withData, supprime aussi ses fichiers (s'ils sont dans les dossiers autorisés)
export async function removeAction(hash: string, withData: boolean): Promise<TorrentActionResult> {
  try {
    await guard(hash);
    const torrent = (await listTorrents()).find((t) => t.hash === hash);
    if (!torrent) return { ok: false, message: "Torrent introuvable" };
    const rel = withData ? toRel(torrent.basePath) : null;
    if (withData && (!rel || !rel.includes("/"))) {
      return { ok: false, message: "Fichiers hors des dossiers du Hub : retire le torrent sans les fichiers" };
    }
    await eraseTorrent(hash);
    if (!rel) return { ok: true, message: "Torrent retiré, fichiers conservés" };
    try {
      const known = getDirSizes([rel]).get(rel);
      await deleteEntry(rel);
      recordDeletion(rel, known?.size ?? torrent.size, known?.files ?? 1);
      return { ok: true, message: "Torrent et fichiers supprimés" };
    } catch (error) {
      return { ok: false, message: `Torrent retiré, mais fichiers non supprimés : ${fsErrorMessage(error)}` };
    }
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
