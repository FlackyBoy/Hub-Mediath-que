import { bestMatch, BggError, getGame as getBggGame, isBggConfigured } from "./bgg";
import { applyBgg, gamesNeedingMeta, getGame, metaStats, updateGame, type MetaState } from "./games";
import { translateGame } from "./game-translate";

// Complète en arrière-plan les jeux sans fiche BGG (image, joueurs, durée, complexité...).
// Un jeu à la fois avec une pause : BGG limite fortement le débit de son API.

const globalForEnrich = globalThis as unknown as { hubGameEnrich?: Promise<void> };

export function isEnrichingGames(): boolean {
  return Boolean(globalForEnrich.hubGameEnrich);
}

export function startGameEnrichment(): boolean {
  if (globalForEnrich.hubGameEnrich || !isBggConfigured()) return false;
  globalForEnrich.hubGameEnrich = run().finally(() => {
    globalForEnrich.hubGameEnrich = undefined;
  });
  return true;
}

export function gameEnrichmentProgress() {
  return { ...metaStats(), running: isEnrichingGames(), configured: isBggConfigured() };
}

export async function enrichGame(id: number): Promise<MetaState> {
  const game = getGame(id);
  if (!game) return "missing";
  // Identifiant BGG connu (ajout depuis la recherche, colonne de l'import) : fiche directe
  if (game.bgg_id) {
    const g = await getBggGame(game.bgg_id);
    if (!g) {
      updateGame(id, { meta: "missing" });
      return "missing";
    }
    applyBgg(id, g, "ok");
    void translateGame(id);
    return "ok";
  }
  const match = await bestMatch(game.title, game.year);
  if (!match) {
    updateGame(id, { meta: "missing" });
    return "missing";
  }
  const state: MetaState = match.confidence >= 0.85 ? "ok" : "doubtful";
  applyBgg(id, match.game, state);
  void translateGame(id);
  return state;
}

async function run() {
  for (;;) {
    const id = gamesNeedingMeta();
    if (id === null) return;
    try {
      await enrichGame(id);
    } catch (error) {
      console.error("Fiche BGG introuvable pour le jeu", id, error);
      // Jeton refusé ou BGG en panne : on s'arrête, les jeux restent en attente
      if (error instanceof BggError) return;
      updateGame(id, { meta: "missing" });
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
}
