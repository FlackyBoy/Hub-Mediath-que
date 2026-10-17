"use server";

import { stat } from "node:fs/promises";
import { requireSession } from "@/lib/auth";
import { getDirSizes, recordDeletion, recordRename, startScan } from "@/lib/disk";
import { deleteEntry, fsErrorMessage, renameEntry, resolvePath } from "@/lib/files";

export type RenameResult = { ok: true; rel: string } | { ok: false; error: string };
export type DeleteResult = { deleted: number; freed: number; errors: string[] };

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

  const result: DeleteResult = { deleted: 0, freed: 0, errors: [] };
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
      await deleteEntry(rel);
      recordDeletion(rel, size, files);
      result.deleted++;
      result.freed += size;
    } catch (error) {
      result.errors.push(`${name} : ${fsErrorMessage(error)}`);
    }
  }
  return result;
}

export async function startScanAction() {
  await requireSession();
  startScan();
}
