"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { BggError, getGame as getBggGame, searchGames } from "@/lib/bgg";
import { getDb } from "@/lib/db";
import { enrichGame, startGameEnrichment } from "@/lib/game-enrich";
import { importGamesCsv, type GameImportResult } from "@/lib/game-import";
import { translateGame } from "@/lib/game-translate";
import { isGameStatus, type GameHit, type GameStatus } from "@/lib/game-labels";
import { applyBgg, createGame, deleteGame, findDuplicateGame, getGame, sanitizeGame, updateGame } from "@/lib/games";

function bggError(error: unknown): string {
  if (error instanceof BggError) return error.message;
  console.error(error);
  return "BoardGameGeek indisponible pour le moment";
}

export type BggSearchHit = GameHit & { expansion: boolean; knownId: number | null };

export async function searchBggAction(query: string): Promise<{ hits: BggSearchHit[]; error?: string }> {
  await requireSession();
  const q = query.trim().slice(0, 200);
  if (!q) return { hits: [] };
  try {
    const find = getDb().prepare("SELECT id FROM games WHERE bgg_id = ?");
    const hits = (await searchGames(q)).slice(0, 25).map((h) => ({
      bggId: h.bggId,
      name: h.name,
      year: h.year,
      expansion: h.type !== "boardgame",
      knownId: (find.get(h.bggId) as { id: number } | undefined)?.id ?? null,
    }));
    return { hits };
  } catch (error) {
    return { hits: [], error: bggError(error) };
  }
}

// Ajout depuis la recherche BGG (fiche chargée tout de suite) ou à la main (fiche cherchée en arrière-plan)
export async function addGameAction(raw: { title: string; status: GameStatus; bggId?: number | null }): Promise<{ error: string; duplicateId?: number }> {
  await requireSession();
  let id: number;
  try {
    const input = sanitizeGame({ title: raw.title, status: raw.status, bgg_id: raw.bggId });
    const duplicate = findDuplicateGame(input.title, input.bgg_id);
    if (duplicate) return { error: "Ce jeu est déjà dans ta liste", duplicateId: duplicate };
    id = createGame(input);
  } catch (error) {
    return { error: (error as Error).message };
  }
  try {
    await enrichGame(id);
  } catch {
    // BGG indisponible : la fiche reste en attente et sera reprise en arrière-plan
  }
  startGameEnrichment();
  redirect(`/jeux/${id}`);
}

export async function quickUpdateGameAction(id: number, patch: { status?: string; rating?: number | null; notes?: string }) {
  await requireSession();
  const clean: Parameters<typeof updateGame>[1] = {};
  if (patch.status !== undefined && isGameStatus(patch.status)) clean.status = patch.status;
  if ("rating" in patch) {
    const r = patch.rating;
    clean.rating = r === null || r === undefined ? null : Math.min(10, Math.max(0, Math.round(Number(r))));
  }
  if (patch.notes !== undefined) clean.notes = String(patch.notes).slice(0, 10000);
  updateGame(id, clean);
  return { ok: true };
}

// +1 partie (aujourd'hui) ou -1 pour corriger une erreur
export async function logPlayAction(id: number, delta: 1 | -1): Promise<{ plays: number; lastPlayed: string | null }> {
  await requireSession();
  const g = getGame(id);
  if (!g) return { plays: 0, lastPlayed: null };
  const plays = Math.max(0, g.plays + delta);
  const lastPlayed = delta > 0 ? new Date().toISOString().slice(0, 10) : plays === 0 ? null : g.last_played;
  updateGame(id, { plays, last_played: lastPlayed });
  return { plays, lastPlayed };
}

// Mauvaise fiche trouvée automatiquement : rattache le jeu à une autre fiche BGG
export async function relinkGameAction(id: number, bggId: number): Promise<{ error?: string }> {
  await requireSession();
  const taken = findDuplicateGame("", bggId);
  if (taken && taken !== id) return { error: "Cette fiche est déjà rattachée à un autre jeu de ta liste" };
  try {
    const g = await getBggGame(bggId);
    if (!g) return { error: "Fiche introuvable sur BoardGameGeek" };
    applyBgg(id, g, "ok");
    void translateGame(id);
    return {};
  } catch (error) {
    return { error: bggError(error) };
  }
}

export async function deleteGameAction(id: number) {
  await requireSession();
  deleteGame(id);
  redirect("/jeux");
}

export async function importGamesCsvAction(form: FormData): Promise<GameImportResult | { error: string }> {
  await requireSession();
  const file = form.get("csv");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier" };
  if (file.size > 5 * 1024 * 1024) return { error: "Fichier trop lourd (5 Mo maximum)" };
  try {
    const result = importGamesCsv(await file.text());
    startGameEnrichment();
    return result;
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function startGameEnrichmentAction() {
  await requireSession();
  // Les jeux non trouvés sont retentés (titre corrigé, BGG revenu...)
  getDb().prepare("UPDATE games SET meta = 'pending' WHERE meta = 'missing'").run();
  startGameEnrichment();
}
