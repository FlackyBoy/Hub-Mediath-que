import { parseCsv } from "./book-import";
import { getDb } from "./db";
import type { GameStatus } from "./game-labels";
import { createGame, findDuplicateGame, getGame, sanitizeGame, updateGame, type GameInput } from "./games";

// Import CSV (export Google Sheets) des jeux : colonnes reconnues par leur intitulé.

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

type Field = keyof GameInput | "status_raw" | "players_raw" | "time_raw" | "bgg_raw";

// Intitulés reconnus (sans accents, minuscules)
const COLUMN_PATTERNS: [Field, RegExp][] = [
  ["title", /^(nom|nom du jeu|jeu|jeux|titre|title|name)$/],
  ["rating", /^(note|ma note|appreciation|rating)/],
  ["status_raw", /^(statut|status|etat|possede|possession|dans ma ludotheque|ludotheque)$/],
  ["notes", /^(avis|mon avis|commentaires?|notes?|remarques?)$/],
  ["plays", /^(parties|nombre de parties|nb parties|parties jouees|plays)/],
  ["players_raw", /^(joueurs|nombre de joueurs|nb joueurs|players)/],
  ["time_raw", /^(duree|temps|temps de jeu|duree de partie|playing time)/],
  ["bgg_raw", /^(bgg|boardgamegeek|lien bgg|id bgg|bgg id)/],
  ["year", /^(annee|year|sortie)/],
  ["publisher", /^(editeur|publisher)/],
];

const SUMMARY_ROW = /^(nombre de jeux|nb de jeux|total|moyenne|duree moyenne|note moyenne|valeurs indicatives)|^\(|\.$/;

function parseStatus(raw: string): GameStatus {
  const s = norm(raw);
  // Colonne « Possédé » en Oui / Non : « Non » = envie
  if (/envie|souhait|wish|a acheter|voudrais|^non$/.test(s)) return "envie";
  if (/vendu|donne|plus a moi|ancien/.test(s)) return "ancien";
  return "possede";
}

// « 2-4 », « 2 à 5 », « 3+ », « 4 » → bornes
function parseRange(raw: string): [number | null, number | null] {
  const n = [...raw.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (!n.length) return [null, null];
  if (/\+/.test(raw) && n.length === 1) return [n[0], null];
  return [Math.min(...n), Math.max(...n)];
}

// « 45 min », « 1h30 », « 30-60 » → minutes
function parseTime(raw: string): [number | null, number | null] {
  const s = norm(raw).replace(/,/g, ".");
  const h = s.match(/(\d+(?:\.\d+)?)\s*h\s*(\d+)?/);
  if (h) {
    const m = Math.round(Number(h[1]) * 60 + Number(h[2] ?? 0));
    return [m, m];
  }
  return parseRange(s);
}

// Lien https://boardgamegeek.com/boardgame/13/catan ou identifiant seul
function parseBggId(raw: string): number | null {
  const m = raw.match(/boardgame(?:expansion)?\/(\d+)/) ?? raw.trim().match(/^(\d+)$/);
  return m ? Number(m[1]) : null;
}

export type GameImportResult = { created: number; updated: number; skipped: number; errors: string[]; unknownColumns: string[] };

export function importGamesCsv(text: string): GameImportResult {
  const rows = parseCsv(text);
  const result: GameImportResult = { created: 0, updated: 0, skipped: 0, errors: [], unknownColumns: [] };
  if (rows.length < 2) throw new Error("Fichier vide ou sans ligne de données");

  const header = rows[0].map(norm);
  const mapping = new Map<number, Field>();
  header.forEach((h, i) => {
    const hit = COLUMN_PATTERNS.find(([, re]) => re.test(h));
    if (hit && ![...mapping.values()].includes(hit[0])) mapping.set(i, hit[0]);
    else if (h) result.unknownColumns.push(rows[0][i]);
  });
  if (![...mapping.values()].includes("title")) throw new Error("Colonne du nom introuvable (« Nom » ou « Jeu »)");

  const db = getDb();
  db.exec("BEGIN");
  try {
    rows.slice(1).forEach((cells, index) => {
      const raw: Partial<Record<Field, string>> = {};
      mapping.forEach((field, i) => (raw[field] = (cells[i] ?? "").trim()));
      // Lignes de synthèse en bas du tableau (« Nombre de jeux », « Durée moyenne… », note de bas de page)
      if (!raw.title || SUMMARY_ROW.test(norm(raw.title))) return void result.skipped++;
      try {
        const [minP, maxP] = parseRange(raw.players_raw ?? "");
        const [minT, maxT] = parseTime(raw.time_raw ?? "");
        const input = sanitizeGame({
          ...raw,
          status: parseStatus(raw.status_raw ?? ""),
          bgg_id: parseBggId(raw.bgg_raw ?? ""),
          min_players: minP,
          max_players: maxP,
          min_time: minT,
          max_time: maxT,
        });
        const existing = findDuplicateGame(input.title, input.bgg_id);
        if (existing) {
          // Les cellules vides du CSV n'écrasent pas ce qui a été saisi dans l'app
          const patch: Parameters<typeof updateGame>[1] = {};
          if (raw.status_raw) patch.status = input.status;
          if (raw.rating) patch.rating = input.rating;
          if (raw.notes) patch.notes = input.notes;
          if (raw.plays) patch.plays = input.plays;
          if (raw.players_raw) Object.assign(patch, { min_players: input.min_players, max_players: input.max_players });
          if (raw.time_raw) Object.assign(patch, { min_time: input.min_time, max_time: input.max_time });
          if (raw.year) patch.year = input.year;
          if (raw.publisher) patch.publisher = input.publisher;
          // Nouvel identifiant BGG : la fiche sera rechargée
          if (input.bgg_id && input.bgg_id !== getGame(existing)?.bgg_id) Object.assign(patch, { bgg_id: input.bgg_id, meta: "pending" });
          updateGame(existing, patch);
          result.updated++;
        } else {
          createGame(input);
          result.created++;
        }
      } catch (error) {
        result.errors.push(`Ligne ${index + 2} : ${(error as Error).message}`);
      }
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return result;
}
