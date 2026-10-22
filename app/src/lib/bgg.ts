import type { GameHit } from "./game-labels";

// Client BoardGameGeek (XML API2) : recherche et fiches des jeux.
// Jeton : BGG_API_TOKEN (application enregistrée sur boardgamegeek.com/applications).

const BASE = process.env.BGG_BASE_URL || "https://boardgamegeek.com/xmlapi2";

export function isBggConfigured(): boolean {
  return Boolean(process.env.BGG_API_TOKEN);
}

export class BggError extends Error {}

export type BggGame = {
  bggId: number;
  type: string;
  name: string;
  names: string[];
  year: number | null;
  image: string | null;
  thumbnail: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  bestPlayers: string;
  minTime: number | null;
  maxTime: number | null;
  minAge: number | null;
  weight: number | null;
  rating: number | null;
  usersRated: number;
  rank: number | null;
  categories: string[];
  mechanics: string[];
  designers: string[];
  publishers: string[];
  description: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// BGG répond 202 quand la requête est mise en file, 429 quand on va trop vite : on réessaie
async function bgg(path: string, params: Record<string, string | number>): Promise<string> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) throw new BggError("BoardGameGeek n'est pas configuré (BGG_API_TOKEN)");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new BggError("Jeton BoardGameGeek refusé");
    if (res.status === 202 || res.status === 429 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new BggError(`BoardGameGeek a répondu ${res.status}`);
    return await res.text();
  }
  throw new BggError("BoardGameGeek est surchargé, réessaie dans un instant");
}

/* ---------- lecture du XML (structure simple et stable : pas besoin d'un vrai parseur) ---------- */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", laquo: "«", raquo: "»", bull: "•", times: "×",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", icirc: "î", uuml: "ü", ouml: "ö", auml: "ä",
};

function decodeOnce(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

// Les descriptions BGG sont souvent encodées deux fois (&amp;quot;)
function decode(s: string): string {
  return decodeOnce(decodeOnce(s));
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
}

function tags(xml: string, name: string): string[] {
  return xml.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
}

function text(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : null;
}

function num(xml: string, name: string): number | null {
  const v = Number(attr(tags(xml, name)[0] ?? "", "value"));
  return Number.isFinite(v) && v > 0 ? v : null;
}

function items(xml: string): { open: string; body: string }[] {
  return [...xml.matchAll(/(<item\b[^>]*>)([\s\S]*?)<\/item>/g)].map((m) => ({ open: m[1], body: m[2] }));
}

function links(body: string, type: string): string[] {
  return tags(body, "link")
    .filter((t) => attr(t, "type") === type)
    .map((t) => attr(t, "value") ?? "")
    .filter(Boolean);
}

function parseGame(open: string, body: string): BggGame {
  const names = tags(body, "name");
  const primary = names.find((t) => attr(t, "type") === "primary") ?? names[0] ?? "";
  const best = tags(body, "result").find((t) => attr(t, "name") === "bestwith");
  const rank = tags(body, "rank").find((t) => attr(t, "name") === "boardgame");
  const rankValue = Number(rank ? attr(rank, "value") : NaN);
  const rating = num(body, "average");
  return {
    bggId: Number(attr(open, "id")),
    type: attr(open, "type") ?? "boardgame",
    name: attr(primary, "value") ?? "",
    names: names.map((t) => attr(t, "value") ?? "").filter(Boolean),
    year: num(body, "yearpublished"),
    image: text(body, "image"),
    thumbnail: text(body, "thumbnail"),
    minPlayers: num(body, "minplayers"),
    maxPlayers: num(body, "maxplayers"),
    // « Best with 3–4 players » → « 3–4 »
    bestPlayers: (best && attr(best, "value")?.match(/best with (.+?) players?/i)?.[1]) || "",
    minTime: num(body, "minplaytime") ?? num(body, "playingtime"),
    maxTime: num(body, "maxplaytime") ?? num(body, "playingtime"),
    minAge: num(body, "minage"),
    weight: num(body, "averageweight"),
    rating: rating ? Math.round(rating * 10) / 10 : null,
    usersRated: num(body, "usersrated") ?? 0,
    rank: Number.isInteger(rankValue) && rankValue > 0 ? rankValue : null,
    categories: links(body, "boardgamecategory"),
    mechanics: links(body, "boardgamemechanic"),
    designers: links(body, "boardgamedesigner"),
    publishers: links(body, "boardgamepublisher"),
    description: (text(body, "description") ?? "").replace(/\n{3,}/g, "\n\n"),
  };
}

/* ---------- API ---------- */

// Jeux de base d'abord, puis extensions
export async function searchGames(query: string, exact = false): Promise<(GameHit & { type: string })[]> {
  const xml = await bgg("/search", { query, type: "boardgame,boardgameexpansion", ...(exact ? { exact: 1 } : {}) });
  const seen = new Set<number>();
  const hits: (GameHit & { type: string })[] = [];
  for (const { open, body } of items(xml)) {
    const id = Number(attr(open, "id"));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    hits.push({ bggId: id, type: attr(open, "type") ?? "boardgame", name: attr(tags(body, "name")[0] ?? "", "value") ?? "", year: num(body, "yearpublished") });
  }
  return hits.sort((a, b) => Number(a.type !== "boardgame") - Number(b.type !== "boardgame"));
}

export async function getGames(ids: number[]): Promise<BggGame[]> {
  const out: BggGame[] = [];
  // 20 fiches au plus par requête
  for (let i = 0; i < ids.length; i += 20) {
    const xml = await bgg("/thing", { id: ids.slice(i, i + 20).join(","), stats: 1 });
    out.push(...items(xml).map(({ open, body }) => parseGame(open, body)));
  }
  return out;
}

export async function getGame(id: number): Promise<BggGame | null> {
  return (await getGames([id]))[0] ?? null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(le|la|les|l|un|une|the|a) /, "")
    .trim();
}

function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y + " ") || y.startsWith(x + " ")) return 0.8;
  const wa = new Set(x.split(" "));
  const wb = new Set(y.split(" "));
  const common = [...wa].filter((w) => wb.has(w)).length;
  return (common / Math.max(wa.size, wb.size)) * 0.75;
}

// Meilleure fiche BGG pour un titre saisi (souvent en français : les noms alternatifs comptent).
// Parmi les correspondances, le jeu le plus noté l'emporte (évite les homonymes obscurs).
// Variantes de recherche : « King of Tokyo (Monster Box) » → « King of Tokyo »,
// « Splendor – Les Cités » → « Splendor » (en dernier recours)
function searchVariants(title: string): string[] {
  const noParens = title.replace(/\s*\([^)]*\)/g, "").trim();
  const head = noParens.split(/\s+[–—-]\s+|\s*:\s+/)[0].trim();
  return [...new Set([title, noParens, head].filter((v) => v.length >= 2))];
}

export async function bestMatch(title: string, year?: number | null): Promise<{ game: BggGame; confidence: number } | null> {
  let hits: Awaited<ReturnType<typeof searchGames>> = [];
  for (const q of searchVariants(title)) {
    hits = await searchGames(q, true);
    if (!hits.length) hits = await searchGames(q);
    if (hits.length) break;
  }
  if (!hits.length) return null;
  const scored = hits.map((h) => ({ h, s: similarity(title, h.name) - (h.type === "boardgame" ? 0 : 0.15) }));
  const top = scored.sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.h.bggId);
  const games = await getGames(top);
  let best: { game: BggGame; confidence: number } | null = null;
  for (const game of games) {
    const clean = title.replace(/\s*\([^)]*\)/g, "");
    let confidence = Math.max(...game.names.map((n) => Math.max(similarity(title, n), similarity(clean, n))), 0);
    if (game.type !== "boardgame") confidence -= 0.15;
    if (year && game.year && Math.abs(year - game.year) <= 1) confidence += 0.1;
    const better =
      !best ||
      confidence > best.confidence + 0.05 ||
      (Math.abs(confidence - best.confidence) <= 0.05 && game.usersRated > best.game.usersRated);
    if (better) best = { game, confidence: Math.min(1, confidence) };
  }
  return best && best.confidence >= 0.4 ? best : null;
}

export function bggUrl(id: number): string {
  return `https://boardgamegeek.com/boardgame/${id}`;
}
