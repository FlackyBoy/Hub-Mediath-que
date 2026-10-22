"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { enrichBook, enrichSummary, startEnrichment } from "@/lib/book-enrich";
import { addBookFromFile, ignoreBookFile, scanBookFiles, setBookDirs, type ScanResult } from "@/lib/book-files";
import { importBooksCsv, type ImportResult } from "@/lib/book-import";
import { isStatus } from "@/lib/book-labels";
import { lookupIsbn, searchCandidates, type BookCandidate } from "@/lib/book-meta";
import { createBook, deleteBook, findDuplicate, getBook, sanitizeBook, updateBook } from "@/lib/books";
import { deleteCover, downloadCover, saveCover } from "@/lib/covers";

export type SaveResult = { ok: false; error: string; duplicateId?: number };

// Création : avec coverUrl (candidat choisi), la couverture est téléchargée tout de suite
export async function createBookAction(raw: Record<string, unknown>, coverUrl?: string | null): Promise<SaveResult> {
  await requireSession();
  let id: number;
  try {
    const input = sanitizeBook(raw);
    const duplicate = findDuplicate(input.title, input.author);
    if (duplicate) return { ok: false, error: "Ce livre est déjà dans ta bibliothèque", duplicateId: duplicate };
    id = createBook(input, coverUrl ? "missing" : "pending");
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (coverUrl && (await downloadCover(id, coverUrl))) updateBook(id, { cover: "ok" });
  else if (coverUrl) updateBook(id, { cover: "pending" });
  startEnrichment();
  redirect(`/bibliotheque/${id}`);
}

export async function updateBookAction(id: number, raw: Record<string, unknown>): Promise<SaveResult> {
  await requireSession();
  try {
    const book = getBook(id);
    if (!book) return { ok: false, error: "Livre introuvable" };
    const input = sanitizeBook(raw);
    // Résumé retouché à la main : il n'est plus attribué à Open Library / Google Books
    updateBook(id, input.summary !== book.summary ? { ...input, summary_source: "", summary_checked: 1 } : input);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  redirect(`/bibliotheque/${id}`);
}

// Modifications rapides depuis la fiche (note, statut, avis)
export async function quickUpdateAction(
  id: number,
  patch: { rating?: number | null; status?: string; notes?: string },
): Promise<{ ok: boolean }> {
  await requireSession();
  const clean: Parameters<typeof updateBook>[1] = {};
  if ("rating" in patch) {
    const r = patch.rating;
    clean.rating = r === null || r === undefined ? null : Math.min(10, Math.max(0, Math.round(Number(r))));
  }
  if (patch.status !== undefined && isStatus(patch.status)) clean.status = patch.status;
  if (patch.notes !== undefined) clean.notes = String(patch.notes).slice(0, 10000);
  updateBook(id, clean);
  return { ok: true };
}

export async function deleteBookAction(id: number) {
  await requireSession();
  deleteBook(id);
  await deleteCover(id);
  redirect("/bibliotheque");
}

export async function searchBooksAction(query: string): Promise<BookCandidate[]> {
  await requireSession();
  const q = query.trim().slice(0, 200);
  return q ? searchCandidates(q) : [];
}

export async function lookupIsbnAction(isbn: string): Promise<BookCandidate | null> {
  await requireSession();
  return lookupIsbn(isbn);
}

// Couvertures proposées pour un livre existant (changement de couverture)
export async function coverCandidatesAction(id: number): Promise<BookCandidate[]> {
  await requireSession();
  const book = getBook(id);
  if (!book) return [];
  const results = await searchCandidates(`${book.title.split(" / ")[0]} ${book.author}`.trim());
  return results.filter((c) => c.coverUrl);
}

export async function setCoverFromUrlAction(id: number, url: string): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!getBook(id)) return { ok: false, error: "Livre introuvable" };
  if (!(await downloadCover(id, url))) return { ok: false, error: "Image introuvable ou invalide à cette adresse" };
  updateBook(id, { cover: "ok" });
  return { ok: true };
}

export async function uploadCoverAction(id: number, form: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  const file = form.get("cover");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucune image reçue" };
  try {
    await saveCover(id, Buffer.from(await file.arrayBuffer()));
    updateBook(id, { cover: "ok" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function retryEnrichAction(id: number): Promise<{ ok: boolean; state: string }> {
  await requireSession();
  const book = getBook(id);
  if (!book) return { ok: false, state: "missing" };
  // Nouvelle tentative de recherche automatique pour ce livre
  return { ok: true, state: await enrichBook(id) };
}

export async function findSummaryAction(id: number): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!getBook(id)) return { ok: false, error: "Livre introuvable" };
  return (await enrichSummary(id)) ? { ok: true } : { ok: false, error: "Aucun résumé trouvé pour ce livre" };
}

export async function importCsvAction(form: FormData): Promise<ImportResult | { error: string }> {
  await requireSession();
  const file = form.get("csv");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier reçu" };
  try {
    const result = importBooksCsv(await file.text());
    startEnrichment();
    return result;
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function startEnrichmentAction() {
  await requireSession();
  startEnrichment();
}

// --- Livres numériques présents sur le serveur ---

export async function saveBookDirsAction(input: string): Promise<{ dirs?: string[]; error?: string }> {
  await requireSession();
  try {
    return { dirs: await setBookDirs(input) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function scanBookFilesAction(): Promise<ScanResult | { error: string }> {
  await requireSession();
  try {
    return await scanBookFiles();
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function addBookFilesAction(items: { rel: string; title: string; author: string }[]): Promise<{ added: number; errors: string[] }> {
  await requireSession();
  const errors: string[] = [];
  let added = 0;
  for (const it of items.slice(0, 500)) {
    try {
      addBookFromFile(String(it.rel), String(it.title), String(it.author ?? ""));
      added++;
    } catch (error) {
      errors.push(`${it.title || it.rel} : ${(error as Error).message}`);
    }
  }
  if (added) startEnrichment();
  return { added, errors };
}

export async function ignoreBookFilesAction(rels: string[]) {
  await requireSession();
  for (const rel of rels.slice(0, 500)) ignoreBookFile(String(rel));
}
