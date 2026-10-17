import { getDb } from "./db";
import { createBook, findDuplicate, inferType, sanitizeBook, updateBook, type BookInput } from "./books";

// Import CSV (export Google Sheets) : colonnes reconnues par leur intitulé.

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.indexOf("\n") >>> 0);
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (src[i + 1] === '"') {
        field += '"'; // guillemet doublé = guillemet littéral
        i++;
      } else quoted = false;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field || row.length) endRow();
  return rows.filter((r) => r.some((c) => c.trim()));
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Intitulés reconnus (sans accents, minuscules)
const COLUMN_PATTERNS: [keyof BookInput | "status_raw", RegExp][] = [
  ["title", /^(nom du livre|titre|title|livre)$/],
  ["author", /^(auteur|auteurs|author|ecrivain)/],
  ["rating", /^(appreciation|note|rating)/],
  ["status_raw", /^(lu \/ non lu|statut|status|etat|lu)$/],
  ["style", /^(style|genre)/],
  ["summary", /^resume/],
  ["cons", /pourquoi je n.?aimerais pas|points? negatifs?|contre/],
  ["pros", /pourquoi j.?aimerais|points? positifs?|pour$/],
  ["publisher", /^(editeur|maison d.edition|publisher)/],
  ["isbn", /^isbn/],
  ["year", /^(annee|year|date de parution)/],
  ["pages", /^(pages|nombre de pages)/],
  ["notes", /^(mon avis|avis|commentaire|notes?)$/],
];

function parseStatus(raw: string): BookInput["status"] {
  const s = norm(raw);
  if (s.startsWith("abandon")) return "abandonne";
  if (s.startsWith("en cours")) return "en_cours";
  if (s === "lu" || s === "oui" || s === "termine") return "lu";
  return "a_lire";
}

export type ImportResult = { created: number; updated: number; skipped: number; errors: string[]; unknownColumns: string[] };

export function importBooksCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], unknownColumns: [] };
  if (rows.length < 2) throw new Error("Fichier vide ou sans ligne de données");

  const header = rows[0].map(norm);
  const mapping = new Map<number, keyof BookInput | "status_raw">();
  header.forEach((h, i) => {
    const hit = COLUMN_PATTERNS.find(([, re]) => re.test(h));
    if (hit && ![...mapping.values()].includes(hit[0])) mapping.set(i, hit[0]);
    else if (h) result.unknownColumns.push(rows[0][i]);
  });
  if (![...mapping.values()].includes("title")) throw new Error("Colonne du titre introuvable (« Nom du livre » ou « Titre »)");

  const db = getDb();
  db.exec("BEGIN");
  try {
    rows.slice(1).forEach((cells, index) => {
      const raw: Record<string, string> = {};
      mapping.forEach((field, i) => (raw[field] = (cells[i] ?? "").trim()));
      if (!raw.title) return void result.skipped++;
      try {
        const input = sanitizeBook({
          ...raw,
          status: parseStatus(raw.status_raw ?? ""),
          type: inferType(raw.style ?? ""),
        });
        const existing = findDuplicate(input.title, input.author);
        if (existing) {
          // Les cellules vides du CSV n'écrasent pas ce qui a été saisi dans l'app
          const patch: Partial<BookInput> = {};
          for (const [k, v] of Object.entries(input) as [keyof BookInput, unknown][]) {
            const field = k === "status" ? "status_raw" : k;
            if (k === "type" || !raw[field as string]) continue;
            (patch as Record<string, unknown>)[k] = v;
          }
          updateBook(existing, patch);
          result.updated++;
        } else {
          createBook(input);
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
