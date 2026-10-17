import { bestMatch } from "./book-meta";
import { booksNeedingCover, coverStats, getBook, updateBook, type CoverState } from "./books";
import { downloadCover } from "./covers";

// Complète en arrière-plan les livres sans couverture : métadonnées manquantes + image.
// Un livre à la fois, avec une pause, pour rester raisonnable avec les API publiques.

const globalForEnrich = globalThis as unknown as { hubEnrich?: Promise<void> };

export function isEnriching(): boolean {
  return Boolean(globalForEnrich.hubEnrich);
}

export function startEnrichment(): boolean {
  if (globalForEnrich.hubEnrich) return false;
  globalForEnrich.hubEnrich = run().finally(() => {
    globalForEnrich.hubEnrich = undefined;
  });
  return true;
}

export function enrichmentProgress() {
  return { ...coverStats(), running: isEnriching() };
}

export async function enrichBook(id: number): Promise<CoverState> {
  const book = getBook(id);
  if (!book) return "missing";
  const match = await bestMatch(book.title, book.author);
  if (!match) {
    updateBook(id, { cover: "missing" });
    return "missing";
  }
  const c = match.candidate;
  const confident = match.confidence >= 0.85 && !book.title.includes(" / ");
  // On ne complète que les champs vides, et seulement si la correspondance est fiable
  const patch: Parameters<typeof updateBook>[1] = { meta_source: c.source };
  if (match.confidence >= 0.6) {
    if (!book.publisher && c.publisher) patch.publisher = c.publisher;
    if (!book.year && c.year) patch.year = c.year;
    if (!book.pages && c.pages) patch.pages = c.pages;
    if (!book.isbn && c.isbn) patch.isbn = c.isbn;
  }
  const saved = c.coverUrl && match.confidence >= 0.4 ? await downloadCover(id, c.coverUrl) : false;
  const state: CoverState = !saved ? "missing" : confident ? "ok" : "doubtful";
  updateBook(id, { ...patch, cover: state });
  return state;
}

async function run() {
  for (;;) {
    const next = booksNeedingCover()[0];
    if (!next) return;
    try {
      await enrichBook(next.id);
    } catch (error) {
      console.error("Enrichissement échoué pour le livre", next.id, error);
      updateBook(next.id, { cover: "missing" });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}
