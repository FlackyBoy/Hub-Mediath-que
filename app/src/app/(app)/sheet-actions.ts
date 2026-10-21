"use server";

import { requireSession } from "@/lib/auth";
import type { ImportResult } from "@/lib/book-import";
import { setSheetUrl, syncSheet, type SheetTarget } from "@/lib/sheet-sync";

// Google Sheet relié aux livres ou aux jeux : enregistrement du lien et synchronisation

function target(t: string): SheetTarget {
  if (t !== "books" && t !== "games") throw new Error("Cible invalide");
  return t;
}

export async function saveSheetUrlAction(t: string, url: string): Promise<{ error?: string }> {
  await requireSession();
  try {
    setSheetUrl(target(t), url);
    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function syncSheetAction(t: string): Promise<ImportResult | { error: string }> {
  await requireSession();
  try {
    return await syncSheet(target(t));
  } catch (error) {
    return { error: (error as Error).message };
  }
}
