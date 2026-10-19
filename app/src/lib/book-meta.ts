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
  // Open Library : clés de l'œuvre et de l'édition (pour lire leur description)
  workKey?: string;
  editionKey?: string;
  editionLanguages?: string[];
  // Google Books : 4e de couverture (HTML)
  description?: string;
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
  key?: string;
  title?: string;
  cover_i?: number;
  publisher?: string[];
  isbn?: string[];
  publish_date?: string[];
  language?: string[];
};

type OLDoc = {
  key?: string;
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
    workKey: d.key,
    editionKey: e?.key,
    editionLanguages: e?.language,
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
    description?: string;
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
    description: i.description,
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

// Ressemblance entre un livre et un candidat (titre surtout, auteur ensuite)
function matchScore(title: string, author: string, c: BookCandidate): number {
  // "1984 (Illustré et Annoté)" doit correspondre à "1984"
  const bare = c.title.replace(/\s*[([][^)\]]*[)\]]/g, "");
  return (
    Math.max(similarity(title, c.title), similarity(title, bare), similarity(title, c.workTitle ?? "")) * 0.7 +
    (author ? similarity(author, c.author) : 0.5) * 0.3
  );
}

// Meilleure correspondance pour un livre existant (enrichissement automatique)
export async function bestMatch(title: string, author: string): Promise<Match | null> {
  // "A / B" : on cherche sur le premier titre
  const mainTitle = title.split(" / ")[0];
  const score = (c: BookCandidate) => matchScore(mainTitle, author, c);

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

  // Recherche libre : retrouve aussi les traductions (La Route -> The Road, édition française).
  // Open Library exige tous les mots : on ne garde que le premier auteur ("A & B" -> "A"),
  // puis on élargit (titre seul, puis titre avant les deux-points) tant que rien de fiable.
  const firstAuthor = author.split(/\s*(?:&|,|\/|\bet\b|\band\b)\s*/i)[0].trim();
  const shortTitle = mainTitle.split(/\s*:\s*/)[0];
  const queries = [`${mainTitle} ${firstAuthor}`.trim(), mainTitle, shortTitle !== mainTitle ? `${shortTitle} ${firstAuthor}`.trim() : null];
  for (const q of queries) {
    if (!q) continue;
    consider(await searchOpenLibrary({ q }, 5));
    const found = best as Match | null;
    if (found && found.confidence >= 0.75 && found.candidate.coverUrl) break;
  }
  const current = best as Match | null;
  if (!current || current.confidence < 0.75 || !current.candidate.coverUrl) {
    const q = `intitle:"${mainTitle}"${author ? ` inauthor:"${author}"` : ""}`;
    consider(await searchGoogleBooks(q, 5));
  }
  return best;
}

// --- Résumés (4e de couverture) ---

export type Summary = { text: string; source: "openlibrary" | "googlebooks" };

const SUMMARY_MIN = 40;
const SUMMARY_MAX = 4000;

type OLText = string | { value?: string };

// Description Open Library : Markdown, notes de source et sections annexes à retirer
export function cleanOpenLibraryText(text: string): string {
  return text
    .replace(/\r/g, "")
    .split(/\n-{3,}/)[0] // "----------" puis "Contains:", "See also:"…
    .replace(/^\s*\[\d+\]:.*$/gm, "") // [1]: https://…
    .replace(/\(\[[^\]]*\]\[\d+\]\)/g, "") // ([source][1])
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [texte](url)
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1") // [texte][1]
    // **gras** puis *italique* (souvent imbriqués : **Du *New York Times*…**)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "$1")
    .replace(/(?<!\w)__(?=\S)(.+?)(?<=\S)__(?!\w)/g, "$1")
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, "$1")
    .replace(/(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Description Google Books : HTML simple
export function cleanHtmlText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Open Library mélange les langues (une édition d'Astérix décrite en espagnol) :
// on ne garde qu'un texte où les mots courants du français ou de l'anglais dominent
const COMMON_WORDS: Record<string, string[]> = {
  fr: ["le", "les", "des", "est", "une", "dans", "qui", "et", "au", "du", "il", "elle", "pour", "sur", "ne", "pas"],
  en: ["the", "and", "of", "is", "to", "in", "his", "her", "with", "that", "was", "for", "on", "by"],
  other: ["el", "los", "las", "del", "y", "con", "por", "una", "su", "der", "die", "und", "di", "che", "het", "een"],
};

function isFrenchOrEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const count = (list: string[]) => words.filter((w) => list.includes(w)).length;
  const [fr, en, other] = [count(COMMON_WORDS.fr), count(COMMON_WORDS.en), count(COMMON_WORDS.other)];
  return Math.max(fr, en) > other;
}

// Coupe à la dernière phrase complète sous la limite
function truncate(text: string): string {
  if (text.length <= SUMMARY_MAX) return text;
  const cut = text.slice(0, SUMMARY_MAX);
  const end = cut.lastIndexOf(". ");
  return end > SUMMARY_MAX / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

async function openLibraryDescription(key: string): Promise<string> {
  const rec = await getJson<{ description?: OLText }>(`https://openlibrary.org${key}.json`);
  const d = rec?.description;
  return cleanOpenLibraryText((typeof d === "string" ? d : d?.value) ?? "");
}

// Résumé d'un livre, par ordre de préférence : description de l'édition (souvent française,
// mais rare), Google Books (en français la plupart du temps, si la clé est configurée),
// puis description de l'œuvre sur Open Library (souvent en anglais).
// Sans ISBN, on ne retient qu'une correspondance fiable pour ne pas afficher le résumé d'un autre livre.
export async function findSummary(book: { title: string; author: string; isbn: string }): Promise<Summary | null> {
  const isbn = cleanIsbn(book.isbn);
  let ol: BookCandidate | undefined;
  let gb: BookCandidate | undefined;
  if (isbn.length === 10 || isbn.length === 13) {
    [ol, gb] = await Promise.all([
      searchOpenLibrary({ isbn }, 1).then((r) => r[0]),
      searchGoogleBooks(`isbn:${isbn}`, 1).then((r) => r[0]),
    ]);
  }
  const mainTitle = book.title.split(" / ")[0];
  if (!ol && !gb) {
    const match = await bestMatch(book.title, book.author);
    if (match && match.confidence >= 0.75) {
      if (match.candidate.source === "openlibrary") ol = match.candidate;
      else gb = match.candidate;
    }
  }
  if (!gb?.description && process.env.GOOGLE_BOOKS_API_KEY) {
    const q = `intitle:"${mainTitle}"${book.author ? ` inauthor:"${book.author}"` : ""}`;
    gb = (await searchGoogleBooks(q, 3)).find((c) => c.description && matchScore(mainTitle, book.author, c) >= 0.75) ?? gb;
  }

  const usable = (text: string) => text.length >= SUMMARY_MIN && isFrenchOrEnglish(text);
  if (ol?.editionKey && ol.editionLanguages?.includes("fre")) {
    const text = await openLibraryDescription(ol.editionKey);
    if (usable(text)) return { text: truncate(text), source: "openlibrary" };
  }
  const gbText = cleanHtmlText(gb?.description ?? "");
  if (usable(gbText)) return { text: truncate(gbText), source: "googlebooks" };
  if (ol?.workKey) {
    const text = await openLibraryDescription(ol.workKey);
    if (usable(text)) return { text: truncate(text), source: "openlibrary" };
  }
  return null;
}
