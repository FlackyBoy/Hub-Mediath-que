import { startEnrichment } from "./book-enrich";
import { importBooksCsv, type ImportResult } from "./book-import";
import { startGameEnrichment } from "./game-enrich";
import { importGamesCsv } from "./game-import";
import { getSetting, setSetting } from "./settings";

// Synchronisation à la demande avec un Google Sheet partagé « lecteur par lien » :
// on télécharge son export CSV et on le passe à l'import habituel (ajouts et mises à jour,
// les cellules vides n'écrasent rien, une ligne supprimée du Sheet reste dans le Hub).

export type SheetTarget = "books" | "games";

export type SheetStatus = { url: string | null; last: (ImportResult & { at: string }) | { error: string; at: string } | null };

// Lien d'édition ou de partage → lien d'export CSV de la feuille affichée (gid)
export function csvExportUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new Error("Lien invalide");
  }
  if (u.hostname !== "docs.google.com" || !u.pathname.startsWith("/spreadsheets/")) {
    throw new Error("Ce n'est pas un lien Google Sheets");
  }
  // Feuille publiée sur le web : /d/e/<id>/pub?output=csv
  const published = u.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)/);
  if (published) {
    const gid = u.searchParams.get("gid");
    return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv${gid ? `&gid=${gid}` : ""}`;
  }
  const id = u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) throw new Error("Identifiant du Sheet introuvable dans le lien");
  const gid = u.searchParams.get("gid") ?? u.hash.match(/gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

// Sheets déjà connus (modifiables dans l'app)
const DEFAULT_URLS: Partial<Record<SheetTarget, string>> = {
  games: "https://docs.google.com/spreadsheets/d/1SyP3vgKxSOCGMO21mkunbMbE0sb6UEBcUPsZwAsiCYw/edit",
};

function sheetUrl(target: SheetTarget): string | null {
  return getSetting(`sheet.${target}.url`) ?? DEFAULT_URLS[target] ?? null;
}

export function sheetStatus(target: SheetTarget): SheetStatus {
  const last = getSetting(`sheet.${target}.last`);
  return { url: sheetUrl(target), last: last ? JSON.parse(last) : null };
}

export function setSheetUrl(target: SheetTarget, url: string) {
  csvExportUrl(url); // validation
  setSetting(`sheet.${target}.url`, url.trim());
}

export async function syncSheet(target: SheetTarget): Promise<ImportResult> {
  const url = sheetUrl(target);
  const at = new Date().toISOString().replace("T", " ").slice(0, 19); // format SQLite (formatRelative)
  try {
    if (!url) throw new Error("Aucun Sheet enregistré");
    const res = await fetch(csvExportUrl(url), { redirect: "follow", signal: AbortSignal.timeout(30000), cache: "no-store" }).catch(() => {
      throw new Error("Google Sheets injoignable pour le moment");
    });
    const text = await res.text();
    // Sheet privé : Google renvoie sa page de connexion (HTML) au lieu du CSV
    if (!res.ok || /^\s*</.test(text)) {
      throw new Error("Sheet inaccessible : dans Google Sheets, Partager > « Tous les utilisateurs disposant du lien » > Lecteur");
    }
    const result = target === "books" ? importBooksCsv(text) : importGamesCsv(text);
    if (target === "books") startEnrichment();
    else startGameEnrichment();
    setSetting(`sheet.${target}.last`, JSON.stringify({ ...result, at }));
    return result;
  } catch (error) {
    setSetting(`sheet.${target}.last`, JSON.stringify({ error: (error as Error).message, at }));
    throw error;
  }
}
