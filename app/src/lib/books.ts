import { isStatus, isType, type BookSort, type BookStatus, type BookType } from "./book-labels";
import { getDb } from "./db";

export type CoverState = "pending" | "ok" | "doubtful" | "missing";

export type Book = {
  id: number;
  title: string;
  author: string;
  rating: number | null;
  status: BookStatus;
  type: BookType;
  style: string;
  summary: string;
  pros: string;
  cons: string;
  notes: string;
  publisher: string;
  year: number | null;
  pages: number | null;
  isbn: string;
  cover: CoverState;
  meta_source: string;
  created_at: string;
  updated_at: string;
};

export type BookInput = Omit<Book, "id" | "cover" | "meta_source" | "created_at" | "updated_at">;

export type BookFilters = {
  q?: string;
  type?: string;
  status?: string;
  style?: string;
  minRating?: number;
  author?: string;
  publisher?: string;
  sort?: BookSort;
};

const TEXT_LIMITS: Partial<Record<keyof BookInput, number>> = {
  title: 300, author: 200, style: 100, publisher: 200, isbn: 20,
  summary: 4000, pros: 4000, cons: 4000, notes: 10000,
};

function toInt(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(String(v).replace(",", ".")));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Nettoie et valide une saisie (formulaire, import, API)
export function sanitizeBook(raw: Record<string, unknown>): BookInput {
  const text = (key: keyof BookInput) => String(raw[key] ?? "").trim().slice(0, TEXT_LIMITS[key] ?? 1000);
  const title = text("title");
  if (!title) throw new Error("Le titre est obligatoire");
  return {
    title,
    author: text("author"),
    rating: toInt(raw.rating, 0, 10),
    status: isStatus(raw.status) ? raw.status : "a_lire",
    type: isType(raw.type) ? raw.type : "roman",
    style: text("style"),
    summary: text("summary"),
    pros: text("pros"),
    cons: text("cons"),
    notes: text("notes"),
    publisher: text("publisher"),
    year: toInt(raw.year, 0, 2100),
    pages: toInt(raw.pages, 1, 20000),
    isbn: text("isbn").replace(/[^0-9Xx]/g, "").toUpperCase(),
  };
}

// Déduit le type d'ouvrage à partir du style libre du tableau
export function inferType(style: string): BookType {
  const s = style.toLowerCase();
  if (/\bbd\b|bande dessin/.test(s)) return "bd";
  if (/manga|manhwa/.test(s)) return "manga";
  if (/comics?\b/.test(s)) return "comics";
  // "tragicomédie" désigne aussi des romans : seuls tragédie / comédie en début de mot comptent
  if (/théâtre|theatre|(^|\s)(tragédie|comédie)/.test(s)) return "theatre";
  if (/nouvelle/.test(s)) return "nouvelles";
  if (/photograph|beau livre|\bart\b/.test(s)) return "beau_livre";
  if (/roman|romance|polar|thriller|sf\b|science-fiction|fantasy|fantastique|dystopie|aventure|western|noir|policier|satire|épopée|fresque|horreur|zombie|conte|fiction|tragicom/.test(s)) return "roman";
  if (/essai|témoignage|scientifique|biograph|histoire|philosoph|jeux de langue|document|récit vrai/.test(s)) return "essai";
  return "roman";
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findDuplicate(title: string, author: string): number | null {
  const rows = getDb().prepare("SELECT id, title, author FROM books").all() as { id: number; title: string; author: string }[];
  const t = normalize(title);
  const a = normalize(author);
  return rows.find((r) => normalize(r.title) === t && normalize(r.author) === a)?.id ?? null;
}

const COLUMNS = Object.keys({
  title: 0, author: 0, rating: 0, status: 0, type: 0, style: 0, summary: 0, pros: 0, cons: 0,
  notes: 0, publisher: 0, year: 0, pages: 0, isbn: 0,
} satisfies Record<keyof BookInput, number>) as (keyof BookInput)[];

export function createBook(input: BookInput, cover: CoverState = "pending"): number {
  const result = getDb()
    .prepare(`INSERT INTO books (${COLUMNS.join(", ")}, cover) VALUES (${COLUMNS.map(() => "?").join(", ")}, ?)`)
    .run(...COLUMNS.map((c) => input[c]), cover);
  return Number(result.lastInsertRowid);
}

type Patch = Partial<BookInput & { cover: CoverState; meta_source: string }>;

export function updateBook(id: number, patch: Patch) {
  const keys = Object.keys(patch) as (keyof Patch)[];
  if (keys.length === 0) return;
  getDb()
    .prepare(`UPDATE books SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => patch[k] ?? null), id);
}

export function deleteBook(id: number) {
  getDb().prepare("DELETE FROM books WHERE id = ?").run(id);
}

export function getBook(id: number): Book | null {
  return (getDb().prepare("SELECT * FROM books WHERE id = ?").get(id) as Book | undefined) ?? null;
}

// Requête plein texte : chaque mot en préfixe ("mcc" trouve McCarthy), accents ignorés
function ftsQuery(q: string): string | null {
  const words = normalize(q).split(" ").filter(Boolean).slice(0, 8);
  return words.length ? words.map((w) => `"${w}"*`).join(" AND ") : null;
}

const SORT_SQL: Record<BookSort, string> = {
  titre: "b.title COLLATE NOCASE",
  auteur: "b.author COLLATE NOCASE, b.title COLLATE NOCASE",
  note: "b.rating IS NULL, b.rating DESC, b.title COLLATE NOCASE",
  ajout: "b.created_at DESC, b.id DESC",
};

export function listBooks(f: BookFilters): Book[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const add = (clause: string, value: string | number) => {
    where.push(clause);
    params.push(value);
  };
  const fts = f.q ? ftsQuery(f.q) : null;
  if (fts) add("b.id IN (SELECT rowid FROM books_fts WHERE books_fts MATCH ?)", fts);
  if (f.type && isType(f.type)) add("b.type = ?", f.type);
  if (f.status && isStatus(f.status)) add("b.status = ?", f.status);
  if (f.style) add("b.style = ?", f.style);
  if (f.author) add("b.author = ?", f.author);
  if (f.publisher) add("b.publisher = ?", f.publisher);
  if (f.minRating !== undefined && Number.isFinite(f.minRating)) add("b.rating >= ?", f.minRating);
  const sql = `SELECT b.* FROM books b ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${SORT_SQL[f.sort ?? "titre"]}`;
  return getDb().prepare(sql).all(...params) as Book[];
}

export function countBooks(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM books").get() as { n: number }).n;
}

export function distinctValues(column: "style" | "author" | "publisher"): string[] {
  const rows = getDb()
    .prepare(`SELECT DISTINCT ${column} AS v FROM books WHERE ${column} != '' ORDER BY ${column} COLLATE NOCASE`)
    .all() as { v: string }[];
  return rows.map((r) => r.v);
}

export function booksNeedingCover(): Book[] {
  return getDb().prepare("SELECT * FROM books WHERE cover = 'pending' ORDER BY id").all() as Book[];
}

export function coverStats(): Record<CoverState, number> {
  const rows = getDb().prepare("SELECT cover, COUNT(*) AS n FROM books GROUP BY cover").all() as { cover: CoverState; n: number }[];
  const stats: Record<CoverState, number> = { pending: 0, ok: 0, doubtful: 0, missing: 0 };
  for (const r of rows) stats[r.cover] = r.n;
  return stats;
}
