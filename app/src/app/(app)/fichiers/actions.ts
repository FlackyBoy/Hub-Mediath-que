"use server";

import { stat } from "node:fs/promises";
import { requireSession } from "@/lib/auth";
import { getDirSizes, recordDeletion, recordRename, startScan } from "@/lib/disk";
import { deleteEntry, fsErrorMessage, renameEntry, resolvePath } from "@/lib/files";
import { eraseTorrent, listTorrents, type Torrent } from "@/lib/rtorrent";

export type RenameResult = { ok: true; rel: string } | { ok: false; error: string };
export type DeleteResult = { deleted: number; freed: number; errors: string[]; torrents: number };

// Torrents dont les données recouvrent le chemin supprimé (dossier parent ou fichier contenu)
function overlapping(torrents: Torrent[], abs: string): Torrent[] {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
  const target = norm(abs);
  return torrents.filter((t) => {
    const base = norm(t.basePath);
    return base && (base === target || base.startsWith(target + "/") || target.startsWith(base + "/"));
  });
}

export async function renameAction(rel: string, newName: string): Promise<RenameResult> {
  await requireSession();
  try {
    const newRel = await renameEntry(rel, newName);
    recordRename(rel, newRel);
    return { ok: true, rel: newRel };
  } catch (error) {
    return { ok: false, error: fsErrorMessage(error) };
  }
}

export async function deleteAction(rels: string[]): Promise<DeleteResult> {
  await requireSession();
  // Inutile de supprimer un élément dont le dossier parent est aussi supprimé
  const unique = [...new Set(rels)].sort();
  const targets = unique.filter((rel) => !unique.some((other) => rel.startsWith(other + "/")));

  // Si rTorrent est indisponible, on supprime quand même les fichiers
  const torrents = await listTorrents().catch(() => [] as Torrent[]);
  const erased = new Set<string>();

  const result: DeleteResult = { deleted: 0, freed: 0, errors: [], torrents: 0 };
  for (const rel of targets) {
    const name = rel.split("/").pop();
    try {
      const { abs } = await resolvePath(rel);
      const st = await stat(abs);
      let size = st.size;
      let files = 1;
      if (st.isDirectory()) {
        const known = getDirSizes([rel]).get(rel);
        size = known?.size ?? 0;
        files = known?.files ?? 0;
      }
      // Retire d'abord les torrents concernés pour éviter qu'ils passent en erreur
      for (const t of overlapping(torrents, abs)) {
        if (erased.has(t.hash)) continue;
        await eraseTorrent(t.hash);
        erased.add(t.hash);
      }
      await deleteEntry(rel);
      recordDeletion(rel, size, files);
      result.deleted++;
      result.freed += size;
    } catch (error) {
      result.errors.push(`${name} : ${fsErrorMessage(error)}`);
    }
  }
  result.torrents = erased.size;
  return result;
}

export async function startScanAction() {
  await requireSession();
  startScan();
}
