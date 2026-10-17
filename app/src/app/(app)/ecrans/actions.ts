"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { syncPlex, type PlexSyncResult } from "@/lib/plex";
import { isMediaType, isScreenStatus, type DeckOrder, type MediaType, type ScreenCard, type ScreenStatus } from "@/lib/screen-labels";
import { deleteScreen, knownKeys, plexKeys, topRated, updateScreen, upsertScreen } from "@/lib/screens";
import { discover, getDetails, getGenres, getProviders, recommendations, searchScreens, TmdbError, type Genre, type Provider } from "@/lib/tmdb";

export type DeckRequest = { type: MediaType; genres: number[]; providers: number[]; order: DeckOrder; page: number };
export type DeckCard = ScreenCard & { onPlex: boolean };
export type DeckResult = { cards: DeckCard[]; nextPage: number | null; notice?: string; error?: string };

const PAGE = 20;

function tmdbError(error: unknown): string {
  if (error instanceof TmdbError) return error.message;
  console.error(error);
  return "TMDB indisponible pour le moment";
}

export async function deckOptionsAction(type: MediaType): Promise<{ genres: Genre[]; providers: Provider[]; error?: string }> {
  await requireSession();
  try {
    const [genres, providers] = await Promise.all([getGenres(type), getProviders(type)]);
    return { genres, providers };
  } catch (error) {
    return { genres: [], providers: [], error: tmdbError(error) };
  }
}

// Mode « Pour moi » : recommandations TMDB des films/séries les mieux notés, classées par fréquence
async function forMe(req: DeckRequest): Promise<{ cards: ScreenCard[]; total: number } | null> {
  const seeds = topRated(10).filter((s) => s.media_type === req.type).slice(0, 8);
  if (seeds.length === 0) return null;
  const lists = await Promise.all(seeds.map((s) => recommendations(req.type, s.tmdb_id).catch(() => [] as ScreenCard[])));
  const score = new Map<number, { card: ScreenCard; n: number }>();
  for (const list of lists) for (const c of list) score.set(c.tmdbId, { card: c, n: (score.get(c.tmdbId)?.n ?? 0) + 1 });
  let cards = [...score.values()].sort((a, b) => b.n - a.n || (b.card.tmdbRating ?? 0) - (a.card.tmdbRating ?? 0)).map((x) => x.card);
  if (req.genres.length) {
    const names = new Set((await getGenres(req.type)).filter((g) => req.genres.includes(g.id)).map((g) => g.name));
    cards = cards.filter((c) => c.genres.some((g) => names.has(g)));
  }
  return { cards, total: cards.length };
}

export async function deckAction(req: DeckRequest): Promise<DeckResult> {
  await requireSession();
  if (!isMediaType(req.type)) return { cards: [], nextPage: null, error: "Type invalide" };
  const known = knownKeys();
  const plex = plexKeys();
  const fresh = (cards: ScreenCard[]) =>
    cards.filter((c) => !known.has(`${c.tmdbId}:${c.mediaType}`)).map((c) => ({ ...c, onPlex: plex.has(`${c.tmdbId}:${c.mediaType}`) }));

  try {
    if (req.order === "pour_moi") {
      const mine = await forMe(req);
      if (mine) {
        const all = fresh(mine.cards);
        const start = (req.page - 1) * PAGE;
        return {
          cards: all.slice(start, start + PAGE),
          nextPage: start + PAGE < all.length ? req.page + 1 : null,
          notice: req.providers.length ? "Les plateformes ne filtrent pas le mode « Pour moi »." : undefined,
        };
      }
      // Pas encore de notes : on se rabat sur les mieux notés
      const res = await deckAction({ ...req, order: "mieux_notes" });
      return { ...res, notice: "Note quelques titres pour activer « Pour moi ». En attendant : les mieux notés." };
    }
    // Les pages déjà vues sont ignorées : on avance jusqu'à trouver assez de nouveautés
    const cards: DeckCard[] = [];
    let page = req.page;
    let totalPages = 1;
    for (let tries = 0; tries < 5 && cards.length < 10; tries++, page++) {
      const res = await discover({ type: req.type, genres: req.genres, providers: req.providers, order: req.order, page });
      totalPages = res.totalPages;
      cards.push(...fresh(res.cards));
      if (page >= totalPages) break;
    }
    return { cards, nextPage: page <= totalPages ? page : null };
  } catch (error) {
    return { cards: [], nextPage: null, error: tmdbError(error) };
  }
}

// Swipe : → à voir, ← pas pour moi, ↑ vu (avec note facultative). Données revalidées auprès de TMDB.
export async function swipeAction(
  type: MediaType,
  tmdbId: number,
  status: ScreenStatus,
  rating?: number | null,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  await requireSession();
  if (!isMediaType(type) || !Number.isInteger(tmdbId) || !isScreenStatus(status)) return { ok: false, error: "Requête invalide" };
  try {
    const details = await getDetails(type, tmdbId);
    const r = rating === undefined || rating === null ? null : Math.min(10, Math.max(0, Math.round(rating)));
    return { ok: true, id: upsertScreen(details, status, { rating: r, source: "swipe" }) };
  } catch (error) {
    return { ok: false, error: tmdbError(error) };
  }
}

export async function undoSwipeAction(id: number): Promise<void> {
  await requireSession();
  deleteScreen(id);
}

export type SearchHit = ScreenCard & { knownId: number | null; knownStatus: ScreenStatus | null };

export async function searchTmdbAction(query: string): Promise<{ hits: SearchHit[]; error?: string }> {
  await requireSession();
  const q = query.trim().slice(0, 200);
  if (!q) return { hits: [] };
  try {
    const find = getDb().prepare("SELECT id, status FROM screens WHERE tmdb_id = ? AND media_type = ?");
    const hits = (await searchScreens(q)).slice(0, 20).map((c) => {
      const row = find.get(c.tmdbId, c.mediaType) as { id: number; status: ScreenStatus } | undefined;
      return { ...c, knownId: row?.id ?? null, knownStatus: row?.status ?? null };
    });
    return { hits };
  } catch (error) {
    return { hits: [], error: tmdbError(error) };
  }
}

export async function quickUpdateScreenAction(id: number, patch: { status?: string; rating?: number | null; notes?: string }) {
  await requireSession();
  updateScreen(id, patch);
  return { ok: true };
}

export async function deleteScreenAction(id: number) {
  await requireSession();
  deleteScreen(id);
  redirect("/ecrans");
}

export async function syncPlexAction(): Promise<PlexSyncResult | { error: string }> {
  await requireSession();
  try {
    return await syncPlex();
  } catch (error) {
    return { error: (error as Error).message };
  }
}
