// Métadonnées et couvertures : Open Library (édition française de préférence),
// Google Books en secours seulement si GOOGLE_BOOKS_API_KEY est défini
// (sans clé, son quota anonyme partagé est épuisé en permanence).

export type BookCandidate = {
  title: string;
  author: string;
  publisher: string;
  year: number | null;
  pages: number | null;
  isbn: string;
  coverUrl: string | null;
  source: "openlibrary" | "googlebooks";
  // Titre de l'œuvre originale (ex. "The Road" pour "La Route"), pour la comparaison
  workTitle?: string;
};

const HEADERS = { "User-Agent": "HubPerso/1.0 (bibliotheque personnelle)" };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000), cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type OLEdition = {
  title?: string;
  cover_i?: number;
  publisher?: string[];
  isbn?: string[];
  publish_date?: string[];
};

type OLDoc = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  editions?: { docs?: OLEdition[] };
};

const pickIsbn = (list?: string[]) => list?.find((i) => i.length === 13) ?? list?.[0] ?? "";
// default=false : 404 au lieu d'une image vide quand la couverture n'existe pas
const olCover = (id?: number) => (id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false` : null);

function fromOpenLibrary(d: OLDoc): BookCandidate {
  // L'édition renvoyée est celle qui correspond le mieux à la recherche, en français si possible
  const e = d.editions?.docs?.[0];
  const editionYear = Number(e?.publish_date?.[0]?.match(/\d{4}/)?.[0]) || null;
  return {
    title: e?.title || d.title || "",
    author: d.author_name?.[0] ?? "",
    publisher: e?.publisher?.[0] || d.publisher?.[0] || "",
    year: editionYear ?? d.first_publish_year ?? null,
    pages: d.number_of_pages_median ?? null,
    isbn: pickIsbn(e?.isbn) || pickIsbn(d.isbn),
    coverUrl: olCover(e?.cover_i) ?? olCover(d.cover_i),
    source: "openlibrary",
    workTitle: d.title,
  };
}

type GBVolume = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

function fromGoogleBooks(v: GBVolume): BookCandidate {
  const i = v.volumeInfo ?? {};
  const ids = i.industryIdentifiers ?? [];
  const thumb = i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail;
  return {
    title: i.title ?? "",
    author: i.authors?.[0] ?? "",
    publisher: i.publisher ?? "",
    year: i.publishedDate ? Number(i.publishedDate.slice(0, 4)) || null : null,
    pages: i.pageCount ?? null,
    isbn: ids.find((x) => x.type === "ISBN_13")?.identifier ?? ids.find((x) => x.type === "ISBN_10")?.identifier ?? "",
    coverUrl: thumb ? thumb.replace(/^http:/, "https:").replace("&edge=curl", "") : null,
    source: "googlebooks",
  };
}

// "key" et "editions.key" sont nécessaires pour qu'Open Library renvoie le bloc des éditions
const OL_FIELDS = [
  "key", "title", "author_name", "first_publish_year", "publisher", "isbn", "cover_i", "number_of_pages_median",
  "editions", "editions.key", "editions.title", "editions.cover_i", "editions.publisher", "editions.isbn",
  "editions.publish_date", "editions.language",
].join(",");

async function searchOpenLibrary(params: Record<string, string>, limit = 8): Promise<BookCandidate[]> {
  const url = new URL("https://openlibrary.org/search.json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("fields", OL_FIELDS);
  url.searchParams.set("lang", "fr");
  url.searchParams.set("limit", String(limit));
  const data = await getJson<{ docs?: OLDoc[] }>(url.toString());
  return (data?.docs ?? []).map(fromOpenLibrary).filter((c) => c.title);
}

async function searchGoogleBooks(q: string, limit = 8): Promise<BookCandidate[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("printType", "books");
  const data = await getJson<{ items?: GBVolume[] }>(url.toString());
  return (data?.items ?? []).map(fromGoogleBooks).filter((c) => c.title);
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Similarité de 0 à 1 (mots en commun)
export function similarity(a: string, b: string): number {
  const wa = new Set(normalize(a).split(" ").filter((w) => w.length > 1));
  const wb = new Set(normalize(b).split(" ").filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.max(wa.size, wb.size);
}

function dedupe(list: BookCandidate[]): BookCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = c.isbn || `${normalize(c.title)}|${normalize(c.author)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Recherche libre (ajout d'un livre) : résultats des deux sources
export async function searchCandidates(query: string): Promise<BookCandidate[]> {
  const [ol, gb] = await Promise.all([searchOpenLibrary({ q: query }), searchGoogleBooks(query)]);
  return dedupe([...ol, ...gb]).slice(0, 12);
}

export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

type OLIsbnRecord = {
  title?: string;
  publishers?: string[];
  number_of_pages?: number;
  publish_date?: string;
  covers?: number[];
  authors?: { key: string }[];
};

// Fiche d'édition Open Library par ISBN (quand la recherche ne la trouve pas)
async function openLibraryIsbn(isbn: string): Promise<BookCandidate | null> {
  const rec = await getJson<OLIsbnRecord>(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!rec?.title) return null;
  const authorKey = rec.authors?.[0]?.key;
  const author = authorKey ? await getJson<{ name?: string }>(`https://openlibrary.org${authorKey}.json`) : null;
  return {
    title: rec.title,
    author: author?.name ?? "",
    publisher: rec.publishers?.[0] ?? "",
    year: Number(rec.publish_date?.match(/\d{4}/)?.[0]) || null,
    pages: rec.number_of_pages ?? null,
    isbn,
    coverUrl: olCover(rec.covers?.find((c) => c > 0)),
    source: "openlibrary",
  };
}

export async function lookupIsbn(raw: string): Promise<BookCandidate | null> {
  const isbn = cleanIsbn(raw);
  if (isbn.length !== 10 && isbn.length !== 13) return null;
  const [found, gb] = await Promise.all([searchOpenLibrary({ isbn }, 1), searchGoogleBooks(`isbn:${isbn}`, 1)]);
  const a = found[0] ?? (await openLibraryIsbn(isbn));
  const b = gb[0];
  if (!a && !b) return null;
  // Fusion : Open Library d'abord, complété par Google Books
  const base = a ?? b!;
  return {
    ...base,
    publisher: a?.publisher || b?.publisher || "",
    pages: a?.pages ?? b?.pages ?? null,
    year: a?.year ?? b?.year ?? null,
    coverUrl: a?.coverUrl ?? b?.coverUrl ?? null,
    isbn,
  };
}

export type Match = { candidate: BookCandidate; confidence: number };

// Meilleure correspondance pour un livre existant (enrichissement automatique)
export async function bestMatch(title: string, author: string): Promise<Match | null> {
  // "A / B" : on cherche sur le premier titre
  const mainTitle = title.split(" / ")[0];
  const score = (c: BookCandidate) =>
    Math.max(similarity(mainTitle, c.title), similarity(mainTitle, c.workTitle ?? "")) * 0.7 +
    (author ? similarity(author, c.author) : 0.5) * 0.3;

  let best: Match | null = null;
  const consider = (list: BookCandidate[]) => {
    for (const c of list) {
      const s = score(c);
      // À score proche, on préfère un candidat avec couverture
      if (!best || s > best.confidence + 0.05 || (s >= best.confidence - 0.05 && c.coverUrl && !best.candidate.coverUrl)) {
        best = { candidate: c, confidence: s };
      }
    }
  };

  // Recherche libre : retrouve aussi les traductions (La Route -> The Road, édition française)
  consider(await searchOpenLibrary({ q: `${mainTitle} ${author}`.trim() }, 5));
  const current = best as Match | null;
  if (!current || current.confidence < 0.75 || !current.candidate.coverUrl) {
    const q = `intitle:"${mainTitle}"${author ? ` inauthor:"${author}"` : ""}`;
    consider(await searchGoogleBooks(q, 5));
  }
  return best;
}
